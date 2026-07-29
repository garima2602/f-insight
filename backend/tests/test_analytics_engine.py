"""
Unit tests for analytics/engine.py

Covers:
- Overview calculations (income, expenses, savings rate, net cashflow)
- Savings rate edge case: income = 0 → should not divide by zero
- Category breakdown correctness and percentages
- Monthly trends ordering and savings computation
- Impulse spending: 1.5× threshold, <3 txn skip, per-category/month
- Weekend vs weekday spending analysis
- Spending velocity: increasing / decreasing / stable
- Insights: savings rate buckets, empty data
"""

import pytest
from datetime import date
from analytics.engine import AnalyticsEngine


# ── Minimal transaction stub ──────────────────────────────────────────────────

class T:
    """Lightweight transaction stub — only the fields AnalyticsEngine reads."""
    def __init__(
        self,
        debit=0.0, credit=0.0,
        category="Others", merchant="Unknown",
        date_=date(2024, 1, 15),
        balance=None,
        is_recurring=False,
        narration="Test transaction",
    ):
        self.debit = debit
        self.credit = credit
        self.category = category
        self.merchant = merchant
        self.date = date_
        self.balance = balance
        self.is_recurring = is_recurring
        self.narration = narration


# ── Overview ──────────────────────────────────────────────────────────────────

class TestGetOverview:
    def test_basic_income_expense(self):
        txns = [T(credit=10000), T(debit=4000)]
        eng = AnalyticsEngine(txns)
        ov = eng.get_overview()
        assert ov["total_income"] == 10000.0
        assert ov["total_expenses"] == 4000.0
        assert ov["net_cashflow"] == 6000.0

    def test_savings_rate_calculation(self):
        txns = [T(credit=10000), T(debit=2000)]
        eng = AnalyticsEngine(txns)
        ov = eng.get_overview()
        # (8000 / 10000) * 100 = 80.0
        assert ov["savings_rate"] == 80.0

    def test_savings_rate_zero_income(self):
        # Must not raise ZeroDivisionError
        txns = [T(debit=500)]
        eng = AnalyticsEngine(txns)
        ov = eng.get_overview()
        assert ov["savings_rate"] == 0

    def test_empty_transactions(self):
        eng = AnalyticsEngine([])
        ov = eng.get_overview()
        assert ov["total_income"] == 0.0
        assert ov["total_expenses"] == 0.0
        assert ov["transaction_count"] == 0

    def test_current_balance_from_last_transaction(self):
        txns = [
            T(debit=100, balance=9900, date_=date(2024, 1, 1)),
            T(debit=200, balance=9700, date_=date(2024, 1, 2)),
        ]
        eng = AnalyticsEngine(txns)
        assert eng.get_overview()["current_balance"] == 9700.0


# ── Category breakdown ────────────────────────────────────────────────────────

class TestGetCategoryBreakdown:
    def test_single_category(self):
        txns = [T(debit=1000, category="Food"), T(debit=500, category="Food")]
        eng = AnalyticsEngine(txns)
        result = eng.get_category_breakdown()
        assert result["total_spending"] == 1500.0
        assert len(result["categories"]) == 1
        assert result["categories"][0]["category"] == "Food"
        assert result["categories"][0]["percentage"] == 100.0

    def test_multiple_categories_sum_to_100(self):
        txns = [T(debit=600, category="Food"), T(debit=400, category="Shopping")]
        eng = AnalyticsEngine(txns)
        cats = eng.get_category_breakdown()["categories"]
        total_pct = sum(c["percentage"] for c in cats)
        assert abs(total_pct - 100.0) < 0.1

    def test_credits_excluded_from_breakdown(self):
        txns = [T(credit=5000, category="Food")]
        eng = AnalyticsEngine(txns)
        result = eng.get_category_breakdown()
        assert result["total_spending"] == 0.0

    def test_sorted_by_amount_descending(self):
        txns = [T(debit=200, category="Travel"), T(debit=800, category="Food")]
        eng = AnalyticsEngine(txns)
        cats = eng.get_category_breakdown()["categories"]
        assert cats[0]["category"] == "Food"


# ── Monthly trends ────────────────────────────────────────────────────────────

class TestGetMonthlyTrends:
    def test_trends_sorted_chronologically(self):
        txns = [
            T(debit=1000, date_=date(2024, 3, 1)),
            T(debit=500,  date_=date(2024, 1, 1)),
            T(credit=2000, date_=date(2024, 2, 1)),
        ]
        eng = AnalyticsEngine(txns)
        months = [t["month"] for t in eng.get_monthly_trends()["trends"]]
        assert months == sorted(months)

    def test_savings_computed_per_month(self):
        txns = [
            T(credit=5000, date_=date(2024, 1, 1)),
            T(debit=3000,  date_=date(2024, 1, 15)),
        ]
        eng = AnalyticsEngine(txns)
        trend = eng.get_monthly_trends()["trends"][0]
        assert trend["savings"] == 2000.0


# ── Impulse spending ──────────────────────────────────────────────────────────

