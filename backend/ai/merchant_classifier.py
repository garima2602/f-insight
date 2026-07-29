"""ML-based merchant identifier using Sentence Transformers + FAISS.

This is a fallback-only module. It is only called when the rule-based
merchant detector returns "Unknown". Existing rule-based logic is untouched.

How it works:
  1. A known merchant catalogue is embedded into vectors on first use.
  2. The FAISS index stores those vectors.
  3. For an unknown narration, we embed it and find the nearest neighbour.
  4. If the similarity is above the confidence threshold, we return that merchant.
  5. Otherwise we return None so the caller keeps "Unknown".
"""

from __future__ import annotations

import re
import threading
from typing import Optional

from logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Known merchant catalogue
# Each entry: (canonical_name, category_hint, list_of_narration_fragments)
# The fragments are what typically appear in bank narration strings.
# ---------------------------------------------------------------------------
MERCHANT_CATALOGUE: list[tuple[str, str, list[str]]] = [
    # Food delivery
    ("Swiggy",        "Food",          ["swiggy", "swiggy instamart", "bundl technologies"]),
    ("Zomato",        "Food",          ["zomato", "zomato limited"]),
    ("Domino's",      "Food",          ["dominos", "domino's", "jubilant foodworks"]),
    ("McDonald's",    "Food",          ["mcdonalds", "mcdonald", "hardcastle"]),
    ("KFC",           "Food",          ["kfc", "yum restaurants"]),
    ("Starbucks",     "Food",          ["starbucks"]),
    ("BigBasket",     "Food",          ["bigbasket", "supermarket grocery"]),
    ("Blinkit",       "Food",          ["blinkit", "grofers"]),
    ("Zepto",         "Food",          ["zepto"]),
    # Travel
    ("Uber",          "Travel",        ["uber", "uberindia", "uber india"]),
    ("Ola",           "Travel",        ["ola", "olacabs", "ani technologies"]),
    ("Rapido",        "Travel",        ["rapido", "roppen transportation"]),
    ("IRCTC",         "Travel",        ["irctc", "indian railway"]),
    ("MakeMyTrip",    "Travel",        ["makemytrip", "mmt"]),
    ("GoIbibo",       "Travel",        ["goibibo"]),
    ("FastTag",       "Travel",        ["fastag", "netc fastag", "toll"]),
    # Shopping
    ("Amazon",        "Shopping",      ["amazon", "amazon pay", "amazon seller"]),
    ("Flipkart",      "Shopping",      ["flipkart", "phonepe"]),
    ("Myntra",        "Shopping",      ["myntra"]),
    ("Ajio",          "Shopping",      ["ajio", "reliance retail"]),
    ("Nykaa",         "Shopping",      ["nykaa", "fsg"]),
    ("Meesho",        "Shopping",      ["meesho", "fashnear"]),
    # Entertainment
    ("Netflix",       "Entertainment", ["netflix"]),
    ("Hotstar",       "Entertainment", ["hotstar", "disney", "novi digital"]),
    ("Spotify",       "Entertainment", ["spotify"]),
    ("Amazon Prime",  "Entertainment", ["prime video", "amazon prime"]),
    ("YouTube",       "Entertainment", ["youtube", "google"]),
    ("PVR",           "Entertainment", ["pvr", "pvr cinemas"]),
    ("INOX",          "Entertainment", ["inox"]),
    # Telecom / Bills
    ("Airtel",        "Bills",         ["airtel", "bharti airtel"]),
    ("Jio",           "Bills",         ["jio", "reliance jio"]),
    ("BSNL",          "Bills",         ["bsnl"]),
    ("Vodafone Vi",   "Bills",         ["vodafone", " vi ", "idea cellular"]),
    # Finance / Investment
    ("Zerodha",       "Investment",    ["zerodha", "zerodha broking"]),
    ("Groww",         "Investment",    ["groww", "nextbillion"]),
    ("Upstox",        "Investment",    ["upstox", "rksv"]),
    ("PhonePe",       "Transfer",      ["phonepe", "phone pe"]),
    ("Google Pay",    "Transfer",      ["gpay", "google pay", "tez"]),
    ("Paytm",         "Transfer",      ["paytm", "one97"]),
    # Health
    ("Apollo",        "Health",        ["apollo pharmacy", "apollo hospitals"]),
    ("MedPlus",       "Health",        ["medplus"]),
    ("Practo",        "Health",        ["practo"]),
    # Education
    ("Udemy",         "Education",     ["udemy"]),
    ("Coursera",      "Education",     ["coursera"]),
    ("BYJU'S",        "Education",     ["byjus", "byju"]),
]

