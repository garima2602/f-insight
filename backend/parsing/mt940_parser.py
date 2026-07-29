"""MT940 / SWIFT bank statement parser.

MT940 is a SWIFT standard used by most European banks and some Indian banks
(HDFC, ICICI, Axis export MT940 for corporate accounts).

Format overview:
  :20:  Transaction Reference Number
  :25:  Account Identification
  :28C: Statement Number / Sequence Number
  :60F: Opening Balance  (D/C + date + currency + amount)
  :61:  Statement Line   (date + D/C + amount + ref)
  :86:  Information to Account Owner (narration, free text)
  :62F: Closing Balance

A file may contain multiple statements separated by a '-' line.
Each :61: / :86: pair forms one transaction.
"""

import re
from datetime import datetime, date
from logging_config import get_logger

logger = get_logger(__name__)

# MT940 date: YYMMDD (6 digits)
_DATE_RE = re.compile(r"^(\d{6})")
# :61: line: YYMMDD[MMDD] D/C[D/C] Amount[N]<reference>
_STMT_LINE_RE = re.compile(
    r"^(?P<vdate>\d{6})(?P<bdate>\d{4})?"    # value date + optional booking date
    r"(?P<dc>[RD]?[CD])"                       # debit/credit indicator
    r"(?P<amount>[\d,]+\.?\d*)"                # amount (European: comma as thousand separator)
    r"(?P<swift_code>[A-Z]{4})?"               # optional SWIFT transaction code
    r"(?P<ref>.*)$"                            # reference
)


def _parse_mt940_date(raw: str) -> date | None:
    """Parse YYMMDD → date (2000-based)."""
    if not raw or len(raw) < 6:
        return None
    try:
        return datetime.strptime(raw[:6], "%y%m%d").date()
    except ValueError:
        return None


def _parse_amount(raw: str) -> float:
    """Parse MT940 amount: comma as decimal separator, e.g. '1234,56' → 1234.56"""
    raw = raw.strip()
    # MT940 uses comma as decimal point
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _parse_field(tag: str, content: str) -> dict | None:
    """Parse a single MT940 field."""
    if tag == "61":
        m = _STMT_LINE_RE.match(content.strip())
        if not m:
            return None
        return {
            "vdate": _parse_mt940_date(m.group("vdate")),
            "dc": m.group("dc"),
            "amount": _parse_amount(m.group("amount")),
            "ref": (m.group("ref") or "").strip(),
        }
    if tag == "86":
        return {"narration": content.strip().replace("\n", " ")}
    if tag in ("60F", "60M"):
        return {"opening": content.strip()}
    if tag == "25":
        return {"account": content.strip()}
    return None


def _split_fields(text: str) -> list[tuple[str, str]]:
    """Split MT940 text into (tag, content) pairs."""
    # Tags look like :NN: or :NNX: (e.g. :86:, :60F:, :28C:)
    tag_re = re.compile(r"^:(\w+):(.*?)(?=^:\w+:|^-$|\Z)", re.MULTILINE | re.DOTALL)
    return [(m.group(1), m.group(2)) for m in tag_re.finditer(text)]


def parse_mt940(content: bytes) -> list[dict]:
    """Parse MT940/SWIFT statement and return normalised transaction dicts."""
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Cannot decode MT940 file")

    txns: list[dict] = []
    current_61: dict | None = None
    current_narration = ""

    for tag, body in _split_fields(text):
        parsed = _parse_field(tag, body)
        if parsed is None:
            continue

        if tag == "61":
            # New statement line — flush any pending transaction
            if current_61 is not None:
                txns.append(_build_txn(current_61, current_narration))
            current_61 = parsed
            current_narration = ""

        elif tag == "86" and current_61 is not None:
            current_narration = parsed.get("narration", "")

    # Flush last transaction
    if current_61 is not None:
        txns.append(_build_txn(current_61, current_narration))

    txns = [t for t in txns if t is not None]
    logger.info("Parsed %d transactions from MT940", len(txns))
    return txns


def _build_txn(stmt: dict, narration: str) -> dict | None:
    txn_date = stmt.get("vdate")
    if txn_date is None:
        return None

    amount = stmt.get("amount", 0.0)
    dc = stmt.get("dc", "D")
    ref = stmt.get("ref", "")

    # DC indicator: C = credit/deposit, D = debit/withdrawal
    # RD = reversal debit, RC = reversal credit
    is_credit = dc in ("C", "RC")

    full_narration = " ".join(filter(None, [narration, ref])).strip() or "MT940 transaction"

    return {
        "date": txn_date,
        "narration": full_narration[:500],
        "debit":  0.0 if is_credit else amount,
        "credit": amount if is_credit else 0.0,
        "balance": None,
        "transaction_type": "deposit" if is_credit else "withdrawal",
    }
