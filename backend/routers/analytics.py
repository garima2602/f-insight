"""Analytics router — all financial computations."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct

from database import get_db
from models import Transaction, User
from analytics.engine import AnalyticsEngine
from auth import get_current_user
from cache import cache_response


class UpdateCategoryRequest(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)

router = APIRouter()


# ── Shared helper ─────────────────────────────────────────────────────────────

async def _load_transactions(
    db: AsyncSession,
    user_id: int,
    source_file: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list:
    from datetime import date as date_type
    try:
        query = select(Transaction).where(Transaction.user_id == user_id)
        if source_file:
            query = query.where(Transaction.source_file == source_file)
        if date_from:
            try:
                query = query.where(Transaction.date >= date_type.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                query = query.where(Transaction.date <= date_type.fromisoformat(date_to))
            except ValueError:
                pass
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load transaction data.") from exc


def _make_engine(transactions: list) -> AnalyticsEngine:
    try:
        return AnalyticsEngine(transactions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to initialise analytics engine.") from exc


def _date_params(source_file, date_from, date_to):
    return dict(source_file=source_file, date_from=date_from, date_to=date_to)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/overview")
@cache_response(ttl=300)
async def get_overview(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_overview()


@router.get("/categories")
@cache_response(ttl=300)
async def get_category_breakdown(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_category_breakdown()


@router.get("/monthly")
@cache_response(ttl=300)
async def get_monthly_trends(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_monthly_trends()


@router.get("/merchants")
async def get_merchant_spending(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_merchant_spending()


@router.get("/all-merchants")
async def get_all_merchants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(distinct(Transaction.merchant))
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.merchant.isnot(None))
        .order_by(Transaction.merchant)
    )
    names = [row[0] for row in result.all() if row[0]]
    return {"merchants": names}


@router.get("/behavioral")
@cache_response(ttl=300)
async def get_behavioral_insights(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_behavioral_insights()


@router.get("/insights")
async def get_insights(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_insights()


@router.get("/transactions")
async def get_transactions(
    source_file: Optional[str] = Query(None),
    account_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    if account_name:
        txns = [t for t in txns if t.account_name == account_name]
    txns = sorted(txns, key=lambda t: (t.date or ""), reverse=True)
    total = len(txns)
    start = (page - 1) * page_size
    page_txns = txns[start : start + page_size]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "data": [
            {
                "id": t.id,
                "date": t.date.isoformat() if t.date else None,
                "narration": t.narration,
                "merchant": t.merchant,
                "category": t.category,
                "debit": t.debit,
                "credit": t.credit,
                "balance": t.balance,
                "transaction_type": t.transaction_type,
                "source_file": t.source_file,
                "account_name": t.account_name,
            }
            for t in page_txns
        ],
    }


@router.get("/health-score")
async def get_health_score(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_health_score()


@router.get("/anomalies")
async def get_anomalies(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_anomalies()


@router.get("/forecast")
async def get_forecast(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_forecast()


@router.get("/subscriptions")
async def get_subscriptions(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_subscriptions()


@router.get("/heatmap")
async def get_heatmap(
    source_file: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = await _load_transactions(db, current_user.id, **_date_params(source_file, date_from, date_to))
    return _make_engine(txns).get_heatmap()


@router.patch("/transactions/{transaction_id}")
async def update_transaction_category(
    transaction_id: int,
    payload: UpdateCategoryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    txn.category = payload.category
    await db.commit()
    try:
        from ai.vector_store import get_store
        import asyncio
        store = get_store()
        if store:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, store.add_correction, txn.narration, payload.category, txn.merchant or "")
            await loop.run_in_executor(None, store.update_transaction_category, transaction_id, payload.category)
    except Exception:
        pass
    return {"id": txn.id, "category": txn.category}


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    await db.delete(txn)
    await db.commit()
    return {"deleted": transaction_id}


@router.get("/statement-info")
async def get_statement_info(
    source_file: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models import UploadRecord
    try:
        query = select(UploadRecord).where(UploadRecord.user_id == current_user.id)
        if source_file:
            query = query.where(UploadRecord.filename == source_file)
        else:
            query = query.order_by(UploadRecord.uploaded_at.desc())
        result = await db.execute(query)
        records = result.scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load statement info.") from exc

    if not records:
        return {"account_number": None, "date_from": None, "date_to": None, "files": []}

    all_dates_from = [r.date_from for r in records if r.date_from]
    all_dates_to   = [r.date_to   for r in records if r.date_to]
    return {
        "account_number": records[0].account_number,
        "date_from": min(all_dates_from).isoformat() if all_dates_from else None,
        "date_to":   max(all_dates_to).isoformat()   if all_dates_to   else None,
        "files": [
            {
                "filename":       r.filename,
                "row_count":      r.row_count,
                "account_number": r.account_number,
                "date_from":      r.date_from.isoformat() if r.date_from else None,
                "date_to":        r.date_to.isoformat()   if r.date_to   else None,
                "uploaded_at":    r.uploaded_at.isoformat() if r.uploaded_at else None,
            }
            for r in records
        ],
    }


@router.get("/search")
async def semantic_search(
    q: str = Query(..., min_length=1, max_length=200),
    n: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    try:
        from ai.vector_store import get_store
        import asyncio
        store = get_store()
        if not store:
            return {"results": [], "note": "Vector store not available"}
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, store.search_similar, q, n)
        return {"results": results, "query": q}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {exc}")


@router.get("/vector-stats")
async def vector_stats(current_user: User = Depends(get_current_user)):
    try:
        from ai.vector_store import get_store
        store = get_store()
        if not store:
            return {"available": False}
        return {"available": True, **store.stats()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
