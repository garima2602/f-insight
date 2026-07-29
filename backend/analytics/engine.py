"""Analytics engine — deterministic financial computations."""

from collections import defaultdict
from datetime import date, timedelta


class AnalyticsEngine:
    """Computes all financial metrics from transaction data."""

    MAX_TRANSACTIONS = 100_000

    def __init__(self, transactions):
        if len(transactions) > self.MAX_TRANSACTIONS:
            transactions = transactions[:self.MAX_TRANSACTIONS]
        self.transactions = transactions
        self._compute_basics()

    def _compute_basics(self):
        """Pre-compute basic aggregates."""
        self.total_income = sum(t.credit or 0 for t in self.transactions)
        self.total_expenses = sum(t.debit or 0 for t in self.transactions)
        self.net_cashflow = self.total_income - self.total_expenses
        self.savings_rate = (
            round((self.net_cashflow / self.total_income) * 100, 1)
            if self.total_income > 0 else 0
        )

        # Latest balance
        dated_txns = [t for t in self.transactions if t.balance is not None]
        self.current_balance = dated_txns[-1].balance if dated_txns else None

        # Monthly aggregates
        self.monthly_data = self._compute_monthly()

    def _compute_monthly(self) -> dict:
        """Compute monthly income/expense breakdown."""
        monthly = defaultdict(lambda: {"income": 0, "expenses": 0})
        for t in self.transactions:
            if t.date:
                key = t.date.strftime("%Y-%m") if hasattr(t.date, "strftime") else str(t.date)[:7]
                monthly[key]["income"] += t.credit or 0
                monthly[key]["expenses"] += t.debit or 0
        return dict(monthly)

    def get_overview(self) -> dict:
        """Get financial overview."""
        avg_monthly_income = (
            self.total_income / max(len(self.monthly_data), 1)
        )
        avg_monthly_expenses = (
            self.total_expenses / max(len(self.monthly_data), 1)
        )

        return {
            "total_income": round(self.total_income, 2),
            "total_expenses": round(self.total_expenses, 2),
            "net_cashflow": round(self.net_cashflow, 2),
            "savings_rate": self.savings_rate,
            "current_balance": self.current_balance,
            "transaction_count": len(self.transactions),
            "avg_monthly_income": round(avg_monthly_income, 2),
            "avg_monthly_expenses": round(avg_monthly_expenses, 2),
            "months_covered": len(self.monthly_data),
        }

    def get_category_breakdown(self) -> dict:
        """Get spending by category."""
        categories = defaultdict(float)
        for t in self.transactions:
            if t.debit and t.debit > 0:
                categories[t.category or "Others"] += t.debit

        total = sum(categories.values())
        breakdown = []
        for cat, amount in sorted(categories.items(), key=lambda x: -x[1]):
            breakdown.append({
                "category": cat,
                "amount": round(amount, 2),
                "percentage": round((amount / total) * 100, 1) if total > 0 else 0,
            })

        return {"categories": breakdown, "total_spending": round(total, 2)}

    def get_monthly_trends(self) -> dict:
        """Get monthly income/expense trends."""
        trends = []
        for month in sorted(self.monthly_data.keys()):
            data = self.monthly_data[month]
            trends.append({
                "month": month,
                "income": round(data["income"], 2),
                "expenses": round(data["expenses"], 2),
                "savings": round(data["income"] - data["expenses"], 2),
            })
        return {"trends": trends}

    def get_merchant_spending(self) -> dict:
        """Get top merchants by spending."""
        merchants = defaultdict(float)
        for t in self.transactions:
            if t.debit and t.debit > 0:
                merchants[t.merchant or "Unknown"] += t.debit

        top_merchants = sorted(merchants.items(), key=lambda x: -x[1])[:20]
        return {
            "merchants": [
                {"name": name, "amount": round(amount, 2)}
                for name, amount in top_merchants
            ]
        }

    def get_behavioral_insights(self) -> dict:
        """Compute behavioral analytics."""
        insights = {
            "impulse_spending": self._detect_impulse_spending(),
            "weekend_vs_weekday": self._weekend_weekday_analysis(),
            "recurring_subscriptions": self._get_subscriptions(),
            "spending_velocity": self._spending_velocity(),
            "lifestyle_score": self._lifestyle_score(),
        }
        return insights

    def _detect_impulse_spending(self) -> dict:
        """
        Detect impulse purchases per Req 8.1:
        - Impulse = transaction above 150% of average single-transaction
          amount in the same Category within the same month.
        - Skip detection for any Category that has fewer than 3 transactions
          in the current month.
        """
        non_essential = {"Food", "Entertainment", "Shopping"}
        impulse_txns = []

        # Group non-essential transactions by (category, year-month)
        from collections import defaultdict
        buckets: dict[tuple, list] = defaultdict(list)
        for t in self.transactions:
            if t.debit and t.debit > 0 and t.category in non_essential and t.date:
                month_key = t.date.strftime("%Y-%m") if hasattr(t.date, "strftime") else str(t.date)[:7]
                buckets[(t.category, month_key)].append(t)

        for (category, month_key), txns in buckets.items():
            # Req 8.1: skip if fewer than 3 transactions in this category/month
            if len(txns) < 3:
                continue

            amounts = [t.debit for t in txns]
            avg_spend = sum(amounts) / len(amounts)
            threshold = avg_spend * 1.5  # Req 8.1: 150% of average

            for t in txns:
                if t.debit > threshold:
                    impulse_txns.append({
                        "date": t.date.isoformat() if t.date else None,
                        "narration": t.narration,
                        "amount": t.debit,
                        "category": t.category,
                        "threshold": round(threshold, 2),
                    })

        return {
            "count": len(impulse_txns),
            "total": round(sum(t["amount"] for t in impulse_txns), 2),
            "transactions": impulse_txns[:10],
        }

    def _weekend_weekday_analysis(self) -> dict:
        """Compare weekend vs weekday spending."""
        weekend_spend = 0
        weekday_spend = 0
        weekend_count = 0
        weekday_count = 0

        for t in self.transactions:
            if t.debit and t.debit > 0 and t.date:
                day = t.date
                if hasattr(day, "weekday"):
                    if day.weekday() >= 5:  # Saturday, Sunday
                        weekend_spend += t.debit
                        weekend_count += 1
                    else:
                        weekday_spend += t.debit
                        weekday_count += 1

        return {
            "weekend_total": round(weekend_spend, 2),
            "weekday_total": round(weekday_spend, 2),
            "weekend_avg": round(weekend_spend / max(weekend_count, 1), 2),
            "weekday_avg": round(weekday_spend / max(weekday_count, 1), 2),
            "weekend_count": weekend_count,
            "weekday_count": weekday_count,
        }

    def _get_subscriptions(self) -> list:
        """Get detected recurring/subscription transactions."""
        recurring = [
            {
                "narration": t.narration,
                "merchant": t.merchant,
                "amount": t.debit,
                "category": t.category,
            }
            for t in self.transactions
            if t.is_recurring and t.debit and t.debit > 0
        ]

        # Deduplicate by merchant
        seen = set()
        unique = []
        for r in recurring:
            key = f"{r['merchant']}_{int(r['amount'])}"
            if key not in seen:
                seen.add(key)
                unique.append(r)

        return unique

    def _spending_velocity(self) -> dict:
        """Calculate how fast money is being spent."""
        if not self.monthly_data:
            return {"trend": "stable", "change_pct": 0}

        months = sorted(self.monthly_data.keys())
        if len(months) < 2:
            return {"trend": "stable", "change_pct": 0}

        recent = self.monthly_data[months[-1]]["expenses"]
        previous = self.monthly_data[months[-2]]["expenses"]

        if previous == 0:
            return {"trend": "stable", "change_pct": 0}

        change = ((recent - previous) / previous) * 100

        if change > 15:
            trend = "increasing"
        elif change < -15:
            trend = "decreasing"
        else:
            trend = "stable"

        return {"trend": trend, "change_pct": round(change, 1)}

    def _lifestyle_score(self) -> dict:
        """Generate lifestyle score based on spending patterns."""
        if self.total_expenses == 0:
            return {"score": 0, "label": "No data", "breakdown": {}}

        categories = defaultdict(float)
        for t in self.transactions:
            if t.debit and t.debit > 0:
                categories[t.category or "Others"] += t.debit

        total = sum(categories.values())
        percentages = {k: round((v / total) * 100, 1) for k, v in categories.items()}

        # Score: higher = more discretionary spending
        discretionary = sum(
            percentages.get(c, 0)
            for c in ["Entertainment", "Shopping", "Food"]
        )

        if discretionary > 60:
            label = "High Spender"
            score = 80
        elif discretionary > 40:
            label = "Moderate"
            score = 50
        elif discretionary > 20:
            label = "Conservative"
            score = 30
        else:
            label = "Frugal"
            score = 15

        return {"score": score, "label": label, "breakdown": percentages}

    def get_insights(self) -> dict:
        """Generate actionable financial insights."""
        insights = []
        recommendations = []

        # Savings rate insight
        if self.savings_rate < 10:
            insights.append({
                "type": "warning",
                "message": f"You are saving only {self.savings_rate}% — below the healthy range of 20%+",
            })
        elif self.savings_rate < 20:
            insights.append({
                "type": "info",
                "message": f"Your savings rate is {self.savings_rate}%. Aim for 20%+ for financial security.",
            })
        else:
            insights.append({
                "type": "success",
                "message": f"Great savings rate of {self.savings_rate}%! You're building wealth.",
            })

        # Category insights
        cat_data = self.get_category_breakdown()
        for cat in cat_data["categories"][:3]:
            if cat["percentage"] > 30:
                insights.append({
                    "type": "warning",
                    "message": f"You spend {cat['percentage']}% on {cat['category']} — consider reducing.",
                })

        # Subscription insight
        subs = self._get_subscriptions()
        if subs:
            sub_total = sum(s["amount"] for s in subs)
            insights.append({
                "type": "info",
                "message": f"You have {len(subs)} recurring subscriptions totaling ₹{sub_total:,.0f}/month. Review if all are needed.",
            })

        # Spending velocity
        velocity = self._spending_velocity()
        if velocity["trend"] == "increasing":
            insights.append({
                "type": "warning",
                "message": f"Your spending increased {velocity['change_pct']}% vs last month.",
            })

        # Balance trend
        if self.monthly_data:
            months = sorted(self.monthly_data.keys())
            if len(months) >= 3:
                recent_savings = [
                    self.monthly_data[m]["income"] - self.monthly_data[m]["expenses"]
                    for m in months[-3:]
                ]
                if all(s < 0 for s in recent_savings):
                    insights.append({
                        "type": "danger",
                        "message": "Your balance has been declining for 3+ months. Immediate action needed.",
                    })

        # Recommendations
        if self.net_cashflow <= 0:
            recommendations = [
                "Cut non-essential spending immediately",
                "Review and cancel unused subscriptions",
                "Set a strict monthly budget",
                "Look for additional income sources",
                "Avoid new financial commitments",
            ]
        else:
            monthly_surplus = self.net_cashflow / max(len(self.monthly_data), 1)
            if monthly_surplus > 0:
                recommendations = [
                    f"Save at least ₹{monthly_surplus * 0.5:,.0f}/month in an emergency fund",
                    "Consider SIP investments for long-term wealth",
                    "Maintain 6 months expenses as emergency fund",
                    "Diversify: mix of FD, mutual funds, and liquid funds",
                ]

                if self.savings_rate > 30:
                    recommendations.append(
                        "Excellent position — consider increasing equity allocation"
                    )

        return {"insights": insights, "recommendations": recommendations}

    def get_health_score(self) -> dict:
        """
        Compute a 0-100 financial health score from four components:
          - savings_rate   (40 pts): >20% → full; 10-20% → partial; <10% → 0
          - expense_control (25 pts): no single category >40% of spending
          - consistency     (20 pts): positive net cashflow in recent months
          - balance_trend   (15 pts): current balance vs 3-month avg
        """
        if not self.transactions:
            return {"score": 0, "grade": "Poor", "components": {}}

        # ── Savings rate component (40 pts) ──────────────────────────────────
        sr = self.savings_rate
        if sr >= 20:
            savings_pts = 40
        elif sr >= 10:
            savings_pts = 20 + (sr - 10) * 2   # linear 20–40
        elif sr >= 0:
            savings_pts = sr * 2                # linear 0–20
        else:
            savings_pts = 0

        # ── Expense control component (25 pts) ───────────────────────────────
        cat_data = self.get_category_breakdown()
        top_pct  = cat_data["categories"][0]["percentage"] if cat_data["categories"] else 0
        if top_pct <= 30:
            control_pts = 25
        elif top_pct <= 40:
            control_pts = 15
        elif top_pct <= 55:
            control_pts = 8
        else:
            control_pts = 0

        # ── Consistency component (20 pts) ────────────────────────────────────
        months = sorted(self.monthly_data.keys())
        positive_months = sum(
            1 for m in months
            if self.monthly_data[m]["income"] - self.monthly_data[m]["expenses"] >= 0
        )
        total_months = max(len(months), 1)
        consistency_pts = round((positive_months / total_months) * 20)

        # ── Balance trend component (15 pts) ──────────────────────────────────
        if len(months) >= 3:
            recent_3 = months[-3:]
            avg_savings_recent = sum(
                self.monthly_data[m]["income"] - self.monthly_data[m]["expenses"]
                for m in recent_3
            ) / 3
            trend_pts = 15 if avg_savings_recent >= 0 else 0
        elif months:
            last = months[-1]
            net  = self.monthly_data[last]["income"] - self.monthly_data[last]["expenses"]
            trend_pts = 15 if net >= 0 else 0
        else:
            trend_pts = 0

        score = round(savings_pts + control_pts + consistency_pts + trend_pts)
        score = max(0, min(100, score))

        if score >= 75: grade = "Excellent"
        elif score >= 50: grade = "Good"
        elif score >= 30: grade = "Fair"
        else: grade = "Poor"

        return {
            "score": score,
            "grade": grade,
            "components": {
                "savings_rate":    {"score": round(savings_pts / 40, 2),    "max": 40,  "value": savings_pts},
                "expense_control": {"score": round(control_pts / 25, 2),    "max": 25,  "value": control_pts},
                "consistency":     {"score": round(consistency_pts / 20, 2),"max": 20,  "value": consistency_pts},
                "balance_trend":   {"score": round(trend_pts / 15, 2),      "max": 15,  "value": trend_pts},
            },
        }

    def get_anomalies(self) -> dict:
        """
        Detect anomalous transactions: spending > 2.5× the category's monthly average.
        Requires at least 5 transactions in a category to flag anomalies.
        """
        from collections import defaultdict
        _SKIP_CATEGORIES = {"Investment", "Transfer", "Tax"}
        cat_amounts: dict = defaultdict(list)
        for t in self.transactions:
            if t.debit and t.debit > 0 and t.category and t.category not in _SKIP_CATEGORIES:
                cat_amounts[t.category].append(t.debit)

        anomalies = []
        for t in self.transactions:
            if not (t.debit and t.debit > 0 and t.category):
                continue
            if t.category in _SKIP_CATEGORIES:
                continue
            amounts = cat_amounts[t.category]
            if len(amounts) < 5:
                continue
            avg = sum(amounts) / len(amounts)
            if avg == 0:
                continue
            ratio = t.debit / avg
            if ratio >= 2.5:
                anomalies.append({
                    "id":           t.id,
                    "date":         t.date.isoformat() if t.date else None,
                    "narration":    t.narration,
                    "merchant":     t.merchant,
                    "category":     t.category,
                    "amount":       round(t.debit, 2),
                    "category_avg": round(avg, 2),
                    "deviation_pct": round((ratio - 1) * 100, 1),
                    "reason":       f"₹{t.debit:,.0f} is {ratio:.1f}× your typical {t.category} spend of ₹{avg:,.0f}",
                })

        anomalies.sort(key=lambda x: -x["deviation_pct"])
        return {"anomalies": anomalies[:20], "count": len(anomalies)}

    def get_forecast(self) -> dict:
        """
        Trend-based 3-month forecast for income and expenses.

        Basis selection: uses up to the last 3 COMPLETE months, excluding the
        current calendar month to avoid partial-month data skewing the trend
        (e.g. uploading on July 20 would make July look like a deep income drop).

        Trend damping: the raw trend is capped at ±30% of the basis average per
        step so that one outlier month can't send projections to zero.
        """
        from datetime import date as _date

        months = sorted(self.monthly_data.keys())
        if not months:
            return {"forecast": []}

        # Exclude current calendar month (partial data)
        current_ym = _date.today().strftime("%Y-%m")
        complete = [m for m in months if m != current_ym]

        # Fall back to all months if everything is "current" (edge case)
        basis_pool = complete if complete else months
        basis = basis_pool[-3:] if len(basis_pool) >= 3 else basis_pool

        if not basis:
            return {"forecast": []}

        incomes  = [self.monthly_data[m]["income"]   for m in basis]
        expenses = [self.monthly_data[m]["expenses"] for m in basis]

        avg_income   = sum(incomes)  / len(incomes)
        avg_expenses = sum(expenses) / len(expenses)

        # Raw trend (avg monthly change across the basis window)
        if len(basis) >= 2:
            raw_income_trend   = (incomes[-1]  - incomes[0])  / (len(basis) - 1)
            raw_expenses_trend = (expenses[-1] - expenses[0]) / (len(basis) - 1)
        else:
            raw_income_trend   = 0.0
            raw_expenses_trend = 0.0

        # Damp the trend: cap at ±30 % of the basis average per step so a single
        # outlier month can't collapse the projection to zero.
        def _damp(trend: float, avg: float) -> float:
            if avg <= 0:
                return 0.0
            cap = avg * 0.30
            return max(-cap, min(cap, trend))

        income_trend   = _damp(raw_income_trend,   avg_income)
        expenses_trend = _damp(raw_expenses_trend, avg_expenses)

        # Advance past the last month in the basis (not the current month)
        last_month = basis[-1]
        year, month = int(last_month[:4]), int(last_month[5:7])

        # If the current month is beyond last_month, start projecting from current
        cur_year  = int(current_ym[:4])
        cur_month = int(current_ym[5:7])
        if (cur_year, cur_month) > (year, month):
            year, month = cur_year, cur_month

        forecast = []
        for i in range(1, 4):
            month += 1
            if month > 12:
                month = 1
                year += 1
            # Floor: never project below 10 % of the basis average
            floor_income   = avg_income   * 0.10
            floor_expenses = avg_expenses * 0.10
            proj_income   = max(floor_income,   avg_income   + income_trend   * i)
            proj_expenses = max(floor_expenses, avg_expenses + expenses_trend * i)
            forecast.append({
                "month":    f"{year}-{month:02d}",
                "income":   round(proj_income, 2),
                "expenses": round(proj_expenses, 2),
                "savings":  round(proj_income - proj_expenses, 2),
            })

        return {"forecast": forecast, "basis_months": len(basis)}

    def get_subscriptions(self) -> dict:
        """Return deduplicated recurring transactions with frequency estimation."""
        from collections import defaultdict
        # Group by merchant + rounded amount
        groups: dict = defaultdict(list)
        for t in self.transactions:
            if t.is_recurring and t.debit and t.debit > 0:
                key = f"{t.merchant or t.narration}_{round(t.debit, -1)}"
                groups[key].append(t)

        subs = []
        for key, txns in groups.items():
            if not txns:
                continue
            rep  = txns[0]
            freq = self._estimate_frequency(txns)
            subs.append({
                "merchant":   rep.merchant or rep.narration,
                "amount":     round(rep.debit, 2),
                "category":   rep.category,
                "frequency":  freq,
                "monthly_cost": round(rep.debit if freq == "monthly" else (rep.debit / 3 if freq == "quarterly" else rep.debit / 12), 2),
                "count":      len(txns),
            })

        subs.sort(key=lambda x: -x["monthly_cost"])
        total_monthly = sum(s["monthly_cost"] for s in subs)
        return {"subscriptions": subs, "total_monthly_cost": round(total_monthly, 2)}

    def _estimate_frequency(self, txns) -> str:
        if len(txns) < 2:
            return "monthly"
        dates = sorted(t.date for t in txns if t.date)
        if len(dates) < 2:
            return "monthly"
        gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        avg_gap = sum(gaps) / len(gaps)
        if avg_gap <= 35:   return "monthly"
        if avg_gap <= 100:  return "quarterly"
        return "annual"

    def get_heatmap(self) -> dict:
        """Return daily spending amounts for a spending calendar heatmap."""
        from collections import defaultdict
        daily: dict = defaultdict(float)
        for t in self.transactions:
            if t.debit and t.debit > 0 and t.date:
                key = t.date.isoformat() if hasattr(t.date, "isoformat") else str(t.date)
                daily[key] += t.debit

        data = [{"date": d, "amount": round(v, 2)} for d, v in sorted(daily.items())]
        return {"data": data}

    def get_context_for_ai(self) -> dict:
        """Get computed context for AI assistant (LLM should NOT do math)."""
        return {
            "overview": self.get_overview(),
            "categories": self.get_category_breakdown(),
            "behavioral": self.get_behavioral_insights(),
            "insights": self.get_insights(),
            "top_merchants": self.get_merchant_spending(),
        }
