"""QIF (Quicken Interchange Format) parser.

QIF is a simple line-delimited text format exported by many banks and
personal-finance apps. Each transaction is a block of single-character
field codes separated by '^' record terminators.

Field codes used here:
  D  Date
  T  Amount
  P  Payee / memo
  M  Additional memo
  ^  End of record
"""

import re
from datetime import datetime, date
from logging_config import get_logger

logger = get_logger(__name__)

_DATE_FMTS = (
    "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y",
    "%d/%m/%y", "%m/%d/%y", "%d %b %Y", "%Y-%m-%d",
    "%d/%m'%Y", "%d/%m/%Y",  # some banks use apostrophe
)


def _parse_qif_date(raw: str) -> date | None:
    raw = raw.strip().replace("'", "/").replace("  ", " ")
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_qif_amount(raw: str) -> float:
    """Handle amounts like '1,234.56' or '-1234,56' (European comma decimals)."""
    raw = raw.strip().replace(" ", "")
    # Detect European format: 1.234,56
    if re.match(r"^-?\d{1,3}(\.\d{3})*(,\d+)$", raw):
        raw = raw.replace(".", "").replace(",", ".")
    else:
        raw = raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def parse_qif(content: bytes) -> list[dict]:
    """Parse QIF file and return normalised transaction dicts."""
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Cannot decode QIF file")

    lines = text.splitlines()
    txns: list[dict] = []
    current: dict = {}

    for line in lines:
        line = line.rstrip()
        if not line:
            continue
        code = line[0]
        value = line[1:].strip()

        if code == "!":
            # Account type header — skip
            continue
        elif code == "D":
            current["date_raw"] = value
        elif code == "T":
            current["amount"] = _parse_qif_amount(value)
        elif code == "P":
            current["payee"] = value
        elif code == "M":
            current.setdefault("memo_parts", []).append(value)
        elif code == "^":
            # End of record — flush
            if not current:
                continue
            txn_date = _parse_qif_date(current.get("date_raw", ""))
            if txn_date is None:
                current = {}
                continue

            amount = current.get("amount", 0.0)
            memo_parts = current.get("memo_parts", [])
            payee = current.get("payee", "")
            narration = " | ".join(filter(None, [payee] + memo_parts)) or "QIF transaction"

            is_debit = amount < 0
            txns.append({
                "date": txn_date,
                "narration": narration,
                "debit":  abs(amount) if is_debit else 0.0,
                "credit": amount if not is_debit else 0.0,
                "balance": None,
                "transaction_type": "withdrawal" if is_debit else "deposit",
            })
            current = {}

    logger.info("Parsed %d transactions from QIF", len(txns))
    return txns
