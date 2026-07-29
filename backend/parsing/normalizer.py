"""Transaction normalizer — maps various column formats to standard schema.

Handles all common bank statement formats:
- Separate Debit/Credit columns (most Indian banks: SBI, HDFC, ICICI, Axis)
- Single Amount column with Dr/Cr type indicator
- Single Amount column with Cr/Dr suffix in the value itself
- Single Amount column where negative = debit, positive = credit
- Withdrawal/Deposit named columns
- Money In / Money Out columns
"""

import hashlib
import re
import pandas as pd
from datetime import datetime
from typing import Optional
from logging_config import get_logger

logger = get_logger(__name__)


def _txn_hash(date, narration: str, debit: float, credit: float, balance: float = None) -> str:
    """SHA-256 composite key for duplicate detection.

    When balance is available it uniquely identifies a row (the running balance
    changes after every transaction), so we use: date|amount|balance.
    When balance is absent we fall back to date|amount|full_narration, which
    correctly handles two transactions with the same amount on the same day
    (e.g. two Swiggy orders) as long as their narrations differ at all.
    """
    amount = debit if debit > 0 else credit
    if balance is not None and balance > 0:
        key = f"{date}|{round(amount, 2)}|bal:{round(balance, 2)}"
    else:
        key = f"{date}|{round(amount, 2)}|{narration.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()


def normalize_transactions(df: pd.DataFrame) -> list[dict]:
    """Normalize a DataFrame of transactions to standard format."""
    if df.empty:
        return []

    # Clean column names
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("(", "").replace(")", "").replace(".", "") for c in df.columns]

    logger.debug("Raw columns: %s", list(df.columns))

    strategy = _detect_strategy(df)
    logger.debug("Using strategy: %s", strategy["name"])

    transactions = []
    seen_hashes: set[str] = set()   # Req 4.7 — dedup within this file

    for _, row in df.iterrows():
        txn = _extract_transaction(row, strategy)
        if txn:
            h = _txn_hash(txn["date"], txn["narration"], txn["debit"], txn["credit"], txn.get("balance"))
            if h in seen_hashes:
                logger.debug("Duplicate transaction skipped: %s %s", txn["date"], txn["narration"][:40])
                continue
            seen_hashes.add(h)
            txn["txn_hash"] = h
            transactions.append(txn)

    deposits = sum(1 for t in transactions if t["transaction_type"] == "deposit")
    withdrawals = sum(1 for t in transactions if t["transaction_type"] == "withdrawal")
    logger.info(
        "Parsed %d transactions: %d deposits, %d withdrawals",
        len(transactions), deposits, withdrawals,
    )

    return transactions


