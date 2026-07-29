"""Local AI Financial Assistant — works with or without Ollama."""

import httpx
import json
from config import OLLAMA_BASE_URL, OLLAMA_MODEL
from logging_config import get_logger

logger = get_logger(__name__)


SYSTEM_PROMPT = """You are a helpful local financial assistant. You analyze the user's bank transactions and provide insights.

IMPORTANT RULES:
1. All numbers and calculations are provided to you pre-computed. Do NOT perform arithmetic.
2. Use the provided financial context to answer questions accurately.
3. Be concise and actionable in your responses.
4. If you don't have enough data to answer, say so clearly.
5. Never suggest external services or cloud-based tools — everything must stay local.
6. Format currency amounts clearly (e.g., ₹10,000).
7. Provide specific, personalized advice based on the data shown.

You have access to the user's:
- Income and expense totals
- Category-wise spending breakdown
- Merchant spending data
- Behavioral patterns (impulse spending, weekend vs weekday)
- Savings rate and financial health indicators
"""


class FinancialAssistant:
    """AI assistant that uses pre-computed analytics + local LLM (or rule-based fallback)."""

    def __init__(self, analytics_engine):
        self.engine = analytics_engine

    async def answer(self, question: str) -> tuple[str, dict]:
        """Answer a financial question using computed data + LLM explanation."""
        # Step 1: Compute all relevant context (deterministic)
        context = self.engine.get_context_for_ai()

        # Step 2: Try Ollama, fall back to rule-based only if Ollama is unreachable
        try:
            ollama_ok = await self._check_ollama()
            logger.info("Ollama reachable: %s", ollama_ok)
            if ollama_ok:
                prompt = self._build_prompt(question, context)
                reply = await self._call_ollama(prompt)
                logger.info("Response generated via Ollama LLM")
            else:
                logger.warning("Ollama not reachable — using rule-based fallback")
                reply = self._smart_fallback(question, context)
        except Exception as e:
            logger.error("Ollama call failed: %s", e, exc_info=True)
            reply = self._smart_fallback(question, context)

        return reply, context

    async def _check_ollama(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                return resp.status_code == 200
        except Exception as e:
            logger.warning("Ollama health check failed: %s", e)
            return False

    def _build_prompt(self, question: str, context: dict) -> str:
        """Build a minimal prompt — less context = faster response."""
        overview = context["overview"]
        categories = context["categories"]

        # Only send the most essential numbers, not the full context
        top_cats = ", ".join(
            f"{c['category']}:{c['percentage']}%"
            for c in categories.get("categories", [])[:4]
        )

        context_text = f"""Financial data:
- Income: ₹{overview['total_income']:,.0f} | Expenses: ₹{overview['total_expenses']:,.0f} | Savings: {overview['savings_rate']}%
- Top spending: {top_cats}
- Transactions: {overview['transaction_count']} over {overview['months_covered']} month(s)

User: {question}
Answer briefly (2-3 sentences max):"""
        return context_text

    async def _call_ollama(self, prompt: str) -> str:
        """Call local Ollama LLM (non-streaming)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "num_predict": 150,
                    },
                },
            )

            if response.status_code != 200:
                raise ConnectionError(f"Ollama returned {response.status_code}")

            data = response.json()
            return data.get("response", "I couldn't generate a response.")

    async def _stream_ollama(self, prompt: str):
        """Yield text chunks from Ollama streaming API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": SYSTEM_PROMPT,
                    "stream": True,
                    "options": {"temperature": 0.3, "top_p": 0.9, "num_predict": 150},
                },
            ) as response:
                if response.status_code != 200:
                    raise ConnectionError(f"Ollama returned {response.status_code}")
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = data.get("response", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

    async def answer_stream(self, question: str):
        """Async generator — yields text chunks as they arrive from the LLM."""
        context = self.engine.get_context_for_ai()
        ollama_ok = False
        try:
            ollama_ok = await self._check_ollama()
        except Exception:
            pass

        if ollama_ok:
            prompt = self._build_prompt(question, context)
            try:
                async for chunk in self._stream_ollama(prompt):
                    yield chunk
                return
            except Exception as exc:
                logger.error("Streaming Ollama call failed: %s", exc)

        # Fallback: emit the rule-based response word-by-word for a typing effect
        reply = self._smart_fallback(question, context)
        words = reply.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    def _smart_fallback(self, question: str, context: dict) -> str:
        """Intelligent rule-based response when Ollama is not available.

        This provides useful answers by matching question intent to pre-computed data.
        """
        overview = context["overview"]
        categories = context["categories"]
        behavioral = context["behavioral"]
        insights = context["insights"]
        merchants = context["top_merchants"]

        q = question.lower()
        txn_count = overview.get("transaction_count", 0)

        if txn_count == 0:
            return (
                "I don't have any transaction data yet. "
                "Upload a bank statement (CSV, Excel, or PDF) to get started, "
                "and I'll be able to answer questions about your finances."
            )

        # --- Spending questions ---
        if any(w in q for w in ["spend", "expense", "spending", "expenditure", "cost"]):
            # Specific merchant/category query
            for cat in categories.get("categories", []):
                if cat["category"].lower() in q:
                    return (
                        f"You spent ₹{cat['amount']:,.0f} on {cat['category']}, "
                        f"which is {cat['percentage']}% of your total expenses.\n\n"
                        f"{'This is a significant portion of your spending. Consider setting a budget for this category.' if cat['percentage'] > 25 else 'This seems reasonable relative to your overall spending.'}"
                    )

            for m in merchants.get("merchants", []):
                if m["name"].lower() in q:
                    return (
                        f"You spent ₹{m['amount']:,.0f} at {m['name']}.\n\n"
                        f"This makes it one of your top merchants by spending."
                    )

            # General spending breakdown
            cats = categories.get("categories", [])[:5]
            lines = [
                f"Your total expenses: ₹{overview['total_expenses']:,.0f}",
                f"Average monthly: ₹{overview['avg_monthly_expenses']:,.0f}",
                "",
                "Top spending categories:",
            ]
            for c in cats:
                lines.append(f"  • {c['category']}: ₹{c['amount']:,.0f} ({c['percentage']}%)")

            if behavioral["impulse_spending"]["count"] > 0:
                lines.append(f"\n⚠️ {behavioral['impulse_spending']['count']} potential impulse purchases detected (₹{behavioral['impulse_spending']['total']:,.0f})")

            return "\n".join(lines)

        # --- Savings questions ---
        if any(w in q for w in ["save", "saving", "savings"]):
            rate = overview["savings_rate"]
            net = overview["net_cashflow"]

            if rate >= 20:
                assessment = "You're doing well — 20%+ is considered healthy."
            elif rate >= 10:
                assessment = "You're saving, but aim for 20%+ for better financial security."
            elif rate > 0:
                assessment = "Your savings rate is low. Look for areas to cut back."
            else:
                assessment = "You're spending more than you earn. Immediate action needed."

            lines = [
                f"Savings Rate: {rate}%",
                f"Net Cashflow: ₹{net:,.0f}",
                f"Monthly Surplus: ₹{net / max(overview['months_covered'], 1):,.0f}/month",
                "",
                assessment,
            ]

            if rate < 20 and categories.get("categories"):
                top_discretionary = [
                    c for c in categories["categories"]
                    if c["category"] in ("Food", "Entertainment", "Shopping")
                ]
                if top_discretionary:
                    lines.append("\nAreas to optimize:")
                    for c in top_discretionary[:3]:
                        lines.append(f"  • {c['category']}: ₹{c['amount']:,.0f} ({c['percentage']}%)")

            return "\n".join(lines)

        # --- Income questions ---
        if any(w in q for w in ["income", "earn", "salary", "credit", "deposit"]):
            return (
                f"Total Income: ₹{overview['total_income']:,.0f}\n"
                f"Average Monthly: ₹{overview['avg_monthly_income']:,.0f}\n"
                f"Period: {overview['months_covered']} month(s)"
            )

        # --- Balance questions ---
        if any(w in q for w in ["balance", "account", "bank"]):
            bal = overview.get("current_balance")
            if bal:
                return f"Your latest recorded balance: ₹{bal:,.0f}"
            return "Balance data isn't available in your uploaded statements."

        # --- Subscription questions ---
        if any(w in q for w in ["subscription", "recurring", "emi", "auto"]):
            subs = behavioral.get("recurring_subscriptions", [])
            if not subs:
                return "No recurring subscriptions detected in your transactions."

            total = sum(s.get("amount", 0) for s in subs)
            lines = [f"Detected {len(subs)} recurring payment(s) totaling ₹{total:,.0f}:", ""]
            for s in subs[:8]:
                lines.append(f"  • {s['merchant']}: ₹{s['amount']:,.0f} ({s.get('category', 'N/A')})")

            lines.append(f"\nReview these to see if all are still needed.")
            return "\n".join(lines)

        # --- Merchant questions ---
        if any(w in q for w in ["merchant", "where", "shop", "store", "who"]):
            top = merchants.get("merchants", [])[:8]
            if not top:
                return "No merchant data available yet."

            lines = ["Your top merchants by spending:", ""]
            for i, m in enumerate(top, 1):
                lines.append(f"  {i}. {m['name']}: ₹{m['amount']:,.0f}")
            return "\n".join(lines)

        # --- Improvement / advice questions ---
        if any(w in q for w in ["improve", "better", "advice", "suggest", "recommend", "tip", "help", "what should"]):
            recs = insights.get("recommendations", [])
            insight_msgs = insights.get("insights", [])

            lines = ["Based on your financial data:", ""]

            if insight_msgs:
                for ins in insight_msgs[:4]:
                    icon = {"success": "✅", "info": "ℹ️", "warning": "⚠️", "danger": "🚨"}.get(ins["type"], "•")
                    lines.append(f"  {icon} {ins['message']}")

            if recs:
                lines.append("\nRecommendations:")
                for r in recs[:5]:
                    lines.append(f"  • {r}")

            return "\n".join(lines)

        # --- Behavioral / pattern questions ---
        if any(w in q for w in ["pattern", "behavior", "habit", "lifestyle", "impulse", "weekend"]):
            lines = ["Your spending patterns:", ""]
            lines.append(f"  • Lifestyle Profile: {behavioral['lifestyle_score']['label']}")
            lines.append(f"  • Weekend avg spend: ₹{behavioral['weekend_vs_weekday']['weekend_avg']:,.0f}")
            lines.append(f"  • Weekday avg spend: ₹{behavioral['weekend_vs_weekday']['weekday_avg']:,.0f}")
            lines.append(f"  • Spending trend: {behavioral['spending_velocity']['trend']} ({behavioral['spending_velocity']['change_pct']:+.1f}%)")

            if behavioral["impulse_spending"]["count"] > 0:
                lines.append(f"  • Impulse purchases: {behavioral['impulse_spending']['count']} (₹{behavioral['impulse_spending']['total']:,.0f})")

            return "\n".join(lines)

        # --- Default: overview ---
        lines = [
            "Here's your financial snapshot:",
            "",
            f"  💰 Income: ₹{overview['total_income']:,.0f}",
            f"  💸 Expenses: ₹{overview['total_expenses']:,.0f}",
            f"  📊 Savings Rate: {overview['savings_rate']}%",
            f"  📅 Period: {overview['months_covered']} month(s)",
            "",
            "You can ask me about:",
            "  • Spending by category or merchant",
            "  • Savings analysis",
            "  • Subscriptions & recurring payments",
            "  • Behavioral patterns",
            "  • Improvement suggestions",
        ]

        if overview.get("current_balance"):
            lines.insert(4, f"  🏦 Balance: ₹{overview['current_balance']:,.0f}")

        return "\n".join(lines)
