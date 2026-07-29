"""SQLAlchemy models for transactions."""

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    username     = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    date             = Column(Date, nullable=False)
    narration        = Column(String, nullable=False)
    merchant         = Column(String, nullable=True)
    category         = Column(String, nullable=True, default="Others")
    debit            = Column(Float, nullable=True, default=0.0)
    credit           = Column(Float, nullable=True, default=0.0)
    balance          = Column(Float, nullable=True)
    transaction_type = Column(String, nullable=False)  # "deposit" or "withdrawal"
    source_file      = Column(String, nullable=True)
    account_name     = Column(String, nullable=True)
    is_recurring     = Column(Boolean, default=False)
    txn_hash         = Column(String, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())


class UploadRecord(Base):
    __tablename__ = "uploads"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    filename       = Column(String, nullable=False)
    file_type      = Column(String, nullable=False)
    file_hash      = Column(String, nullable=True)
    file_size      = Column(Integer, nullable=True)
    row_count      = Column(Integer, default=0)
    account_number = Column(String, nullable=True)
    account_name   = Column(String, nullable=True)
    date_from      = Column(Date, nullable=True)
    date_to        = Column(Date, nullable=True)
    uploaded_at    = Column(DateTime, server_default=func.now())


class MerchantAlias(Base):
    """Maps a raw detected merchant name to a user-defined display name."""
    __tablename__ = "merchant_aliases"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    raw_merchant = Column(String, nullable=False)
    alias        = Column(String, nullable=False)
    created_at   = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "raw_merchant", name="uq_alias_user_raw"),)


class CategoryRule(Base):
    """User-defined keyword → category mapping (overrides rule-based engine)."""
    __tablename__ = "category_rules"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    keyword    = Column(String, nullable=False)
    category   = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "keyword", name="uq_rule_user_keyword"),)
