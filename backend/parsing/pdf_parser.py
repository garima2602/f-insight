"""PDF bank statement parser — supports text and scanned PDFs."""

import io
import re
from datetime import datetime
from typing import Optional
import pdfplumber
import pandas as pd
from parsing.normalizer import normalize_transactions
from config import POPPLER_PATH, TESSERACT_CMD
from logging_config import get_logger

logger = get_logger(__name__)
try:
    import pytesseract
    from pdf2image import convert_from_bytes
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


async def parse_pdf(content: bytes, filename: str) -> list[dict]:
    """Parse PDF bank statement. Falls back to OCR for scanned documents."""
    logger.info("Processing PDF: %s", filename)

    # Strategy 1: Table extraction with various settings
    transactions = _extract_tables_pdf(content)
    if transactions:
        logger.info("Table extraction succeeded: %d transactions", len(transactions))
        return transactions

    # Strategy 2: Raw text line-by-line parsing
    transactions = _extract_text_lines_pdf(content)
    if transactions:
        logger.info("Text-line parsing succeeded: %d transactions", len(transactions))
        return transactions

    # Strategy 3: Columnar text parsing (for statements with aligned columns)
    transactions = _extract_columnar_pdf(content)
    if transactions:
        logger.info("Columnar parsing succeeded: %d transactions", len(transactions))
        return transactions

    # Check if PDF has any text at all
    has_text = _pdf_has_text(content)

    if not has_text:
        # Truly scanned PDF — needs OCR
        if OCR_AVAILABLE:
            try:
                transactions = _extract_ocr_pdf(content)
                if transactions:
                    return transactions
            except Exception as e:
                raise ValueError(
                    f"OCR processing failed: {str(e)}. "
                    "Ensure Tesseract is installed and poppler/bin is on PATH."
                )
        raise ValueError(
            "This PDF appears to be a scanned image with no selectable text. "
            "Install Tesseract OCR and Poppler for scanned PDF support. "
            "Tesseract: https://github.com/UB-Mannheim/tesseract/wiki | "
            "Poppler: https://github.com/oschwartz10612/poppler-windows/releases"
        )

    # Has text but couldn't parse — give helpful error
    raise ValueError(
        "Could not extract transactions from this PDF. "
        "The file has text content but the format wasn't recognized. "
        "Try exporting your statement as CSV or Excel instead."
    )


def _pdf_has_text(content: bytes) -> bool:
    """Check if PDF contains any extractable text."""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages[:2]:
            text = page.extract_text()
            if text and len(text.strip()) > 50:
                return True
    return False


def _extract_tables_pdf(content: bytes) -> list[dict]:
    """Extract transactions from text-based PDF using table detection.

    Carries the detected header across all pages so continuation pages
    (which repeat or omit the header) are parsed correctly.
    """
    # Try multiple table extraction strategies
    table_settings_list = [
        {},  # Default
        {"vertical_strategy": "text", "horizontal_strategy": "text"},
        {"vertical_strategy": "lines", "horizontal_strategy": "lines"},
        {"snap_tolerance": 5},
    ]

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for settings in table_settings_list:
            all_rows = []
            canonical_header: list[str] | None = None  # shared across pages

            for page in pdf.pages:
                try:
                    tables = page.extract_tables(table_settings=settings) if settings else page.extract_tables()
                except Exception:
                    continue

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    header_idx = _find_header_row(table)

                    if header_idx is not None:
                        # Update the canonical header whenever we see one
                        canonical_header = [
                            str(h).strip().lower().replace(" ", "_") if h else f"col_{i}"
                            for i, h in enumerate(table[header_idx])
                        ]
                        data_start = header_idx + 1
                    elif canonical_header is not None:
                        # Continuation page — no header row, reuse previous
                        data_start = 0
                    else:
                        # Haven't found a header yet on any page — skip
                        continue

                    for row in table[data_start:]:
                        if not row or not any(cell and str(cell).strip() for cell in row):
                            continue

                        row_dict = {}
                        for i, cell in enumerate(row):
                            if i < len(canonical_header):
                                row_dict[canonical_header[i]] = cell
                        all_rows.append(row_dict)

            if all_rows:
                break

    if not all_rows:
        return []

    df = pd.DataFrame(all_rows)
    logger.debug("Table columns detected: %s", list(df.columns))
    return normalize_transactions(df)


