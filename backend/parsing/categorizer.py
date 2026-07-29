"""Transaction categorizer — merchant detection and category assignment."""

import json
import re
from typing import Optional


# ---------------------------------------------------------------------------
# MCC (Merchant Category Code) → category mapping
# Standard 4-digit ISO 18245 codes common in Indian bank statements
# ---------------------------------------------------------------------------
MCC_CATEGORY_MAP: dict[int, str] = {
    # Food & Dining
    5812: "Food",  # Eating Places, Restaurants
    5814: "Food",  # Fast Food Restaurants
    5411: "Food",  # Grocery Stores, Supermarkets
    5422: "Food",  # Freezer/Meat Lockers
    5441: "Food",  # Candy, Nut, Confectionery
    5451: "Food",  # Dairy Products Stores
    5462: "Food",  # Bakeries
    5499: "Food",  # Misc Food Stores
    5921: "Food",  # Package Stores (Beer/Wine/Liquor)
    5912: "Health",# Drug Stores — listed here too as some overlap with food chemists
    # Travel & Transport
    4121: "Travel",  # Taxicabs, Limousines (Uber/Ola)
    4111: "Travel",  # Suburban/Local Commuter Transportation (Metro)
    4112: "Travel",  # Passenger Railways (IRCTC)
    4131: "Travel",  # Bus Lines
    4411: "Travel",  # Cruise Lines
    4511: "Travel",  # Airlines, Air Carriers
    4722: "Travel",  # Travel Agencies, Tour Operators
    4784: "Travel",  # Tolls, Bridge Fees (FastTag)
    5541: "Travel",  # Service Stations / Petrol Pumps
    5542: "Travel",  # Automated Fuel Dispensers
    7011: "Travel",  # Hotels, Motels
    7512: "Travel",  # Automobile Rental Agency
    7513: "Travel",  # Truck/Utility Trailer Rentals
    3000: "Travel",  # Airlines (generic range 3000-3299)
    # Shopping
    5311: "Shopping",  # Department Stores
    5331: "Shopping",  # Variety Stores (Dollar/Value stores)
    5600: "Shopping",  # Apparel/Accessory Stores
    5611: "Shopping",  # Men's/Boys' Clothing
    5621: "Shopping",  # Women's Clothing
    5631: "Shopping",  # Women's Accessory/Specialty
    5651: "Shopping",  # Family Clothing Stores
    5661: "Shopping",  # Shoe Stores
    5691: "Shopping",  # Men's/Women's Clothing
    5712: "Shopping",  # Furniture, Home Furnishings
    5719: "Shopping",  # Misc Home Furnishings
    5722: "Shopping",  # Household Appliance Stores
    5732: "Shopping",  # Electronics Stores
    5734: "Shopping",  # Computer/Software Stores
    5735: "Shopping",  # Music Stores
    5912: "Health",    # Drug Stores (overrides below)
    5940: "Shopping",  # Sporting Goods
    5945: "Shopping",  # Hobby, Toy, and Game Shops
    5947: "Shopping",  # Gift, Card, Novelty Stores
    5969: "Shopping",  # Direct Marketing
    5999: "Shopping",  # Miscellaneous General Merchandise
    5211: "Shopping",  # Lumber/Building Materials
    5251: "Shopping",  # Hardware Stores
    5261: "Shopping",  # Nurseries/Lawn/Garden Supply
    5310: "Shopping",  # Discount Stores
    5411: "Food",      # Supermarkets (already above)
    5912: "Health",    # Pharmacies (already above)
    # Entertainment
    7832: "Entertainment",  # Motion Picture Theaters (PVR/INOX)
    7922: "Entertainment",  # Theatrical Producers
    7991: "Entertainment",  # Tourist Attractions
    7993: "Entertainment",  # Video Game Supplies
    7994: "Entertainment",  # Video Game Arcades
    7996: "Entertainment",  # Amusement Parks
    7997: "Entertainment",  # Country Clubs
    7998: "Entertainment",  # Aquariums/Zoos
    7999: "Entertainment",  # Recreation Services
    5815: "Entertainment",  # Digital Goods — Media/Books/Music
    5816: "Entertainment",  # Digital Goods — Games
    5817: "Entertainment",  # Digital Goods — Software Apps
    5818: "Entertainment",  # Digital Goods (General)
    # Health & Medical
    5912: "Health",   # Drug Stores and Pharmacies
    8011: "Health",   # Doctors and Physicians
    8021: "Health",   # Dentists/Orthodontists
    8041: "Health",   # Chiropractors
    8049: "Health",   # Osteopaths
    8050: "Health",   # Nursing/Personal Care Facilities
    8062: "Health",   # Hospitals
    8099: "Health",   # Health Practitioners, Medical Services
    5122: "Health",   # Drugs, Drug Proprietaries, Druggist Sundries
    # Education
    8211: "Education",  # Elementary and Secondary Schools
    8220: "Education",  # Colleges/Universities
    8241: "Education",  # Correspondence Schools
    8244: "Education",  # Business/Secretarial Schools
    8249: "Education",  # Trade/Vocational Schools
    8299: "Education",  # Educational Services (tutoring, online courses)
    # Bills & Utilities
    4900: "Bills",  # Utilities (Electric, Gas, Water)
    4814: "Bills",  # Telecommunication Services (mobile/broadband)
    4816: "Bills",  # Computer Network/Info Services (internet)
    4899: "Bills",  # Cable, Satellite, TV (OTT subscriptions)
    4812: "Bills",  # Telephone & Telecom Equipment
    # Investment & Finance
    6011: "Transfer",    # ATM Cash Disbursements
    6010: "Transfer",    # Manual Cash Disbursements (bank)
    4829: "Transfer",    # Wire Transfer / Money Orders
    6211: "Investment",  # Security Brokers/Dealers (Zerodha/Groww)
    6300: "Bills",       # Insurance Sales
    6399: "Bills",       # Insurance (general)
    6012: "Transfer",    # Financial Institutions — Merchandise/Services
    6051: "Transfer",    # Non-Financial Institutions — Currency Exchange
    7321: "Bills",       # Credit Reporting Agencies
    # Subscriptions / Memberships
    7941: "Subscriptions",  # Sports Clubs (gym memberships)
    7911: "Subscriptions",  # Dance Halls / Studios
    7273: "Subscriptions",  # Dating / Escort Services
    # Tax
    9311: "Tax",  # Tax Payments
    9222: "Tax",  # Fines
    9399: "Tax",  # Government Services
}