class TestImpulseSpending:
    def test_threshold_is_1_5x_average(self):
        """Req 8.1: threshold must be 1.5× category average, not 2.5×."""
        # 3 Food txns in same month: avg = (100+100+100)/3 = 100, threshold = 150
        # 4th txn = 200 → above 150 → impulse
        txns = [
            T(debit=100, category="Food", date_=date(2024, 1, 1)),
            T(debit=100, category="Food", date_=date(2024, 1, 5)),
            T(debit=100, category="Food", date_=date(2024, 1, 10)),
            T(debit=200, category="Food", date_=date(2024, 1, 20)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._detect_impulse_spending()
        assert result["count"] == 1
        assert result["transactions"][0]["amount"] == 200.0

    def test_fewer_than_3_txns_skipped(self):
        """Req 8.1: skip detection when < 3 transactions in category/month."""
        txns = [
            T(debit=100, category="Food", date_=date(2024, 1, 1)),
            T(debit=500, category="Food", date_=date(2024, 1, 2)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._detect_impulse_spending()
        assert result["count"] == 0

    def test_per_category_not_global(self):
        """Each category uses its own average, not a global one."""
        txns = [
            # Shopping: avg = 1000, threshold = 1500 — none above threshold
            T(debit=1000, category="Shopping", date_=date(2024, 1, 1)),
            T(debit=1000, category="Shopping", date_=date(2024, 1, 5)),
            T(debit=1000, category="Shopping", date_=date(2024, 1, 10)),
            # Food: avg = (50+50+50)/3 = 50, threshold = 75 → 200 is impulse
            T(debit=50,  category="Food", date_=date(2024, 1, 1)),
            T(debit=50,  category="Food", date_=date(2024, 1, 5)),
            T(debit=200, category="Food", date_=date(2024, 1, 10)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._detect_impulse_spending()
        # Only the Food ₹200 txn is impulse (avg=50, threshold=75, 200>75)
        # Shopping is all equal so none exceed threshold
        assert result["count"] == 1
        assert result["transactions"][0]["category"] == "Food"

    def test_no_non_essential_txns(self):
        txns = [T(debit=500, category="Bills")]
        eng = AnalyticsEngine(txns)
        result = eng._detect_impulse_spending()
        assert result["count"] == 0
        assert result["total"] == 0


# ── Weekend vs weekday ────────────────────────────────────────────────────────

class TestWeekendWeekdayAnalysis:
    def test_weekend_saturday(self):
        # 2024-01-06 is a Saturday
        txns = [T(debit=500, date_=date(2024, 1, 6))]
        eng = AnalyticsEngine(txns)
        result = eng._weekend_weekday_analysis()
        assert result["weekend_total"] == 500.0
        assert result["weekday_total"] == 0.0

    def test_weekday_monday(self):
        # 2024-01-08 is a Monday
        txns = [T(debit=300, date_=date(2024, 1, 8))]
        eng = AnalyticsEngine(txns)
        result = eng._weekend_weekday_analysis()
        assert result["weekday_total"] == 300.0
        assert result["weekend_total"] == 0.0

    def test_credits_excluded(self):
        txns = [T(credit=1000, date_=date(2024, 1, 6))]  # Saturday
        eng = AnalyticsEngine(txns)
        result = eng._weekend_weekday_analysis()
        assert result["weekend_total"] == 0.0


# ── Spending velocity ─────────────────────────────────────────────────────────

class TestSpendingVelocity:
    def test_increasing_trend(self):
        txns = [
            T(debit=1000, date_=date(2024, 1, 1)),
            T(debit=2000, date_=date(2024, 2, 1)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._spending_velocity()
        assert result["trend"] == "increasing"
        assert result["change_pct"] == 100.0

    def test_decreasing_trend(self):
        txns = [
            T(debit=2000, date_=date(2024, 1, 1)),
            T(debit=500,  date_=date(2024, 2, 1)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._spending_velocity()
        assert result["trend"] == "decreasing"

    def test_stable_trend(self):
        txns = [
            T(debit=1000, date_=date(2024, 1, 1)),
            T(debit=1050, date_=date(2024, 2, 1)),
        ]
        eng = AnalyticsEngine(txns)
        result = eng._spending_velocity()
        assert result["trend"] == "stable"

    def test_single_month_returns_stable(self):
        txns = [T(debit=1000, date_=date(2024, 1, 1))]
        eng = AnalyticsEngine(txns)
        result = eng._spending_velocity()
        assert result["trend"] == "stable"


# ── Insights ──────────────────────────────────────────────────────────────────

class TestGetInsights:
    def test_low_savings_rate_generates_warning(self):
        txns = [T(credit=10000), T(debit=9500)]
        eng = AnalyticsEngine(txns)
        insights = eng.get_insights()["insights"]
        types = [i["type"] for i in insights]
        assert "warning" in types

    def test_high_savings_rate_generates_success(self):
        txns = [T(credit=10000), T(debit=1000)]
        eng = AnalyticsEngine(txns)
        insights = eng.get_insights()["insights"]
        types = [i["type"] for i in insights]
        assert "success" in types

    def test_empty_transactions_no_crash(self):
        eng = AnalyticsEngine([])
        result = eng.get_insights()
        assert "insights" in result
        assert "recommendations" in result
