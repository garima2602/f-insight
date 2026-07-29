"""OFX/QFX bank statement parser.

Handles OFX 1.x (SGML-like) and OFX 2.x (XML) formats exported by most
Indian and international banks from their net-banking portals.
"""

import re
import xml.etree.ElementTree as ET
from datetime import datetime, date
from logging_config import get_logger

logger = get_logger(__name__)


def _parse_date(raw: str) -> date | None:
    """Parse OFX date strings: YYYYMMDD[HHMMSS[.xxx][TZ]]"""
    if not raw:
        return None
    raw = raw.strip()[:8]  # keep only YYYYMMDD
    try:
        return datetime.strptime(raw, "%Y%m%d").date()
    except ValueError:
        return None


def _ofx1_to_xml(content: str) -> str:
    """Convert OFX 1.x (header + SGML) to a parseable pseudo-XML string."""
    # Drop the header block (everything before <OFX>)
    match = re.search(r"<OFX>", content, re.IGNORECASE)
    if not match:
        raise ValueError("No <OFX> tag found in OFX 1.x content")
    body = content[match.start():]

    # Self-close lone opening tags that have no matching close tag
    def self_close(text: str) -> str:
        # Find all tags
        tags = re.findall(r"<([A-Z0-9.]+)>(?!</)", text, re.IGNORECASE)
        for tag in tags:
            close = f"</{tag}>"
            # If no matching close tag exists, self-close it
            if close not in text:
                text = text.replace(f"<{tag}>", f"<{tag}>", 1)
        # Simpler approach: wrap bare values in self-closing style
        # Replace <TAG>value\n with <TAG>value</TAG>\n
        text = re.sub(r"<([A-Z0-9.]+)>([^<\n]+)\n", r"<\1>\2</\1>\n", text, flags=re.IGNORECASE)
        return text

    return self_close(body)


def _extract_transactions_xml(root: ET.Element) -> list[dict]:
    """Walk OFX XML tree and return transaction dicts."""
    txns = []
    for stmttrn in root.iter("STMTTRN"):
        def get(tag: str) -> str:
            el = stmttrn.find(tag)
            return (el.text or "").strip() if el is not None else ""

        raw_amount = get("TRNAMT") or get("TOTAL")
        try:
            amount = float(raw_amount.replace(",", ""))
        except ValueError:
            amount = 0.0

        txn_date = _parse_date(get("DTPOSTED") or get("DTUSER"))
        if txn_date is None:
            continue

        memo = get("MEMO") or get("NAME") or get("PAYEE") or ""
        narration = memo.strip() or f"OFX transaction {get('FITID')}"

        is_debit = amount < 0
        txns.append({
            "date": txn_date,
            "narration": narration,
            "debit":  abs(amount) if is_debit else 0.0,
            "credit": amount if not is_debit else 0.0,
            "balance": None,
            "transaction_type": "withdrawal" if is_debit else "deposit",
        })

    return txns


def parse_ofx(content: bytes) -> list[dict]:
    """Parse OFX/QFX file content and return normalised transaction dicts."""
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Cannot decode OFX file — unknown encoding")

    # Try OFX 2.x (valid XML)
    try:
        root = ET.fromstring(text)
        txns = _extract_transactions_xml(root)
        logger.info("Parsed %d transactions from OFX 2.x XML", len(txns))
        return txns
    except ET.ParseError:
        pass

    # Fall back to OFX 1.x SGML
    try:
        xml_text = _ofx1_to_xml(text)
        root = ET.fromstring(xml_text)
        txns = _extract_transactions_xml(root)
        logger.info("Parsed %d transactions from OFX 1.x SGML", len(txns))
        return txns
    except Exception as exc:
        raise ValueError(f"Failed to parse OFX file: {exc}") from exc