# MCC codes that should always be treated as Transfer regardless of merchant
_MCC_TRANSFER = {6011, 6010, 4829, 6012, 6051}

# Regex to find an MCC code embedded in a narration string.
# Matches: MCC:5812 | MCC 5812 | MCC-5812 | [5812] (4-digit block) | /5812/
_MCC_RE = re.compile(
    r"(?:mcc[:\s\-]?(\d{4}))"          # MCC:5812 / MCC 5812 / MCC-5812
    r"|(?:\[(\d{4})\])"                  # [5812]
    r"|(?:/(\d{4})/)",                   # /5812/
    re.IGNORECASE,
)

# POS terminal ID: 6-12 digit numeric string following "POS" keyword
_POS_TID_RE = re.compile(r"\bpos\s+(\d{6,12})\s*(.*?)(?:\s+\d{2}/\d{2}|\s+mcc|\s*$)", re.IGNORECASE)

# Acquirer / MID prefix patterns used by Indian card networks
# VPS* = Visa Merchant, IND* = domestic acquirer, MER* = merchant prefix
_MID_PATTERNS: list[tuple[re.Pattern, str | None]] = [
    (re.compile(r"\bvps\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),
    (re.compile(r"\bind\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),
    (re.compile(r"\bmer\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),
    (re.compile(r"\bsq\s+\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),   # Square POS
    (re.compile(r"\bpp\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),       # PayPal
    (re.compile(r"\bpay\*([A-Za-z0-9 &._\-]{2,30})", re.IGNORECASE), None),
]


def _extract_mcc(narration: str) -> Optional[int]:
    """Return MCC as int if found in the narration string, else None."""
    m = _MCC_RE.search(narration)
    if m:
        code_str = m.group(1) or m.group(2) or m.group(3)
        if code_str:
            return int(code_str)
    return None


def _extract_pos_info(narration: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a POS narration and return (terminal_id, merchant_name).

    Handles:
      POS 41470001 MERCHANT NAME 06/25
      POS 41470001 MERCHANT NAME MCC:5812
      POS MERCHANTNAME (no TID)
    """
    m = _POS_TID_RE.search(narration)
    if m:
        tid = m.group(1)
        merchant_raw = m.group(2).strip()
        # Strip trailing date (MM/YY) and MCC markers
        merchant_raw = re.sub(r"\s*\d{2}/\d{2}\s*$", "", merchant_raw)
        merchant_raw = re.sub(r"\s*mcc[:\s\-]?\d{4}\s*$", "", merchant_raw, flags=re.IGNORECASE)
        return tid, merchant_raw.strip() or None
    return None, None


# Category keyword mappings
CATEGORY_KEYWORDS = {
    "Food": [
        "swiggy", "zomato", "uber eats", "dominos", "pizza", "mcdonald",
        "burger", "restaurant", "cafe", "coffee", "starbucks", "kfc",
        "subway", "food", "dining", "eat", "kitchen", "biryani", "chai",
        "bakery", "grocery", "bigbasket", "blinkit", "zepto", "instamart",
        "dunzo", "fresh", "meat", "fish", "vegetable",
    ],
    "Travel": [
        "uber", "ola", "rapido", "metro", "railway", "irctc", "flight",
        "airline", "makemytrip", "goibibo", "cleartrip", "bus", "cab",
        "taxi", "petrol", "fuel", "parking", "toll", "fastag",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho",
        "snapdeal", "shoppers", "mall", "retail", "store", "mart",
        "clothing", "fashion", "shoes", "electronics", "gadget",
    ],
    "Entertainment": [
        "netflix", "hotstar", "prime video", "spotify", "youtube",
        "disney", "movie", "cinema", "pvr", "inox", "gaming", "steam",
        "playstation", "xbox", "concert", "event", "ticket",
    ],
    "Bills": [
        "electricity", "water", "gas", "broadband", "internet", "wifi",
        "mobile", "recharge", "postpaid", "prepaid", "airtel", "jio",
        "vodafone", "vi", "bsnl", "rent", "maintenance", "society",
        "insurance", "lic", "premium",
    ],
    "Subscriptions": [
        "subscription", "membership", "annual", "monthly plan",
        "renewal", "auto-debit", "recurring", "emi",
    ],
    "Investment": [
        "mutual fund", "sip", "stock", "share", "demat", "zerodha",
        "groww", "upstox", "angel", "fd", "fixed deposit", "rd",
        "recurring deposit", "ppf", "nps", "gold", "bond",
        "eba/", "edelweiss", "dmc/", "brokerage",
    ],
    "Transfer": [
        "transfer", "neft", "rtgs", "imps", "upi", "sent to", "paid to",
        "received from", "credited", "self transfer",
    ],
    "Health": [
        "hospital", "doctor", "medical", "pharmacy", "medicine",
        "health", "clinic", "diagnostic", "lab", "apollo", "medplus",
    ],
    "Education": [
        "school", "college", "university", "course", "udemy", "coursera",
        "education", "tuition", "book", "library",
    ],
    "Tax": [
        "income tax", "tds", "gst", "advance tax", "tax payment", "itr",
        "self assessment tax", "tax deducted", "professional tax",
        "service tax", "property tax", "road tax",
    ],
}

# Transfer method keywords — narrations containing these are always Transfer
TRANSFER_KEYWORDS = {"neft", "rtgs", "imps", "upi", "nach", "ecs"}

# IFSC-code-like tokens and noise to strip from extracted merchant names
_IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", re.IGNORECASE)
_REF_RE  = re.compile(r"\b\d{6,}\b")
_NOISE   = re.compile(r"\b(ref|utr|txn|id|no|num|via|bank|pay|payment|ltd|pvt|llp|inc)\b", re.IGNORECASE)

# Known merchant patterns — ordered by specificity
MERCHANT_PATTERNS = [
    # UPI: UPI/<ref>/<MERCHANT NAME>/<bank>/...  — name is always the 3rd segment
    (r"upi[/\-][\w@.]+[/\-](.+?)[/\-]", None),
    # NEFT/IMPS/RTGS: <rail>/<bank code>/<NAME>/...  — name is the 3rd segment
    (r"(?:neft|imps|rtgs)[/\-][\w]+[/\-](.+?)(?:[/\-]|$)", None),
    # Explicit "paid to" / "sent to" phrases
    (r"(?:paid to|sent to|transfer to)\s+(.+?)(?:\s+ref|\s+upi|$)", None),
    (r"(?:received from|credit from)\s+(.+?)(?:\s+ref|\s+upi|$)", None),
    # POS with 6-12 digit terminal ID: POS 41470001 MERCHANT NAME 06/25
    (r"pos\s+\d{6,12}\s+(.+?)(?:\s+\d{2}/\d{2}|\s+mcc|\s*$)", None),
    # POS with 4-digit code: POS 5812 MERCHANT NAME
    (r"pos\s+\d{4}\s+(.+?)(?:\s+\d{2}/\d{2}|\s+mcc|\s*$)", None),
    # Bare POS: POS MERCHANTNAME
    (r"pos\s+([A-Za-z].+?)(?:\s+\d|$)", None),
    (r"atm\s+(.+?)(?:\s+\d|$)", None),
]

# Platform-specific patterns for ICICI / Indian bank narration prefixes.
# Each entry: (compiled regex, merchant_name_or_None).
# If merchant_name is None, group(1) of the match is used as the name.
# Patterns are matched against the lowercased narration with re.DOTALL.
_PLATFORM_PATTERNS = [
    # ── Edelweiss Broking App (EBA) ──────────────────────────────────────────
    # Stock / bond purchase: EBA/PUR-COMPANY NAME\nSUFFIX/date
    (re.compile(r"eba/pur-([a-z][a-z\s]{2,30}?)(?:\s*[\n\r/])", re.DOTALL), None),
    # Mutual fund SIP / purchase
    (re.compile(r"eba/mfp"), "Edelweiss MF"),
    # NSE brokerage / transaction charges
    (re.compile(r"eba/nse"), "Edelweiss NSE"),
    # Intraday / T-day upstream credit (refund/profit)
    (re.compile(r"eba/tday"), "Edelweiss"),
    # Generic EBA investment deposit
    (re.compile(r"eba/upstreamed"), "Edelweiss"),

    # ── Bill payments (BIL/) ─────────────────────────────────────────────────
    # ICICI credit card bill
    (re.compile(r"bil/.*credit\s*ca", re.DOTALL), "Credit Card Payment"),
    # INFT transfers with named beneficiary
    (re.compile(r"bil/inft/\w+/(family)"), "Family Transfer"),
    (re.compile(r"bil/inft/\w+/(self)"), "Self Transfer"),
    (re.compile(r"bil/inft/\w+/na"), "Bill Payment"),
    # Generic bill fallback
    (re.compile(r"^bil/"), "Bill Payment"),

    # ── Demat / DP charges (DMC/) ────────────────────────────────────────────
    (re.compile(r"dmc/.*dp\s*chgs", re.DOTALL), "Demat Charges"),
    (re.compile(r"^dmc/"), "Demat Charges"),

    # ── ICICI internal payments (INE/) ───────────────────────────────────────
    (re.compile(r"ine/ine/p-icic"), "ICICI EMI"),
    (re.compile(r"^ine/"), "ICICI Payment"),

    # ── Loan / NACH repayment (UPL/) ─────────────────────────────────────────
    (re.compile(r"upl/.*prlite"), "Loan Repayment"),
    (re.compile(r"^upl/"), "Loan Repayment"),

    # ── Paytm QR / merchant payments ─────────────────────────────────────────
    (re.compile(r"upi/paytmqrs"), "Paytm"),
    (re.compile(r"upi/paytm-\d"), "Paytm"),
]


def categorize_transactions(transactions: list[dict]) -> list[dict]:
    """Categorize transactions and detect merchants."""
    try:
        from ai.merchant_classifier import identify_merchant as _ml_identify
    except Exception:
        _ml_identify = None

    try:
        from ai.vector_store import get_store as _get_chroma
        _chroma = _get_chroma()
    except Exception:
        _chroma = None

    # First pass: rule-based categorisation
    for txn in transactions:
        narration = txn.get("narration", "").lower()
        merchant = _detect_merchant(narration)

        if merchant == "Unknown" and _ml_identify is not None:
            ml_result = _ml_identify(narration)
            if ml_result:
                merchant = ml_result

        txn["merchant"] = merchant
        category = _assign_category(narration)

        # If rule-based yields Others, check ChromaDB corrections first
        if category == "Others" and _chroma is not None:
            corrected = _chroma.find_correction(txn.get("narration", ""))
            if corrected:
                category = corrected

        txn["category"] = category

    # Second pass: send unresolved transactions to Ollama in one batch
    unresolved = [t for t in transactions if t["merchant"] == "Unknown" and t["category"] == "Others"]
    if unresolved:
        _ollama_classify_batch(unresolved)

    # Third pass: detect recurring transactions
    _detect_recurring(transactions)

    return transactions


def _ollama_classify_batch(transactions: list[dict]) -> None:
    """Ask Ollama to classify transactions that rule-based logic couldn't resolve.

    Runs synchronously (called from a sync context inside the upload pipeline).
    Silently skips if Ollama is unreachable — the transactions keep their
    rule-based Unknown/Others values.
    """
    import httpx
    from config import OLLAMA_BASE_URL, OLLAMA_MODEL

    VALID_CATEGORIES = {
        "Food", "Travel", "Shopping", "Entertainment", "Bills",
        "Subscriptions", "Investment", "Transfer", "Health", "Education", "Tax", "Others",
    }

    # Build a compact batch prompt — one line per transaction
    lines = [f'{i}: "{t["narration"]}"' for i, t in enumerate(transactions)]
    prompt = (
        "You are a bank transaction classifier for Indian bank statements.\n"
        "For each narration below, reply with exactly one JSON object per line:\n"
        '{\"i\": <index>, \"merchant\": \"<name>\", \"category\": \"<category>\"}\n'
        f"Valid categories: {', '.join(sorted(VALID_CATEGORIES))}\n\n"
        + "\n".join(lines)
        + "\n\nReply with JSON lines only, no explanation."
    )

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 400},
                },
            )
        if resp.status_code != 200:
            return

        raw = resp.json().get("response", "")
        for line in raw.strip().splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                obj = json.loads(line)
                idx = int(obj.get("i", -1))
                if not (0 <= idx < len(transactions)):
                    continue
                merchant = str(obj.get("merchant", "")).strip()
                category = str(obj.get("category", "")).strip()
                if merchant and merchant.lower() not in ("unknown", ""):
                    transactions[idx]["merchant"] = merchant
                if category in VALID_CATEGORIES and category != "Others":
                    transactions[idx]["category"] = category
            except (json.JSONDecodeError, ValueError, KeyError):
                continue

    except Exception:
        # Ollama is not running or timed out — silently keep rule-based results
        pass


def _clean_merchant(raw: str) -> str:
    """Strip IFSC codes, long reference numbers, and noise words from a raw merchant string."""
    cleaned = _IFSC_RE.sub("", raw)
    cleaned = _REF_RE.sub("", cleaned)
    cleaned = _NOISE.sub("", cleaned)
    # Collapse whitespace and trim
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" -/|")
    return cleaned


def _detect_merchant(narration: str) -> str:
    """Detect merchant from narration text, using MID/POS/MCC signals where available."""
    narration_lower = narration.lower()

    # 0. Platform-specific patterns (highest priority — catch prefix-coded formats)
    for pattern, fixed_name in _PLATFORM_PATTERNS:
        m = pattern.search(narration_lower)
        if m:
            if fixed_name:
                return fixed_name
            raw = m.group(1).strip()
            cleaned = _clean_merchant(raw)
            if len(cleaned) > 2:
                return cleaned.title()

    # 1. Acquirer MID prefix patterns (VPS*, IND*, MER*, SQ *, etc.)
    for pattern, fixed_name in _MID_PATTERNS:
        m = pattern.search(narration)
        if m:
            if fixed_name:
                return fixed_name
            raw = m.group(1).strip()
            cleaned = _clean_merchant(raw)
            if len(cleaned) > 2:
                return cleaned.title()

    # 2. POS terminal ID extraction — returns merchant name after the TID
    _tid, pos_merchant = _extract_pos_info(narration)
    if pos_merchant:
        cleaned = _clean_merchant(pos_merchant)
        if len(cleaned) > 2:
            return cleaned.title()

    # 3. General regex patterns
    for pattern, _ in MERCHANT_PATTERNS:
        match = re.search(pattern, narration_lower)
        if match:
            raw = match.group(1).strip()
            if raw.lower() in ("upi", "neft", "imps", "rtgs", "na", ""):
                continue
            cleaned = _clean_merchant(raw)
            if len(cleaned) > 2:
                return cleaned.title()

    # 4. Known brand matching
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in narration_lower:
                return keyword.title()

    # 5. Extract from narration — take first meaningful segment
    parts = re.split(r"[/\-|]", narration)
    if parts:
        candidate = _clean_merchant(parts[0])
        if len(candidate) > 2 and not candidate.isdigit():
            return candidate.title()[:50]

    return "Unknown"


def _assign_category(narration: str) -> str:
    """Assign spending category based on MCC code (highest confidence) then keywords.

    Priority:
      1. MCC code embedded in narration — most reliable, maps directly to category
      2. Keyword scoring across non-Transfer categories
      3. Transfer rail fallback (NEFT/UPI/IMPS etc.)
      4. Others
    """
    narration_lower = narration.lower()

    # 1. MCC code — most authoritative signal if present
    mcc = _extract_mcc(narration_lower)
    if mcc is not None:
        if mcc in _MCC_TRANSFER:
            return "Transfer"
        cat = MCC_CATEGORY_MAP.get(mcc)
        if cat:
            return cat
        # MCC in range 3000-3299 = airlines
        if 3000 <= mcc <= 3299:
            return "Travel"
        # MCC in range 3300-3499 = car rentals
        if 3300 <= mcc <= 3499:
            return "Travel"
        # MCC in range 3500-3999 = hotels
        if 3500 <= mcc <= 3999:
            return "Travel"

    # 2. Keyword scoring — longer keywords score higher to resolve ambiguity
    scores: dict[str, float] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        if category == "Transfer":
            continue
        score = 0.0
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, narration_lower):
                score += len(kw.split())
        if score > 0:
            scores[category] = score

    if scores:
        return max(scores, key=scores.get)

    # 3. Payment rail fallback
    words = set(re.split(r"[\W_]+", narration_lower))
    if words & TRANSFER_KEYWORDS:
        return "Transfer"

    return "Others"


def _detect_recurring(transactions: list[dict]):
    """Detect recurring transactions (subscriptions, EMIs)."""
    # Group by merchant + approximate amount
    merchant_amounts = {}
    for txn in transactions:
        merchant = txn.get("merchant", "Unknown")
        amount = txn.get("debit", 0) or txn.get("credit", 0)
        if amount > 0:
            key = f"{merchant}_{int(amount)}"
            merchant_amounts.setdefault(key, []).append(txn)

    # Mark as recurring if same merchant+amount appears 2+ times
    for key, txns in merchant_amounts.items():
        if len(txns) >= 2:
            for txn in txns:
                txn["is_recurring"] = True
                if txn["category"] == "Others":
                    txn["category"] = "Subscriptions"