def _find_header_row(table: list) -> Optional[int]:
    """Find the header row in a table by looking for keywords."""
    header_keywords = {"date", "description", "narration", "debit", "credit",
                       "amount", "balance", "particulars", "withdrawal", "deposit"}

    for i, row in enumerate(table[:5]):  # Check first 5 rows
        if not row:
            continue
        row_text = " ".join(str(cell).lower() for cell in row if cell)
        matches = sum(1 for kw in header_keywords if kw in row_text)
        if matches >= 3:
            return i

    return None


def _extract_text_lines_pdf(content: bytes) -> list[dict]:
    """Extract transactions by parsing raw text lines from PDF."""
    all_text = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                all_text.append(text)

    if not all_text:
        return []

    full_text = "\n".join(all_text)
    return _parse_text_lines(full_text)


def _extract_columnar_pdf(content: bytes) -> list[dict]:
    """Extract transactions from PDFs with column-aligned data.

    Detects column positions once from the first page that has a header,
    then reuses them on all subsequent pages.
    """
    transactions = []
    col_positions = None  # shared across pages

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            if not words:
                continue

            lines = _group_words_into_lines(words)

            if col_positions is None:
                # Try to detect header on this page
                header_line, col_positions = _find_column_positions(lines)
                if not col_positions:
                    continue  # No header yet, try next page
            else:
                header_line = None  # Already have positions, no need to re-detect

            for line in lines:
                if line == header_line:
                    continue
                txn = _parse_columnar_line(line, col_positions)
                if txn:
                    transactions.append(txn)

    return transactions


def _group_words_into_lines(words: list) -> list[list]:
    """Group words into lines based on y-position."""
    if not words:
        return []

    sorted_words = sorted(words, key=lambda w: (round(w["top"], 0), w["x0"]))
    lines = []
    current_line = [sorted_words[0]]

    for word in sorted_words[1:]:
        if abs(word["top"] - current_line[0]["top"]) < 5:
            current_line.append(word)
        else:
            lines.append(current_line)
            current_line = [word]

    if current_line:
        lines.append(current_line)

    return lines


def _find_column_positions(lines: list) -> tuple:
    """Find header line and column x-positions."""
    header_keywords = {"date", "description", "narration", "debit", "credit",
                       "amount", "balance", "withdrawal", "deposit"}

    for line in lines[:20]:
        line_text = " ".join(w["text"].lower() for w in line)
        matches = sum(1 for kw in header_keywords if kw in line_text)
        if matches >= 2:
            # Found header — extract column positions
            positions = {}
            for word in line:
                text = word["text"].lower()
                for kw in header_keywords:
                    if kw in text:
                        positions[kw] = word["x0"]
            return line, positions

    return None, None


def _parse_columnar_line(line_words: list, col_positions: dict) -> Optional[dict]:
    """Parse a line of words using known column positions."""
    # Reconstruct line text
    line_text = " ".join(w["text"] for w in line_words)

    # Try to find a date
    date = _parse_line_date(line_text)
    if not date:
        return None

    # Assign words to columns based on x-position
    columns = {k: [] for k in col_positions}
    sorted_cols = sorted(col_positions.items(), key=lambda x: x[1])

    for word in line_words:
        # Find which column this word belongs to
        assigned = False
        for i, (col_name, col_x) in enumerate(sorted_cols):
            next_x = sorted_cols[i + 1][1] if i + 1 < len(sorted_cols) else float("inf")
            if col_x - 20 <= word["x0"] < next_x - 20:
                columns[col_name].append(word["text"])
                assigned = True
                break
        if not assigned and sorted_cols:
            # Assign to nearest column
            nearest = min(sorted_cols, key=lambda c: abs(c[1] - word["x0"]))
            columns[nearest[0]].append(word["text"])

    # Extract values
    narration_keys = {"description", "narration"}
    narration = ""
    for k in narration_keys:
        if k in columns and columns[k]:
            narration = " ".join(columns[k])
            break
    if not narration:
        narration = "Unknown"

    debit = 0.0
    credit = 0.0
    balance = None

    for k in ("debit", "withdrawal"):
        if k in columns and columns[k]:
            val = " ".join(columns[k])
            debit = _parse_amount_str(val)
            break

    for k in ("credit", "deposit"):
        if k in columns and columns[k]:
            val = " ".join(columns[k])
            credit = _parse_amount_str(val)
            break

    if "balance" in columns and columns["balance"]:
        balance = _parse_amount_str(" ".join(columns["balance"]))

    if "amount" in columns and columns["amount"] and debit == 0 and credit == 0:
        amount = _parse_amount_str(" ".join(columns["amount"]))
        if _narration_suggests_credit(narration):
            credit = abs(amount)
        else:
            debit = abs(amount)

    if debit == 0 and credit == 0:
        return None

    return {
        "date": date,
        "narration": narration,
        "debit": debit,
        "credit": credit,
        "balance": balance,
        "transaction_type": "deposit" if credit > 0 else "withdrawal",
    }


