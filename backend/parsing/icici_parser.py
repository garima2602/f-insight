"""ICICI Bank statement parser.

ICICI Bank CSV/Excel exports typically use this column layout:
    Transaction Date | Transaction Remarks | Withdrawal Amount (INR) | Deposit Amount (INR) | Balance (INR)
or older format:
    S No. | Value Date | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal Amount | Deposit Amount | Balance
"""

import io
import re
import pandas as pd
from datetime import datetime
from typing import Optional
from logging_config import get_logger

logger = get_logger(__name__)

_DATE_FORMATS = ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"]

_ICICI_SIGNATURES = {
    "date":       ["transaction date", "txn date", "value date", "date"],
    "narration":  ["transaction remarks", "particulars", "narration", "description", "remarks"],
    "withdrawal": ["withdrawal amount (inr)", "withdrawal amount", "withdrawal amt", "debit amount", "dr"],
    "deposit":    ["deposit amount (inr)", "deposit amount", "deposit amt", "credit amount", "cr"],
    "balance":    ["balance (inr)", "balance", "closing balance"],
}

_ICICI_MARKER_COLS = ["transaction remarks", "withdrawal amount (inr)", "deposit amount (inr)", "withdrawal amount"]


def is_icici_statement(df: pd.DataFrame) -> bool:
    cols = {c.strip().lower() for c in df.columns}
    has_marker = any(m in cols for m in _ICICI_MARKER_COLS)
    has_date = any(s in cols for s in _ICICI_SIGNATURES["date"])
    return has_marker and has_date


def parse_icici(content: bytes, file_type: str = "csv") -> list[dict]:
    df = _load_df(content, file_type)
    if df is None or df.empty:
        raise ValueError("Could not read ICICI statement — file appears empty")

    df.columns = [str(c).strip().lower() for c in df.columns]
    col = _map_columns(df.columns.tolist())
    logger.debug("ICICI column mapping: %s", col)

    transactions = []
    seen: set[str] = set()

    for _, row in df.iterrows():
        txn = _parse_row(row, col)
        if txn is None:
            continue
        key = _dedup_key(txn)
        if key in seen:
            continue
        seen.add(key)
        transactions.append(txn)

    logger.info("ICICI parser extracted %d transactions", len(transactions))
    return transactions


def _load_df(content: bytes, file_type: str) -> Optional[pd.DataFrame]:
    if file_type in ("xlsx", "xls"):
        return pd.read_excel(io.BytesIO(content), header=0)
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            lines = text.splitlines()
            header_idx = _find_header_row(lines)
            if header_idx > 0:
                text = "\n".join(lines[header_idx:])
            return pd.read_csv(io.StringIO(text), skipinitialspace=True)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return None


def _find_header_row(lines: list[str]) -> int:
    for i, line in enumerate(lines):
        lower = line.lower()
        if any(m in lower for m in ("transaction date", "transaction remarks", "withdrawal amount")):
            return i
    return 0


def _map_columns(cols: list[str]) -> dict:
    result: dict[str, Optional[str]] = {
        "date": None, "narration": None, "withdrawal": None, "deposit": None, "balance": None,
    }
    for field, candidates in _ICICI_SIGNATURES.items():
        for col in cols:
            for c in candidates:
                if c == col or c in col:
                    result[field] = col
                    break
            if result[field]:
                break
    return result


def _parse_row(row, col: dict) -> Optional[dict]:
    date = _parse_date(row.get(col["date"]) if col["date"] else None)
    if not date:
        return None

    narration = str(row.get(col["narration"], "")).strip() if col["narration"] else ""
    if not narration or narration.lower() in ("nan", "none"):
        return None

    withdrawal = _parse_amount(row.get(col["withdrawal"]) if col["withdrawal"] else None)
    deposit    = _parse_amount(row.get(col["deposit"])    if col["deposit"]    else None)
    balance    = _parse_amount(row.get(col["balance"])    if col["balance"]    else None) or None

    if withdrawal == 0 and deposit == 0:
        return None

    return {
        "date": date,
        "narration": narration,
        "debit": withdrawal,
        "credit": deposit,
        "balance": balance,
        "transaction_type": "withdrawal" if withdrawal > 0 else "deposit",
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
        return pd.to_datetime(s, dayfirst=True).date()
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
