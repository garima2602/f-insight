"""File upload and parsing router."""

import hashlib
import mimetypes
import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

_BASE_UPLOADS = Path(__file__).parent.parent / "data" / "uploads"
_BASE_UPLOADS.mkdir(parents=True, exist_ok=True)


def _user_dir(user_id: int) -> Path:
    """Return (and create) the upload directory scoped to a single user."""
    d = _BASE_UPLOADS / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_name(filename: str) -> str:
    return re.sub(r'[^\w.\-]', '_', filename)

from database import get_db
from ingestion.detector import detect_file_type
from parsing.parser_factory import parse_file
from parsing.categorizer import categorize_transactions
from models import Transaction, UploadRecord, MerchantAlias, CategoryRule, User
from auth import get_current_user
from logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MIN_DUPLICATE_SIZE_BYTES = 1024

ACCEPTED_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".ofx", ".qfx", ".qif", ".json", ".mt940", ".mt9", ".sta", ".swift"}
ACCEPTED_FORMATS_MSG = "Accepted formats: PDF, CSV, XLSX, XLS, OFX, QFX, QIF, JSON, MT940, JPEG, PNG, TIFF."


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _validate_file(filename: str, content: bytes) -> None:
    if not filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ACCEPTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Unsupported file type '{ext or '(none)'}'. {ACCEPTED_FORMATS_MSG}")
    if len(content) > MAX_FILE_SIZE_BYTES:
        size_mb = len(content) / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File size {size_mb:.1f} MB exceeds the 50 MB limit.")


# ── Preview endpoint (no DB write — auth still required) ──────────────────────