def _preprocess_for_ocr(image):
    """Convert to greyscale and increase contrast before feeding to Tesseract.

    Bank statement scans often have coloured headers, watermarks, or low contrast
    that hurts OCR accuracy. This brings most scans to a clean black-on-white form.
    """
    try:
        from PIL import ImageEnhance, ImageFilter
        image = image.convert("L")                         # greyscale
        image = ImageEnhance.Contrast(image).enhance(2.0) # boost contrast
        image = image.point(lambda x: 0 if x < 140 else 255, "1")  # binarise
    except Exception:
        pass  # if PIL extras aren't available, use the raw image
    return image


def _extract_ocr_pdf(content: bytes) -> list[dict]:
    """Extract transactions from scanned PDF using OCR."""
    import os

    kwargs = {"dpi": 300}  # higher DPI → sharper text → better OCR
    if POPPLER_PATH and os.path.isdir(POPPLER_PATH):
        kwargs["poppler_path"] = POPPLER_PATH

    images = convert_from_bytes(content, **kwargs)
    all_text = []

    for image in images:
        processed = _preprocess_for_ocr(image)
        text = pytesseract.image_to_string(
            processed,
            config="--psm 6 --oem 3",  # uniform block of text, best LSTM engine
        )
        all_text.append(text)

    full_text = "\n".join(all_text)
    return _parse_text_lines(full_text)


def _parse_text_lines(text: str) -> list[dict]:
    """Parse text lines into transactions — shared by text extraction and OCR.

    Continuation lines (no date, no amounts) are merged into the preceding
    transaction's narration so multi-line descriptions aren't truncated.
    """
    transactions = []
    lines = text.strip().split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Try to find a date in the line
        date = _parse_line_date(line)
        if not date:
            # Continuation line — append to last transaction if it looks like text
            # (skip lines that are purely numeric or separator rows)
            has_amounts = bool(re.findall(r"\d[\d,]*\.\d{2}", line))
            looks_like_text = not has_amounts and len(line) > 3
            if looks_like_text and transactions:
                transactions[-1]["narration"] = (
                    transactions[-1]["narration"] + " " + line
                ).strip()
            continue

        # Extract amounts (numbers with optional commas and decimals)
        # Matches: 123.45, 1,234.56, .26, 0.26
        amounts = re.findall(r"(?<!\w)[\d,]*\.?\d+\.\d{2}(?!\w)", line)
        # Simpler: find all decimal numbers
        amounts = re.findall(r"\d[\d,]*\.\d{2}|\.\d{2}", line)
        amounts = [float(a.replace(",", "")) for a in amounts]

        # Extract narration (text between date and amounts)
        narration = re.sub(r"[\d,]+\.\d{2}", "", line)
        # Remove date patterns
        narration = re.sub(r"\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?", "", narration)
        narration = re.sub(r"\d{4}[/-]\d{2}[/-]\d{2}", "", narration)
        narration = re.sub(r"\s+", " ", narration).strip(" -|/")

        if not narration or not amounts:
            continue

        txn = {
            "date": date,
            "narration": narration,
            "debit": 0.0,
            "credit": 0.0,
            "balance": None,
        }

        # Determine credit vs debit
        is_credit = _narration_suggests_credit(narration)

        # Check for explicit Cr/Dr markers
        line_lower = line.lower()
        has_cr_marker = bool(re.search(r"\bcredit\b", line_lower))
        has_dr_marker = bool(re.search(r"\b(debit|withdrawal|charge)\b", line_lower))

        if has_cr_marker and not has_dr_marker:
            is_credit = True
        elif has_dr_marker and not has_cr_marker:
            is_credit = False

        if len(amounts) >= 3:
            # Format: debit | credit | balance (common in bank tables)
            # But we need to figure out which is which
            # If first amount is 0-like and second isn't, swap
            txn["balance"] = amounts[-1]  # Last is usually balance
            remaining = amounts[:-1]

            if len(remaining) == 2:
                # Two amounts before balance: debit, credit
                # One will typically be 0 or very small
                txn["debit"] = remaining[0]
                txn["credit"] = remaining[1]
            elif len(remaining) == 1:
                if is_credit:
                    txn["credit"] = remaining[0]
                else:
                    txn["debit"] = remaining[0]
        elif len(amounts) == 2:
            # amount + balance
            if is_credit:
                txn["credit"] = amounts[0]
                txn["balance"] = amounts[1]
            else:
                txn["debit"] = amounts[0]
                txn["balance"] = amounts[1]
        elif len(amounts) == 1:
            if is_credit:
                txn["credit"] = amounts[0]
            else:
                txn["debit"] = amounts[0]

        # Determine type
        if txn["credit"] > 0 and txn["debit"] == 0:
            txn["transaction_type"] = "deposit"
        elif txn["debit"] > 0 and txn["credit"] == 0:
            txn["transaction_type"] = "withdrawal"
        elif txn["credit"] > txn["debit"]:
            txn["transaction_type"] = "deposit"
        else:
            txn["transaction_type"] = "withdrawal"

        # Skip if both are 0
        if txn["debit"] == 0 and txn["credit"] == 0:
            continue

        transactions.append(txn)

    return transactions