def _detect_strategy(df: pd.DataFrame) -> dict:
    """Detect which parsing strategy to use based on available columns."""
    cols = set(df.columns)

    # Find date column
    date_col = _find_column(cols, [
        "date", "txn_date", "transaction_date", "value_date", "posting_date",
        "trans_date", "txn_dt", "valuedate", "post_date",
    ])

    # Find narration column
    narration_col = _find_column(cols, [
        "narration", "description", "particulars", "details", "remarks",
        "transaction_details", "memo", "reference", "note", "transaction_remarks",
        "transaction_description",
    ])

    # Find balance column
    balance_col = _find_column(cols, [
        "balance", "closing_balance", "running_balance", "available_balance",
        "closing_bal", "balance_inr",
    ])

    # Strategy 1: Separate debit and credit columns
    debit_col = _find_column(cols, [
        "debit", "withdrawal", "withdrawals", "debit_amount", "dr",
        "amount_debited", "money_out", "debit_inr", "withdrawal_amount",
        "debit_amt", "dr_amount",
    ])
    credit_col = _find_column(cols, [
        "credit", "deposit", "deposits", "credit_amount", "cr",
        "amount_credited", "money_in", "credit_inr", "deposit_amount",
        "credit_amt", "cr_amount",
    ])

    if debit_col and credit_col:
        return {
            "name": "separate_debit_credit",
            "date": date_col,
            "narration": narration_col,
            "debit": debit_col,
            "credit": credit_col,
            "balance": balance_col,
        }

    # Strategy 2: Single amount column with type/direction column
    amount_col = _find_column(cols, [
        "amount", "transaction_amount", "txn_amount", "txn_amt", "amount_inr",
    ])
    type_col = _find_column(cols, [
        "type", "transaction_type", "txn_type", "dr/cr", "dr_cr", "cr/dr",
        "cr_dr", "debit/credit", "credit/debit",
    ])

    # Also check: if we found a "cr/dr" style column as debit or credit, it's actually a type col
    if not type_col:
        for col in cols:
            if col in ("cr/dr", "dr/cr", "cr_dr", "dr_cr"):
                type_col = col
                # Remove from debit/credit if mistakenly assigned
                if debit_col == col:
                    debit_col = None
                if credit_col == col:
                    credit_col = None
                break

    if amount_col and type_col:
        return {
            "name": "amount_with_type",
            "date": date_col,
            "narration": narration_col,
            "amount": amount_col,
            "type": type_col,
            "balance": balance_col,
        }

    # Strategy 3: Single amount column (use sign or narration to determine direction)
    if amount_col:
        return {
            "name": "single_amount",
            "date": date_col,
            "narration": narration_col,
            "amount": amount_col,
            "balance": balance_col,
        }

    # Strategy 4: Only debit column found (credit might be in same column or missing)
    if debit_col:
        return {
            "name": "single_debit_col",
            "date": date_col,
            "narration": narration_col,
            "debit": debit_col,
            "balance": balance_col,
        }

    # Strategy 5: Only credit column found
    if credit_col:
        return {
            "name": "single_credit_col",
            "date": date_col,
            "narration": narration_col,
            "credit": credit_col,
            "balance": balance_col,
        }

    # Strategy 6: Fallback — try to find any numeric columns
    # Look for columns that contain numeric data
    numeric_cols = []
    for col in cols:
        if col == date_col or col == narration_col or col == balance_col:
            continue
        sample = df[col].dropna().head(10)
        if len(sample) > 0:
            numeric_count = sum(1 for v in sample if _is_numeric_value(str(v)))
            if numeric_count > len(sample) * 0.5:
                numeric_cols.append(col)

    if len(numeric_cols) >= 2:
        # Assume first numeric = debit, second = credit
        return {
            "name": "guessed_two_numeric",
            "date": date_col,
            "narration": narration_col,
            "debit": numeric_cols[0],
            "credit": numeric_cols[1],
            "balance": balance_col,
        }
    elif len(numeric_cols) == 1:
        return {
            "name": "guessed_single_numeric",
            "date": date_col,
            "narration": narration_col,
            "amount": numeric_cols[0],
            "balance": balance_col,
        }

    # Last resort
    return {
        "name": "unknown",
        "date": date_col,
        "narration": narration_col,
        "balance": balance_col,
    }


def _find_column(cols: set, candidates: list) -> Optional[str]:
    """Find a column by trying exact match, then substring match."""
    # Exact match first
    for candidate in candidates:
        if candidate in cols:
            return candidate

    # Substring match — but only if the column name is meaningfully similar
    # Avoid matching "cr/dr" as "credit" or "cr"
    for col in cols:
        for candidate in candidates:
            # Column contains candidate as a whole word segment
            # e.g., "withdrawal_amount" contains "withdrawal"
            if candidate in col and len(candidate) >= 3:
                # Make sure it's not a combined column like "cr/dr" or "dr_cr"
                if "/" in col or (len(col) <= 5 and col != candidate):
                    continue
                return col

    return None