@router.post("/preview")
async def preview_statement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    _validate_file(file.filename, content)
    file_type = detect_file_type(file.filename, content)
    if file_type == "unknown":
        raise HTTPException(status_code=415, detail=f"File format not recognised. {ACCEPTED_FORMATS_MSG}")
    try:
        raw_transactions = await parse_file(content, file_type, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse: {exc}") from exc

    categorized = categorize_transactions(raw_transactions)
    preview_rows = [
        {
            "date": str(t["date"]) if t.get("date") else None,
            "narration": t.get("narration", ""),
            "merchant": t.get("merchant"),
            "category": t.get("category", "Others"),
            "debit": t.get("debit"),
            "credit": t.get("credit"),
            "balance": t.get("balance"),
            "transaction_type": t.get("transaction_type"),
        }
        for t in categorized[:200]
    ]
    return {
        "file_type": file_type,
        "total_parsed": len(raw_transactions),
        "deposits": sum(1 for t in raw_transactions if t.get("transaction_type") == "deposit"),
        "withdrawals": sum(1 for t in raw_transactions if t.get("transaction_type") == "withdrawal"),
        "rows": preview_rows,
    }


# ── Upload endpoint ───────────────────────────────────────────────────────────

@router.post("/")
async def upload_statement(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    account_name: str = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
):
    from state import upload_progress
    job_id = str(uuid.uuid4())

    content = await file.read()
    _validate_file(file.filename, content)
    upload_progress[job_id] = {"status": "processing", "pct": 10, "message": "File validated"}

    # Save original file into this user's private directory
    dest_path = _user_dir(current_user.id) / _safe_name(file.filename)
    try:
        dest_path.write_bytes(content)
    except Exception as exc:
        logger.warning("Could not save original file to disk: %s", exc)

    file_size = len(content)
    file_hash = _sha256(content)

    # Duplicate detection scoped to this user
    if file_size > MIN_DUPLICATE_SIZE_BYTES:
        existing = await db.execute(
            select(UploadRecord).where(
                UploadRecord.file_hash == file_hash,
                UploadRecord.user_id == current_user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"This file has already been uploaded. File: '{file.filename}'. Upload skipped.",
            )

    file_type = detect_file_type(file.filename, content)
    if file_type == "unknown":
        raise HTTPException(status_code=415, detail=f"File format not recognised. {ACCEPTED_FORMATS_MSG}")

    upload_progress[job_id] = {"status": "processing", "pct": 30, "message": "Parsing transactions…"}
    try:
        raw_transactions = await parse_file(content, file_type, file.filename)
    except Exception as exc:
        upload_progress[job_id] = {"status": "error", "pct": 0, "message": str(exc)}
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {exc}") from exc

    if not raw_transactions:
        raise HTTPException(status_code=422, detail="No transactions could be extracted from this file.")

    upload_progress[job_id] = {"status": "processing", "pct": 60, "message": "Categorising…"}
    categorized = categorize_transactions(raw_transactions)

    # Apply user-specific category rules
    rules_result = await db.execute(
        select(CategoryRule).where(CategoryRule.user_id == current_user.id)
    )
    user_rules: dict[str, str] = {r.keyword: r.category for r in rules_result.scalars().all()}
    if user_rules:
        for txn in categorized:
            narration_lower = txn.get("narration", "").lower()
            for keyword, category in user_rules.items():
                if keyword in narration_lower:
                    txn["category"] = category
                    break

    # Apply user-specific merchant aliases
    aliases_result = await db.execute(
        select(MerchantAlias).where(MerchantAlias.user_id == current_user.id)
    )
    alias_map: dict[str, str] = {a.raw_merchant: a.alias for a in aliases_result.scalars().all()}
    if alias_map:
        for txn in categorized:
            raw = txn.get("merchant", "")
            if raw in alias_map:
                txn["merchant"] = alias_map[raw]

    deposits    = sum(1 for t in categorized if t["transaction_type"] == "deposit")
    withdrawals = sum(1 for t in categorized if t["transaction_type"] == "withdrawal")

    # Cross-file dedup scoped to this user
    existing_hashes_result = await db.execute(
        select(Transaction.txn_hash).where(
            Transaction.user_id == current_user.id,
            Transaction.txn_hash.isnot(None),
        )
    )
    existing_hashes: set[str] = {row[0] for row in existing_hashes_result.fetchall()}

    unique_txns = []
    dupes_skipped = 0
    for txn in categorized:
        h = txn.get("txn_hash")
        if h and h in existing_hashes:
            dupes_skipped += 1
            continue
        unique_txns.append(txn)
        if h:
            existing_hashes.add(h)

    if dupes_skipped:
        logger.info("Cross-file dedup: skipped %d duplicate transactions for user %d", dupes_skipped, current_user.id)

    account_number = _extract_account_number([t.get("narration", "") for t in categorized])
    dates     = [t["date"] for t in categorized if t.get("date")]
    date_from = min(dates) if dates else None
    date_to   = max(dates) if dates else None

    upload_progress[job_id] = {"status": "processing", "pct": 85, "message": "Saving to database…"}
    effective_account_name = account_name or account_number or file.filename
    try:
        for txn in unique_txns:
            db.add(Transaction(
                user_id=current_user.id,
                date=txn["date"],
                narration=txn["narration"],
                merchant=txn.get("merchant", "Unknown"),
                category=txn.get("category", "Others"),
                debit=txn.get("debit", 0.0),
                credit=txn.get("credit", 0.0),
                balance=txn.get("balance"),
                transaction_type=txn["transaction_type"],
                source_file=file.filename,
                account_name=effective_account_name,
                is_recurring=txn.get("is_recurring", False),
                txn_hash=txn.get("txn_hash"),
            ))

        db.add(UploadRecord(
            user_id=current_user.id,
            filename=file.filename,
            file_type=file_type,
            file_hash=file_hash,
            file_size=file_size,
            row_count=len(unique_txns),
            account_number=account_number,
            account_name=effective_account_name,
            date_from=date_from,
            date_to=date_to,
        ))

        await db.commit()

    except Exception as exc:
        await db.rollback()
        upload_progress[job_id] = {"status": "error", "pct": 0, "message": "Database error"}
        if "UNIQUE constraint failed" in str(exc) or "unique constraint" in str(exc).lower():
            raise HTTPException(status_code=409, detail=f"This file has already been uploaded. File: '{file.filename}'.")
        raise HTTPException(status_code=500, detail="Database error while saving transactions.") from exc

    # Index in ChromaDB (non-blocking)
    try:
        saved_result = await db.execute(
            select(Transaction).where(
                Transaction.source_file == file.filename,
                Transaction.user_id == current_user.id,
            )
        )
        saved_txns = saved_result.scalars().all()
        chroma_docs = [
            {"id": t.id, "narration": t.narration, "merchant": t.merchant or "",
             "category": t.category or "", "source_file": t.source_file or "",
             "date": t.date.isoformat() if t.date else ""}
            for t in saved_txns
        ]
        from ai.vector_store import get_store
        store = get_store()
        if store:
            import asyncio
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, store.add_transactions, chroma_docs)
    except Exception as exc:
        logger.warning("ChromaDB indexing skipped: %s", exc)

    upload_progress[job_id] = {"status": "done", "pct": 100, "message": "Complete"}

    from cache import invalidate_user_cache
    await invalidate_user_cache(current_user.id)

    return {
        "status": "success",
        "job_id": job_id,
        "filename": file.filename,
        "file_type": file_type,
        "file_size_bytes": file_size,
        "transactions_parsed": len(unique_txns),
        "duplicates_skipped": dupes_skipped,
        "deposits": deposits,
        "withdrawals": withdrawals,
        "account_number": account_number,
        "account_name": effective_account_name,
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
    }


# ── List uploaded files ────────────────────────────────────────────────────────

@router.get("/files")
async def list_uploaded_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await db.execute(
            select(UploadRecord)
            .where(UploadRecord.user_id == current_user.id)
            .order_by(UploadRecord.uploaded_at.desc())
        )
        records = result.scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load upload history.") from exc

    return {
        "files": [
            {
                "id":             r.id,
                "filename":       r.filename,
                "file_type":      r.file_type,
                "file_size":      r.file_size,
                "row_count":      r.row_count,
                "account_number": r.account_number,
                "date_from":      r.date_from.isoformat() if r.date_from else None,
                "date_to":        r.date_to.isoformat()   if r.date_to   else None,
                "uploaded_at":    r.uploaded_at.isoformat() if r.uploaded_at else None,
            }
            for r in records
        ]
    }


# ── Delete single file ─────────────────────────────────────────────────────────

@router.delete("/files/{filename:path}")
async def delete_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        record = await db.execute(
            select(UploadRecord).where(
                UploadRecord.filename == filename,
                UploadRecord.user_id == current_user.id,
            )
        )
        record = record.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found.")
        await db.execute(
            delete(Transaction).where(
                Transaction.source_file == filename,
                Transaction.user_id == current_user.id,
            )
        )
        await db.delete(record)
        await db.commit()
        disk_path = _user_dir(current_user.id) / _safe_name(filename)
        disk_path.unlink(missing_ok=True)
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete file.") from exc
    from cache import invalidate_user_cache
    await invalidate_user_cache(current_user.id)
    return {"status": "deleted", "filename": filename}


# ── Clear all data for this user ──────────────────────────────────────────────

@router.delete("/")
async def clear_all_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await db.execute(delete(Transaction).where(Transaction.user_id == current_user.id))
        await db.execute(delete(UploadRecord).where(UploadRecord.user_id == current_user.id))
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear data.") from exc
    return {"status": "cleared"}


# ── Serve original file (ownership-verified) ──────────────────────────────────

@router.get("/files/{filename:path}/raw")
async def serve_original_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the file belongs to this user before serving it
    record = await db.execute(
        select(UploadRecord).where(
            UploadRecord.filename == filename,
            UploadRecord.user_id == current_user.id,
        )
    )
    if not record.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="File not found.")

    disk_path = _user_dir(current_user.id) / _safe_name(filename)
    if not disk_path.exists():
        raise HTTPException(status_code=404, detail="Original file not available on disk.")

    mime, _ = mimetypes.guess_type(filename)
    mime = mime or "application/octet-stream"
    return FileResponse(
        path=str(disk_path),
        media_type=mime,
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/files/{filename:path}/has-original")
async def has_original_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = await db.execute(
        select(UploadRecord).where(
            UploadRecord.filename == filename,
            UploadRecord.user_id == current_user.id,
        )
    )
    if not record.scalar_one_or_none():
        return {"available": False}
    disk_path = _user_dir(current_user.id) / _safe_name(filename)
    return {"available": disk_path.exists()}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_account_number(narrations: list[str]) -> str | None:
    patterns = [
        r'(?:credit\s*ca|ca|a/?c|acct?|account)[/\s:]+(?:[xX*\d]{4,})?(\d{4})\b',
        r'\b[xX*]{4,}(\d{4})\b',
        r'/(\d{10,16})(?:/|$)',
        r'a/?c\s*[:\-]?\s*(?:[xX*\d]{0,12})(\d{4})\b',
        r'\b\d{8,12}(\d{4})\b',
    ]
    for narration in narrations[:100]:
        for pat in patterns:
            m = re.search(pat, narration, re.IGNORECASE)
            if m:
                last4 = m.group(1)
                if last4.isdigit() and len(last4) == 4:
                    return f"XXXX{last4}"
    return None
