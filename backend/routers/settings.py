"""Settings router — merchant aliases, category rules, account management."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from database import get_db
from models import MerchantAlias, CategoryRule, UploadRecord, Transaction, User
from auth import get_current_user
from logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter()

ALL_CATEGORIES = [
    "Food", "Travel", "Shopping", "Entertainment", "Bills",
    "Subscriptions", "Investment", "Transfer", "Health", "Education", "Tax", "Others",
]


# ── Merchant Aliases ──────────────────────────────────────────────────────────

class AliasCreate(BaseModel):
    raw_merchant: str = Field(..., min_length=1, max_length=100)
    alias: str = Field(..., min_length=1, max_length=100)


@router.get("/aliases")
async def list_aliases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MerchantAlias)
        .where(MerchantAlias.user_id == current_user.id)
        .order_by(MerchantAlias.raw_merchant)
    )
    rows = result.scalars().all()
    return {"aliases": [{"id": r.id, "raw_merchant": r.raw_merchant, "alias": r.alias} for r in rows]}


@router.post("/aliases", status_code=201)
async def create_alias(
    body: AliasCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(MerchantAlias).where(
            MerchantAlias.user_id == current_user.id,
            MerchantAlias.raw_merchant == body.raw_merchant,
        )
    )
    row = existing.scalar_one_or_none()
    old_alias = row.alias if row else None

    if row:
        await db.execute(
            update(MerchantAlias)
            .where(MerchantAlias.id == row.id)
            .values(alias=body.alias)
        )
    else:
        db.add(MerchantAlias(user_id=current_user.id, raw_merchant=body.raw_merchant, alias=body.alias))
    await db.commit()

    match_name = old_alias if old_alias else body.raw_merchant
    await db.execute(
        update(Transaction)
        .where(Transaction.user_id == current_user.id, Transaction.merchant == match_name)
        .values(merchant=body.alias)
    )
    await db.commit()
    return {"status": "ok"}


@router.delete("/aliases/{alias_id}")
async def delete_alias(
    alias_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MerchantAlias).where(MerchantAlias.id == alias_id, MerchantAlias.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Alias not found.")
    await db.execute(
        update(Transaction)
        .where(Transaction.user_id == current_user.id, Transaction.merchant == row.alias)
        .values(merchant=row.raw_merchant)
    )
    await db.delete(row)
    await db.commit()
    return {"status": "deleted"}


# ── Category Rules ────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)


@router.get("/rules")
async def list_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryRule)
        .where(CategoryRule.user_id == current_user.id)
        .order_by(CategoryRule.keyword)
    )
    rows = result.scalars().all()
    return {"rules": [{"id": r.id, "keyword": r.keyword, "category": r.category} for r in rows]}


@router.get("/categories")
async def list_categories():
    return {"categories": ALL_CATEGORIES}


@router.post("/rules", status_code=201)
async def create_rule(
    body: RuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.category not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category '{body.category}'.")
    keyword_lower = body.keyword.lower()
    existing = await db.execute(
        select(CategoryRule).where(
            CategoryRule.user_id == current_user.id,
            CategoryRule.keyword == keyword_lower,
        )
    )
    if existing.scalar_one_or_none():
        await db.execute(
            update(CategoryRule)
            .where(CategoryRule.user_id == current_user.id, CategoryRule.keyword == keyword_lower)
            .values(category=body.category)
        )
    else:
        db.add(CategoryRule(user_id=current_user.id, keyword=keyword_lower, category=body.category))

    result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user.id)
    )
    txns = result.scalars().all()
    updated = 0
    for txn in txns:
        if keyword_lower in (txn.narration or "").lower():
            txn.category = body.category
            updated += 1

    await db.commit()
    return {"status": "ok", "transactions_updated": updated}


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id, CategoryRule.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found.")

    from parsing.categorizer import _assign_category
    keyword_lower = row.keyword
    txn_result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user.id)
    )
    for txn in txn_result.scalars().all():
        if keyword_lower in (txn.narration or "").lower():
            txn.category = _assign_category(txn.narration)

    await db.delete(row)
    await db.commit()
    return {"status": "deleted"}


# ── Account Management ────────────────────────────────────────────────────────

class AccountNameUpdate(BaseModel):
    account_name: str = Field(..., min_length=1, max_length=100)


@router.get("/accounts")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UploadRecord)
        .where(UploadRecord.user_id == current_user.id)
        .order_by(UploadRecord.uploaded_at.desc())
    )
    rows = result.scalars().all()
    return {
        "accounts": [
            {
                "id": r.id,
                "filename": r.filename,
                "account_number": r.account_number,
                "account_name": r.account_name or r.account_number or r.filename,
                "date_from": r.date_from.isoformat() if r.date_from else None,
                "date_to": r.date_to.isoformat() if r.date_to else None,
            }
            for r in rows
        ]
    }


@router.patch("/accounts/{upload_id}")
async def rename_account(
    upload_id: int,
    body: AccountNameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UploadRecord).where(UploadRecord.id == upload_id, UploadRecord.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found.")
    row.account_name = body.account_name
    await db.execute(
        update(Transaction)
        .where(Transaction.source_file == row.filename, Transaction.user_id == current_user.id)
        .values(account_name=body.account_name)
    )
    await db.commit()
    return {"status": "ok"}


# ── Encrypted Backup Export ───────────────────────────────────────────────────

@router.get("/export/encrypted")
async def export_encrypted(
    passphrase: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        from cryptography.fernet import Fernet
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
        import base64, json as _json
        from fastapi.responses import Response

        salt = b"finsight_static_salt_v1"
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=480_000)
        key = base64.urlsafe_b64encode(kdf.derive(passphrase.encode()))
        f = Fernet(key)

        result = await db.execute(
            select(Transaction).where(Transaction.user_id == current_user.id)
        )
        txns = result.scalars().all()
        data = [
            {
                "id": t.id, "date": t.date.isoformat(), "narration": t.narration,
                "merchant": t.merchant, "category": t.category,
                "debit": t.debit, "credit": t.credit, "balance": t.balance,
                "transaction_type": t.transaction_type, "source_file": t.source_file,
                "account_name": t.account_name, "is_recurring": t.is_recurring,
            }
            for t in txns
        ]
        payload = _json.dumps(data, default=str).encode()
        encrypted = f.encrypt(payload)
        return Response(
            content=encrypted,
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="finsight_backup.enc"'},
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="cryptography package not installed.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}")


@router.post("/import/encrypted/upload", status_code=200)
async def import_encrypted_upload(
    passphrase: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        from cryptography.fernet import Fernet, InvalidToken
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
        import base64, json as _json
        from datetime import date as _date

        salt = b"finsight_static_salt_v1"
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=480_000)
        key = base64.urlsafe_b64encode(kdf.derive(passphrase.encode()))
        f = Fernet(key)

        raw = await file.read()
        try:
            payload = f.decrypt(raw)
        except InvalidToken:
            raise HTTPException(status_code=400, detail="Wrong passphrase or corrupted backup file.")

        data = _json.loads(payload.decode())
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Invalid backup format.")

        imported = skipped = 0
        for row in data:
            try:
                txn = Transaction(
                    user_id=current_user.id,
                    date=_date.fromisoformat(row["date"]) if row.get("date") else None,
                    narration=row.get("narration"),
                    merchant=row.get("merchant"),
                    category=row.get("category"),
                    debit=row.get("debit"),
                    credit=row.get("credit"),
                    balance=row.get("balance"),
                    transaction_type=row.get("transaction_type"),
                    source_file=row.get("source_file"),
                    account_name=row.get("account_name"),
                    is_recurring=row.get("is_recurring", False),
                )
                db.add(txn)
                imported += 1
            except Exception:
                skipped += 1

        await db.commit()
        return {"status": "ok", "imported": imported, "skipped": skipped}

    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(status_code=501, detail="cryptography package not installed.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Import failed: {exc}")