def _extract_transaction(row, strategy: dict) -> Optional[dict]:
    """Extract a transaction from a row using the detected strategy."""
    # Parse date
    date_col = strategy.get("date")
    date = _parse_date(row.get(date_col) if date_col else None)

    # If no date column found, try all columns for a date
    if not date and not date_col:
        for val in row.values:
            date = _parse_date(val)
            if date:
                break

    if not date:
        return None

    # Parse narration
    narration_col = strategy.get("narration")
    narration = str(row.get(narration_col, "")).strip() if narration_col else ""
    if not narration or narration == "nan" or narration == "None":
        # Try to build narration from other text columns
        for val in row.values:
            val_str = str(val).strip()
            if len(val_str) > 5 and not _is_numeric_value(val_str) and not _parse_date(val):
                narration = val_str
                break
        if not narration:
            narration = "Unknown transaction"

    # Parse amounts based on strategy
    debit = 0.0
    credit = 0.0
    balance = None

    strategy_name = strategy["name"]

    if strategy_name == "separate_debit_credit":
        debit_raw = str(row.get(strategy["debit"], "")).strip()
        credit_raw = str(row.get(strategy["credit"], "")).strip()
        debit = abs(_parse_amount(row.get(strategy["debit"])))
        credit = abs(_parse_amount(row.get(strategy["credit"])))

        # Some banks put the value in debit col with "Cr" suffix for credits
        if debit > 0 and re.search(r"\b(cr|credit)\b", debit_raw, re.IGNORECASE):
            credit = debit
            debit = 0.0
        if credit > 0 and re.search(r"\b(dr|debit)\b", credit_raw, re.IGNORECASE):
            debit = credit
            credit = 0.0

    elif strategy_name == "amount_with_type":
        amount = _parse_amount(row.get(strategy["amount"]))
        type_val = str(row.get(strategy["type"], "")).strip().lower().rstrip(".")

        if _is_credit_indicator(type_val):
            credit = abs(amount)
        elif _is_debit_indicator(type_val):
            debit = abs(amount)
        else:
            # Type column has unexpected value — use narration
            if _narration_suggests_credit(narration):
                credit = abs(amount)
            elif amount < 0:
                debit = abs(amount)
            else:
                debit = abs(amount)

    elif strategy_name == "single_amount":
        amount_raw = str(row.get(strategy["amount"], "")).strip()
        amount = _parse_amount(amount_raw)

        # Check for Cr/Dr suffix in the amount value itself
        amount_lower = amount_raw.lower()
        has_cr = bool(re.search(r"\b(cr|credit)\b", amount_lower))
        has_dr = bool(re.search(r"\b(dr|debit)\b", amount_lower))

        if has_cr:
            credit = abs(amount)
        elif has_dr:
            debit = abs(amount)
        elif amount < 0:
            debit = abs(amount)
        elif amount > 0:
            # Use narration to determine direction
            if _narration_suggests_credit(narration):
                credit = amount
            else:
                debit = amount

    elif strategy_name in ("single_debit_col", "guessed_single_numeric"):
        col = strategy.get("debit") or strategy.get("amount")
        amount_raw = str(row.get(col, "")).strip()
        amount = _parse_amount(amount_raw)

        if amount == 0:
            return None

        amount_lower = amount_raw.lower()
        if re.search(r"\b(cr|credit)\b", amount_lower):
            credit = abs(amount)
        elif _narration_suggests_credit(narration):
            credit = abs(amount)
        elif amount < 0:
            debit = abs(amount)
        else:
            debit = abs(amount)

    elif strategy_name == "single_credit_col":
        amount = _parse_amount(row.get(strategy["credit"]))
        if amount == 0:
            return None
        credit = abs(amount)

    elif strategy_name == "guessed_two_numeric":
        val1 = _parse_amount(row.get(strategy["debit"]))
        val2 = _parse_amount(row.get(strategy["credit"]))

        # If one is zero and other isn't, that's clear
        if val1 > 0 and val2 == 0:
            debit = val1
        elif val2 > 0 and val1 == 0:
            credit = val2
        elif val1 > 0 and val2 > 0:
            # Both non-zero — assume first=debit, second=credit
            debit = val1
            credit = val2
        else:
            return None

    else:
        return None

    # Parse balance
    balance_col = strategy.get("balance")
    if balance_col:
        balance = _parse_amount(row.get(balance_col)) or None

    # Final validation
    if debit == 0 and credit == 0:
        return None

    # Determine transaction type
    if credit > 0 and debit == 0:
        transaction_type = "deposit"
    elif debit > 0 and credit == 0:
        transaction_type = "withdrawal"
    elif credit > debit:
        transaction_type = "deposit"
    else:
        transaction_type = "withdrawal"

    return {
        "date": date,
        "narration": narration,
        "debit": debit,
        "credit": credit,
        "balance": balance,
        "transaction_type": transaction_type,
    }


