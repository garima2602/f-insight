"""
Unit tests for parsing/normalizer.py

Covers:
- Strategy detection (separate debit/credit, amount+type, single amount)
- Amount parsing (commas, currency symbols, Cr/Dr suffixes, negatives)
- Date parsing (multiple formats)
- Transaction type assignment (deposit / withdrawal)
- Empty / malformed DataFrame handling
"""

import pandas as pd
import pytest
from parsing.normalizer import (
    normalize_transactions,
    _parse_amount,
    _parse_date,
    _detect_strategy,
    _narration_suggests_credit,
)


# ── _parse_amount ─────────────────────────────────────────────────────────────

class TestParseAmount:
    def test_plain_integer(self):
        assert _parse_amount(1000) == 1000.0

    def test_plain_float(self):
        assert _parse_amount(123.45) == 123.45

    def test_string_with_commas(self):
        assert _parse_amount("1,23,456.78") == 123456.78

    def test_string_with_rupee_symbol(self):
        assert _parse_amount("₹500.00") == 500.0

    def test_string_with_dollar_symbol(self):
        assert _parse_amount("$250.50") == 250.50

    def test_string_with_cr_suffix(self):
        # Cr suffix — direction handled by caller, parse_amount strips it
        assert _parse_amount("1000.00 Cr") == 1000.0

    def test_string_with_dr_suffix(self):
        assert _parse_amount("500.00 Dr") == 500.0

    def test_negative_value(self):
        # Negative sign preserved (direction signal)
        assert _parse_amount("-750.00") == -750.0

    def test_parentheses_negative(self):
        assert _parse_amount("(300.00)") == -300.0

    def test_none_returns_zero(self):
        assert _parse_amount(None) == 0.0

    def test_empty_string_returns_zero(self):
        assert _parse_amount("") == 0.0

    def test_dash_returns_zero(self):
        assert _parse_amount("-") == 0.0

    def test_nan_string_returns_zero(self):
        assert _parse_amount("nan") == 0.0


# ── _parse_date ───────────────────────────────────────────────────────────────

class TestParseDate:
    def test_iso_format(self):
        d = _parse_date("2024-03-15")
        assert d is not None
        assert str(d) == "2024-03-15"

    def test_dd_mm_yyyy_slash(self):
        d = _parse_date("15/03/2024")
        assert d is not None
        assert d.year == 2024 and d.month == 3 and d.day == 15

    def test_dd_mm_yyyy_dash(self):
        d = _parse_date("15-03-2024")
        assert d is not None
        assert d.day == 15

    def test_dd_mon_yyyy(self):
        d = _parse_date("15 Mar 2024")
        assert d is not None
        assert d.month == 3

    def test_none_returns_none(self):
        assert _parse_date(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_date("") is None

    def test_invalid_string_returns_none(self):
        assert _parse_date("not-a-date") is None


# ── _narration_suggests_credit ────────────────────────────────────────────────

class TestNarrationSuggestsCredit:
    def test_salary_keyword(self):
        assert _narration_suggests_credit("salary credited to account") is True

    def test_refund_keyword(self):
        assert _narration_suggests_credit("REFUND FROM AMAZON") is True

    def test_neft_cr(self):
        assert _narration_suggests_credit("NEFT CR from HDFC") is True

    def test_debit_narration(self):
        assert _narration_suggests_credit("UPI payment to Swiggy") is False

    def test_empty_string(self):
        assert _narration_suggests_credit("") is False


# ── _detect_strategy ─────────────────────────────────────────────────────────

class TestDetectStrategy:
    def test_separate_debit_credit_columns(self):
        df = pd.DataFrame(columns=["date", "narration", "debit", "credit", "balance"])
        df.columns = [c.lower() for c in df.columns]
        strategy = _detect_strategy(df)
        assert strategy["name"] == "separate_debit_credit"
        assert strategy["debit"] == "debit"
        assert strategy["credit"] == "credit"

    def test_amount_with_type_column(self):
        df = pd.DataFrame(columns=["date", "narration", "amount", "type"])
        df.columns = [c.lower() for c in df.columns]
        strategy = _detect_strategy(df)
        assert strategy["name"] == "amount_with_type"

    def test_single_amount_column(self):
        df = pd.DataFrame(columns=["date", "narration", "amount"])
        df.columns = [c.lower() for c in df.columns]
        strategy = _detect_strategy(df)
        assert strategy["name"] == "single_amount"

    def test_withdrawal_deposit_columns(self):
        df = pd.DataFrame(columns=["date", "narration", "withdrawal", "deposit", "balance"])
        df.columns = [c.lower() for c in df.columns]
        strategy = _detect_strategy(df)
        assert strategy["name"] == "separate_debit_credit"


# ── normalize_transactions ────────────────────────────────────────────────────

class TestNormalizeTransactions:
    def _make_df(self, rows: list[dict]) -> pd.DataFrame:
        return pd.DataFrame(rows)

    def test_empty_dataframe_returns_empty_list(self):
        result = normalize_transactions(pd.DataFrame())
        assert result == []

    def test_basic_debit_credit_columns(self):
        df = self._make_df([
            {"date": "2024-01-01", "narration": "Payment", "debit": 500.0, "credit": 0.0, "balance": 9500.0},
            {"date": "2024-01-02", "narration": "Salary", "debit": 0.0, "credit": 50000.0, "balance": 59500.0},
        ])
        result = normalize_transactions(df)
        assert len(result) == 2
        assert result[0]["transaction_type"] == "withdrawal"
        assert result[0]["debit"] == 500.0
        assert result[1]["transaction_type"] == "deposit"
        assert result[1]["credit"] == 50000.0

    def test_rows_without_date_skipped(self):
        df = self._make_df([
            {"date": None, "narration": "No date", "debit": 100.0, "credit": 0.0},
            {"date": "2024-01-01", "narration": "Has date", "debit": 200.0, "credit": 0.0},
        ])
        result = normalize_transactions(df)
        # Row without date must be excluded
        assert len(result) == 1
        assert result[0]["narration"] == "Has date"

    def test_zero_debit_and_credit_skipped(self):
        df = self._make_df([
            {"date": "2024-01-01", "narration": "Empty row", "debit": 0.0, "credit": 0.0},
            {"date": "2024-01-02", "narration": "Real txn", "debit": 300.0, "credit": 0.0},
        ])
        result = normalize_transactions(df)
        assert len(result) == 1
        assert result[0]["narration"] == "Real txn"

    def test_balance_parsed_correctly(self):
        df = self._make_df([
            {"date": "2024-01-01", "narration": "Test", "debit": 100.0, "credit": 0.0, "balance": "12,345.67"},
        ])
        result = normalize_transactions(df)
        assert result[0]["balance"] == 12345.67

    def test_credit_greater_than_debit_is_deposit(self):
        df = self._make_df([
            {"date": "2024-01-01", "narration": "Mixed", "debit": 10.0, "credit": 500.0},
        ])
        result = normalize_transactions(df)
        assert result[0]["transaction_type"] == "deposit"