def _parse_line_date(line: str) -> Optional[datetime]:
    """Try to extract a date from a line of text."""
    # Full date patterns (with year)
    full_patterns = [
        (r"\d{2}[/-]\d{2}[/-]\d{4}", ["%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%m-%d-%Y"]),
        (r"\d{4}[/-]\d{2}[/-]\d{2}", ["%Y-%m-%d", "%Y/%m/%d"]),
        (r"\d{2}\s+\w{3}\s+\d{4}", ["%d %b %Y", "%d %B %Y"]),
        (r"\d{2}\s+\w{3}\s+\d{2}\b", ["%d %b %y"]),
        (r"\d{2}-\w{3}-\d{4}", ["%d-%b-%Y"]),
        (r"\d{2}-\w{3}-\d{2}\b", ["%d-%b-%y"]),
    ]

    for pattern, formats in full_patterns:
        match = re.search(pattern, line)
        if match:
            date_str = match.group()
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue

    # Short date patterns (MM/DD or DD/MM without year) — common in US bank statements
    short_patterns = [
        (r"^(\d{1,2})[/-](\d{1,2})\b", None),  # Line starts with date
    ]

    for pattern, _ in short_patterns:
        match = re.match(pattern, line.strip())
        if match:
            part1, part2 = int(match.group(1)), int(match.group(2))
            # Determine if MM/DD or DD/MM
            # US format: MM/DD
            if 1 <= part1 <= 12 and 1 <= part2 <= 31:
                try:
                    # Assume current year for short dates
                    year = datetime.now().year
                    return datetime(year, part1, part2).date()
                except ValueError:
                    pass
            # Try DD/MM
            if 1 <= part2 <= 12 and 1 <= part1 <= 31:
                try:
                    year = datetime.now().year
                    return datetime(year, part2, part1).date()
                except ValueError:
                    pass

    return None


def _narration_suggests_credit(narration: str) -> bool:
    """Check if narration text suggests incoming money (credit/deposit)."""
    credit_keywords = [
        "salary", "credited", "received", "refund", "cashback", "interest",
        "dividend", "credit", "deposit", "reversal", "neft cr", "imps cr",
        "upi cr", "by transfer", "inward", "incoming", "payroll",
        "preauthorized credit", "interest credit", "direct deposit",
    ]
    narration_lower = narration.lower()
    return any(kw in narration_lower for kw in credit_keywords)


def _parse_amount_str(value: str) -> float:
    """Parse a string amount value."""
    if not value:
        return 0.0
    cleaned = value.replace(",", "").replace("$", "").replace("₹", "").strip()
    cleaned = re.sub(r"[^\d.\-]", "", cleaned)
    if not cleaned:
        return 0.0
    try:
        return abs(float(cleaned))
    except ValueError:
        return 0.0