def _is_credit_indicator(value: str) -> bool:
    """Check if a value indicates credit/deposit."""
    credit_terms = {"cr", "credit", "c", "deposit", "credited", "in", "received", "refund", "cr."}
    return value in credit_terms


def _is_debit_indicator(value: str) -> bool:
    """Check if a value indicates debit/withdrawal."""
    debit_terms = {"dr", "debit", "d", "withdrawal", "debited", "out", "paid", "sent", "dr."}
    return value in debit_terms


def _narration_suggests_credit(narration: str) -> bool:
    """Heuristic: check if narration text suggests incoming money."""
    credit_keywords = [
        "salary", "credited", "received", "refund", "cashback", "interest",
        "dividend", "credit", "deposit", "reversal", "neft cr", "imps cr",
        "upi cr", "by transfer", "inward", "incoming", "interest paid",
        "int.paid", "credit interest", "cr -", "- cr", "/cr/", "maturity",
        "fd maturity", "rd maturity",
    ]
    narration_lower = narration.lower()
    return any(kw in narration_lower for kw in credit_keywords)


def _is_numeric_value(value: str) -> bool:
    """Check if a string looks like a numeric/amount value."""
    cleaned = value.replace(",", "").replace("₹", "").replace("$", "").replace(" ", "")
    cleaned = re.sub(r"(cr|dr|credit|debit)\.?", "", cleaned, flags=re.IGNORECASE).strip()
    if not cleaned or cleaned == "-":
        return False
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def _parse_date(value) -> Optional[datetime]:
    """Parse date from various formats."""
    if value is None:
        return None

    if isinstance(value, (datetime,)):
        return value.date() if hasattr(value, "date") else value

    if isinstance(value, pd.Timestamp):
        return value.date()

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    value_str = str(value).strip()
    if not value_str or value_str.lower() in ("nan", "none", "nat", ""):
        return None

    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%Y/%m/%d", "%d-%b-%Y", "%d %b %Y", "%d %B %Y",
        "%d-%b-%y", "%d %b %y",
        "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S",
        "%m-%d-%Y", "%d.%m.%Y", "%Y.%m.%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(value_str, fmt).date()
        except ValueError:
            continue

    # Try pandas parser as fallback
    try:
        result = pd.to_datetime(value_str, dayfirst=True)
        if not pd.isna(result):
            return result.date()
    except Exception:
        pass

    return None


def _parse_amount(value) -> float:
    """Parse amount from various formats, handling Cr/Dr suffixes.
    
    Returns the numeric value. Negative only if the raw value has a minus sign.
    Cr/Dr suffixes are stripped — direction is handled by the calling strategy.
    """
    if value is None:
        return 0.0

    try:
        if pd.isna(value):
            return 0.0
    except (TypeError, ValueError):
        pass

    if isinstance(value, (int, float)):
        return float(value)

    value_str = str(value).strip()

    if not value_str or value_str.lower() in ("nan", "none", "-", "", "null"):
        return 0.0

    # Remove currency symbols and spaces
    value_str = value_str.replace(",", "").replace("₹", "").replace("$", "").replace("€", "").replace("£", "")
    value_str = value_str.replace("\u00a0", "").strip()  # non-breaking space

    # Remove Cr/Dr suffixes (direction handled elsewhere)
    value_str = re.sub(r"\s*(cr|dr|credit|debit)\.?\s*$", "", value_str, flags=re.IGNORECASE)
    value_str = re.sub(r"^\s*(cr|dr|credit|debit)\.?\s*", "", value_str, flags=re.IGNORECASE)
    value_str = value_str.strip()

    # Handle parentheses as negative: (500.00) = -500
    is_negative = False
    if value_str.startswith("(") and value_str.endswith(")"):
        value_str = value_str[1:-1]
        is_negative = True

    # Handle leading minus
    if value_str.startswith("-"):
        is_negative = True
        value_str = value_str[1:]

    value_str = value_str.strip()

    if not value_str:
        return 0.0

    try:
        result = float(value_str)
        return -result if is_negative else result
    except ValueError:
        return 0.0