# Req 5.3: minimum similarity threshold for merchant matching = 75%
CONFIDENCE_THRESHOLD = 0.75

# ---------------------------------------------------------------------------
# Lazy-loaded singleton — model loads only on first use
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_classifier: Optional["MerchantClassifier"] = None


def get_classifier() -> "MerchantClassifier":
    global _classifier
    if _classifier is None:
        with _lock:
            if _classifier is None:
                _classifier = MerchantClassifier()
    return _classifier


def identify_merchant(narration: str) -> Optional[str]:
    """Public API — returns merchant name or None if not confident enough.

    Called only when rule-based detection returned "Unknown".
    Returns None on any error so the caller falls back gracefully.
    """
    try:
        clf = get_classifier()
        return clf.predict(narration)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Classifier implementation
# ---------------------------------------------------------------------------
class MerchantClassifier:
    def __init__(self):
        self._ready = False
        self._index = None
        self._labels: list[str] = []
        self._model = None
        self._build()

    def _build(self):
        """Build FAISS index from merchant catalogue."""
        try:
            import faiss
            import numpy as np
            from sentence_transformers import SentenceTransformer

            logger.info("Loading sentence-transformers model for merchant classification...")
            self._model = SentenceTransformer("all-MiniLM-L6-v2")

            # Build corpus: one entry per fragment, labelled with merchant name
            corpus: list[str] = []
            labels: list[str] = []
            for merchant_name, _category, fragments in MERCHANT_CATALOGUE:
                for fragment in fragments:
                    corpus.append(self._clean(fragment))
                    labels.append(merchant_name)

            embeddings = self._model.encode(corpus, normalize_embeddings=True)
            embeddings = np.array(embeddings, dtype="float32")

            dim = embeddings.shape[1]
            index = faiss.IndexFlatIP(dim)  # Inner product = cosine on normalised vecs
            index.add(embeddings)

            self._index = index
            self._labels = labels
            self._ready = True
            logger.info("Merchant classifier ready — %d fragments indexed.", len(corpus))

        except Exception as e:
            logger.warning("Merchant classifier failed to build index: %s. ML fallback disabled.", e)
            self._ready = False

    def predict(self, narration: str) -> Optional[str]:
        if not self._ready:
            return None

        import numpy as np

        query = self._clean(narration)
        vec = self._model.encode([query], normalize_embeddings=True)
        vec = np.array(vec, dtype="float32")

        distances, indices = self._index.search(vec, k=1)
        score = float(distances[0][0])
        idx = int(indices[0][0])

        if score >= CONFIDENCE_THRESHOLD and idx < len(self._labels):
            return self._labels[idx]

        return None

    @staticmethod
    def _clean(text: str) -> str:
        """Normalise narration text before embedding."""
        text = text.lower()
        # Strip POS terminal IDs (6-12 digit blocks after "pos")
        text = re.sub(r"\bpos\s+\d{6,12}\b", "pos", text)
        # Strip MCC codes in various formats
        text = re.sub(r"\bmcc[:\s\-]?\d{4}\b", "", text)
        text = re.sub(r"\[\d{4}\]", "", text)
        # Strip acquirer MID prefixes (VPS*, IND*, MER*, etc.)
        text = re.sub(r"\b(?:vps|ind|mer|sq|pay|pp)\*", "", text)
        # Strip card expiry dates (MM/YY)
        text = re.sub(r"\b\d{2}/\d{2}\b", "", text)
        # Remove UPI ref numbers, transaction IDs
        text = re.sub(r"\b\d{6,}\b", "", text)
        # Remove common noise words and payment rails
        noise = r"\b(upi|neft|imps|rtgs|ref|txn|transaction|transfer|payment|paid|to|from|by|via|on|at|pos|atm)\b"
        text = re.sub(noise, " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
