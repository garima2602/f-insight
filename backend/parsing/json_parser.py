"""JSON bank statement parser.

Accepts two formats exported by some fintech APIs and aggregators:

Format A — array of transaction objects (most common):
  [{"date": "2024-01-15", "description": "...", "amount": -500.0, ...}, ...]

Format B — wrapped object:
  {"transactions": [...], "account": {...}}

Field mapping tries common key names from Plaid, Setu, Finvu, Jupiter etc.
"""

import json
from datetime import datetime, date
from logging_config import get_logger

logger = get_logger(__name__)

_DATE_KEYS = ("date", "transaction_date", "value_date", "posting_date", "txn_date")
_DESC_KEYS = ("description", "narration", "merchant_name", "name", "particulars", "remarks", "memo")
_AMOUNT_KEYS = ("amount", "transaction_amount", "txn_amount")
_DEBIT_KEYS = ("debit", "debit_amount", "withdrawal")
_CREDIT_KEYS = ("credit", "credit_amount", "deposit")
_BALANCE_KEYS = ("balance", "closing_balance", "running_balance")

_DATE_FMTS = (
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
    "%d %b %Y", "%d %B %Y",
)


def _first(obj: dict, keys: tuple) -> object:
    for k in keys:
        if k in obj:
            return obj[k]
    return None


def _parse_date(raw) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.utcfromtimestamp(raw).date()
        except (OSError, OverflowError):
            return None
    raw = str(raw).strip()
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(raw[:len(fmt) + 5], fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw) -> float:
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    try:
        return float(str(raw).replace(",", "").strip())
    except ValueError:
        return 0.0


def _normalise_txn(obj: dict) -> dict | None:
    txn_date = _parse_date(_first(obj, _DATE_KEYS))
    if txn_date is None:
        return None

    narration = str(_first(obj, _DESC_KEYS) or "").strip() or "JSON transaction"

    # Try explicit debit/credit columns first
    debit  = _parse_amount(_first(obj, _DEBIT_KEYS))
    credit = _parse_amount(_first(obj, _CREDIT_KEYS))

    if debit == 0.0 and credit == 0.0:
        # Fall back to signed amount column
        raw_amount = _first(obj, _AMOUNT_KEYS)
        if raw_amount is not None:
            amount = _parse_amount(raw_amount)
            if amount < 0:
                debit = abs(amount)
            else:
                credit = amount

    txn_type_raw = str(obj.get("type", obj.get("transaction_type", ""))).lower()
    if txn_type_raw in ("debit", "withdrawal", "dr"):
        txn_type = "withdrawal"
    elif txn_type_raw in ("credit", "deposit", "cr"):
        txn_type = "deposit"
    else:
        txn_type = "withdrawal" if debit > 0 else "deposit"

    balance_raw = _first(obj, _BALANCE_KEYS)
    balance = _parse_amount(balance_raw) if balance_raw is not None else None

    return {
        "date": txn_date,
        "narration": narration,
        "debit": debit,
        "credit": credit,
        "balance": balance,
        "transaction_type": txn_type,
    }


def parse_json(content: bytes) -> list[dict]:
    """Parse JSON statement content and return normalised transaction dicts."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc

    # Unwrap common envelope formats
    if isinstance(data, dict):
        for key in ("transactions", "data", "records", "statement", "txns"):
            if key in data and isinstance(data[key], list):
                data = data[key]
                break
        else:
            raise ValueError("JSON object has no recognisable transaction array key")

    if not isinstance(data, list):
        raise ValueError("JSON content must be an array (or a wrapped object containing one)")

    txns = []
    skipped = 0
    for obj in data:
        if not isinstance(obj, dict):
            skipped += 1
            continue
        normalised = _normalise_txn(obj)
        if normalised is None:
            skipped += 1
        else:
            txns.append(normalised)

    if skipped:
        logger.warning("JSON parser: skipped %d records with missing/unparseable dates", skipped)
    logger.info("Parsed %d transactions from JSON", len(txns))
    return txns
