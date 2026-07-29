"""SBI (State Bank of India) statement parser.

SBI CSV/Excel exports use this column layout:
    Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance

SBI also prepends 4-6 lines of account metadata before the header row, which
the generic parser misreads. This parser skips those prefix rows explicitly.
"""

import io
import re
import pandas as pd
from datetime import datetime
from typing import Optional
from logging_config import get_logger

logger = get_logger(__name__)

_DATE_FORMATS = ["%d %b %Y", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y", "%d %B %Y"]

_SBI_SIGNATURES = {
    "date": ["txn date", "transaction date", "date"],
    "narration": ["description", "particulars", "narration", "remarks"],
    "ref": ["ref no./cheque no.", "ref no", "cheque no", "reference"],
    "debit": ["debit", "withdrawal", "dr"],
    "credit": ["credit", "deposit", "cr"],
    "balance": ["balance"],
}


def is_sbi_statement(df: pd.DataFrame) -> bool:
    """Return True if the DataFrame looks like an SBI statement."""
    cols = {c.strip().lower() for c in df.columns}
    has_txn_date = any(s in cols for s in ("txn date", "transaction date"))
    has_amounts = (
        any(s in cols for s in _SBI_SIGNATURES["debit"]) and
        any(s in cols for s in _SBI_SIGNATURES["credit"])
    )
    return has_txn_date and has_amounts


def parse_sbi(content: bytes, file_type: str = "csv") -> list[dict]:
    """Parse an SBI bank statement (CSV or Excel) into transaction list."""
    df = _load_df(content, file_type)
    if df is None or df.empty:
        raise ValueError("Could not read SBI statement — file appears empty")

    df.columns = [str(c).strip().lower() for c in df.columns]

    col = _map_columns(df.columns.tolist())
    logger.debug("SBI column mapping: %s", col)

    transactions = []
    seen: set[str] = set()

    for _, row in df.iterrows():
        txn = _parse_row(row, col)
        if txn is None:
            continue

        key = _dedup_key(txn)
        if key in seen:
            logger.debug("SBI duplicate skipped: %s %s", txn["date"], txn["narration"][:30])
            continue
        seen.add(key)
        transactions.append(txn)

    logger.info("SBI parser extracted %d transactions", len(transactions))
    return transactions


# ── helpers ──────────────────────────────────────────────────────────────────

def _load_df(content: bytes, file_type: str) -> Optional[pd.DataFrame]:
    if file_type in ("xlsx", "xls"):
        # SBI Excel often has merged header cells — find the real header row
        raw = pd.read_excel(io.BytesIO(content), header=None)
        header_idx = _find_header_row_df(raw)
        df = pd.read_excel(io.BytesIO(content), header=header_idx)
        return df

    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            lines = text.splitlines()
            header_idx = _find_header_row_lines(lines)
            text = "\n".join(lines[header_idx:])
            return pd.read_csv(io.StringIO(text), skipinitialspace=True)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return None


def _find_header_row_lines(lines: list[str]) -> int:
    for i, line in enumerate(lines):
        lower = line.lower()
        if ("txn date" in lower or "transaction date" in lower or "description" in lower):
            return i
    return 0


def _find_header_row_df(df: pd.DataFrame) -> int:
    for i, row in df.iterrows():
        row_str = " ".join(str(v).lower() for v in row.values)
        if "txn date" in row_str or "description" in row_str:
            return i
    return 0


def _map_columns(cols: list[str]) -> dict:
    result: dict[str, Optional[str]] = {
        "date": None, "narration": None, "debit": None,
        "credit": None, "balance": None,
    }
    for field, candidates in _SBI_SIGNATURES.items():
        if field == "ref":
            continue
        for col in cols:
            if any(c == col or c in col for c in candidates):
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

    debit  = _parse_amount(row.get(col["debit"])   if col["debit"]   else None)
    credit = _parse_amount(row.get(col["credit"])  if col["credit"]  else None)
    balance = _parse_amount(row.get(col["balance"]) if col["balance"] else None) or None

    if debit == 0 and credit == 0:
        return None

    txn_type = "withdrawal" if debit > 0 else "deposit"

    return {
        "date": date,
        "narration": narration,
        "debit": debit,
        "credit": credit,
        "balance": balance,
        "transaction_type": txn_type,
    }


def _dedup_key(txn: dict) -> str:
    amount = txn["debit"] if txn["debit"] > 0 else txn["credit"]
    bal = txn.get('balance')
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
