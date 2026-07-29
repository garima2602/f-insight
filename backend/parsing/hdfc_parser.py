"""HDFC Bank statement parser.

HDFC CSV/Excel exports have a fixed, predictable column layout:
    Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance

The generic normalizer eventually finds the right columns via fuzzy matching,
but it can mis-identify "Value Dt" as the date column. This parser hard-codes
the column mapping so parsing is unambiguous and fast.
"""

import io
import re
import pandas as pd
from datetime import datetime
from typing import Optional
from logging_config import get_logger

logger = get_logger(__name__)

# HDFC date formats (dd/mm/yy or dd/mm/yyyy)
_DATE_FORMATS = ["%d/%m/%y", "%d/%m/%Y", "%d-%m-%Y", "%d-%m-%y"]

# Known HDFC column names (case-insensitive, stripped)
_HDFC_SIGNATURES = {
    "date": ["date"],
    "narration": ["narration", "description", "particulars"],
    "ref": ["chq./ref.no.", "chq/ref no", "ref no", "cheque no"],
    "value_date": ["value dt", "value date"],
    "withdrawal": ["withdrawal amt.", "withdrawal amount", "withdrawal amt", "debit"],
    "deposit": ["deposit amt.", "deposit amount", "deposit amt", "credit"],
    "balance": ["closing balance", "balance"],
}


def is_hdfc_statement(df: pd.DataFrame) -> bool:
    """Return True if the DataFrame looks like an HDFC statement."""
    cols = {c.strip().lower() for c in df.columns}
    # Must have a narration column AND either withdrawal or deposit columns
    has_narration = any(s in cols for s in _HDFC_SIGNATURES["narration"])
    has_amounts = any(s in cols for s in _HDFC_SIGNATURES["withdrawal"]) or \
                  any(s in cols for s in _HDFC_SIGNATURES["deposit"])
    # HDFC-specific: "chq./ref.no." or "value dt" column
    has_hdfc_marker = any(
        any(s in c for s in ("chq", "ref.no", "value dt"))
        for c in cols
    )
    return has_narration and has_amounts and has_hdfc_marker


def parse_hdfc(content: bytes, file_type: str = "csv") -> list[dict]:
    """Parse an HDFC bank statement (CSV or Excel) into transaction list."""
    df = _load_df(content, file_type)
    if df is None or df.empty:
        raise ValueError("Could not read HDFC statement — file appears empty")

    # Normalise column names to lowercase stripped strings for matching
    df.columns = [str(c).strip().lower() for c in df.columns]

    col = _map_columns(df.columns.tolist())
    logger.debug("HDFC column mapping: %s", col)

    transactions = []
    seen: set[str] = set()

    for _, row in df.iterrows():
        txn = _parse_row(row, col)
        if txn is None:
            continue

        key = _dedup_key(txn)
        if key in seen:
            logger.debug("HDFC duplicate skipped: %s %s", txn["date"], txn["narration"][:30])
            continue
        seen.add(key)
        transactions.append(txn)

    logger.info("HDFC parser extracted %d transactions", len(transactions))
    return transactions


# ── helpers ──────────────────────────────────────────────────────────────────

def _load_df(content: bytes, file_type: str) -> Optional[pd.DataFrame]:
    if file_type in ("xlsx", "xls"):
        return pd.read_excel(io.BytesIO(content), header=0)
    # CSV — try common encodings
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            # Skip header rows that HDFC sometimes prepends (account info lines)
            lines = text.splitlines()
            header_idx = _find_header_row(lines)
            if header_idx > 0:
                text = "\n".join(lines[header_idx:])
            return pd.read_csv(io.StringIO(text), skipinitialspace=True)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return None


def _find_header_row(lines: list[str]) -> int:
    """Find the index of the row containing the column header."""
    for i, line in enumerate(lines):
        lower = line.lower()
        if "narration" in lower or "particulars" in lower:
            return i
    return 0


def _map_columns(cols: list[str]) -> dict:
    """Map logical field names to actual column names."""
    result: dict[str, Optional[str]] = {
        "date": None, "narration": None, "withdrawal": None,
        "deposit": None, "balance": None,
    }
    for field, candidates in _HDFC_SIGNATURES.items():
        if field in ("ref", "value_date"):
            continue  # we don't use these fields
        for col in cols:
            if any(c in col for c in candidates):
                result[field] = col
                break
    return result


def _parse_row(row, col: dict) -> Optional[dict]:
    date = _parse_date(row.get(col["date"]) if col["date"] else None)
    if not date:
        return None

    narration = str(row.get(col["narration"], "")).strip() if col["narration"] else ""
    if not narration or narration.lower() in ("nan", "none"):
        narration = "Unknown transaction"

    withdrawal = _parse_amount(row.get(col["withdrawal"]) if col["withdrawal"] else None)
    deposit    = _parse_amount(row.get(col["deposit"])    if col["deposit"]    else None)
    balance    = _parse_amount(row.get(col["balance"])    if col["balance"]    else None) or None

    if withdrawal == 0 and deposit == 0:
        return None

    txn_type = "withdrawal" if withdrawal > 0 else "deposit"

    return {
        "date": date,
        "narration": narration,
        "debit": withdrawal,
        "credit": deposit,
        "balance": balance,
        "transaction_type": txn_type,
    }


def _dedup_key(txn: dict) -> str:
    amount = txn["debit"] if txn["debit"] > 0 else txn["credit"]
    bal = txn.get("balance")
    if bal:
        return f"{txn['date']}|{round(amount, 2)}|bal:{round(bal, 2)}"
    return f"{txn['date']}|{round(amount, 2)}|{txn['narration'].lower()}"


def _parse_date(value) -> Optional[object]:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "nat"):
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        result = pd.to_datetime(s, dayfirst=True)
        return result.date() if not pd.isna(result) else None
    except Exception:
        return None


def _parse_amount(value) -> float:
    if value is None:
        return 0.0
    try:
        if pd.isna(value):
            return 0.0
    except (TypeError, ValueError):
        pass
    if isinstance(value, (int, float)):
        return abs(float(value))
    s = str(value).strip().replace(",", "").replace("₹", "").replace(" ", "")
    s = re.sub(r"\s*(cr|dr)\.?\s*$", "", s, flags=re.IGNORECASE).strip()
    if not s or s in ("-", ""):
        return 0.0
    try:
        return abs(float(s))
    except ValueError:
        return 0.0
