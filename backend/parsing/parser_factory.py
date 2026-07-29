"""Parser factory — routes to the correct parser based on file type.

CSV and Excel parsing use pandas, which is CPU-bound and synchronous.
Running them directly inside an async route blocks the entire event loop.
We offload them to a thread pool via run_in_executor so the loop stays free
to handle other requests while a large file is being processed.

PDF parsing is already async (it does its own I/O), so it is awaited directly.
"""

import asyncio
import io
from functools import partial

import pandas as pd

from parsing.csv_parser import parse_csv
from parsing.excel_parser import parse_excel
from parsing.pdf_parser import parse_pdf
from parsing.hdfc_parser import is_hdfc_statement, parse_hdfc
from parsing.sbi_parser import is_sbi_statement, parse_sbi
from parsing.axis_parser import is_axis_statement, parse_axis
from parsing.icici_parser import is_icici_statement, parse_icici
from parsing.ofx_parser import parse_ofx
from parsing.qif_parser import parse_qif
from parsing.json_parser import parse_json
from parsing.mt940_parser import parse_mt940
from logging_config import get_logger

logger = get_logger(__name__)


def _parse_tabular(content: bytes, file_type: str, filename: str) -> list[dict]:
    """Synchronous entry point — tries bank-specific parsers before generic ones."""
    # Peek at column names to decide which parser to use
    try:
        if file_type == "csv":
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    df_peek = pd.read_csv(io.StringIO(content.decode(enc)), nrows=0)
                    break
                except (UnicodeDecodeError, Exception):
                    continue
            else:
                df_peek = pd.DataFrame()
        else:
            df_peek = pd.read_excel(io.BytesIO(content), nrows=0)
    except Exception:
        df_peek = pd.DataFrame()

    if is_hdfc_statement(df_peek):
        logger.info("Detected HDFC statement format for: %s", filename)
        return parse_hdfc(content, file_type)

    if is_sbi_statement(df_peek):
        logger.info("Detected SBI statement format for: %s", filename)
        return parse_sbi(content, file_type)

    if is_axis_statement(df_peek):
        logger.info("Detected Axis Bank statement format for: %s", filename)
        return parse_axis(content, file_type)

    if is_icici_statement(df_peek):
        logger.info("Detected ICICI Bank statement format for: %s", filename)
        return parse_icici(content, file_type)

    # Fall back to generic parsers
    if file_type == "csv":
        return parse_csv(content)
    return parse_excel(content)  # type: ignore[arg-type]


async def parse_file(content: bytes, file_type: str, filename: str) -> list[dict]:
    """
    Parse file content based on detected type.

    CSV / Excel  — run in a thread pool (blocking pandas I/O).
    PDF          — awaited directly (already async).
    """
    loop = asyncio.get_running_loop()

    if file_type == "csv":
        logger.debug("Dispatching CSV parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(_parse_tabular, content, file_type, filename))

    elif file_type in ("xlsx", "xls"):
        logger.debug("Dispatching Excel parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(_parse_tabular, content, file_type, filename))

    elif file_type == "pdf":
        logger.debug("Awaiting PDF parser for: %s", filename)
        return await parse_pdf(content, filename)

    elif file_type == "ofx":
        logger.debug("Dispatching OFX parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(parse_ofx, content))

    elif file_type == "qif":
        logger.debug("Dispatching QIF parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(parse_qif, content))

    elif file_type == "json":
        logger.debug("Dispatching JSON parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(parse_json, content))

    elif file_type == "mt940":
        logger.debug("Dispatching MT940 parser to thread pool for: %s", filename)
        return await loop.run_in_executor(None, partial(parse_mt940, content))

    else:
        raise ValueError(
            f"Unsupported file type '{file_type}'. "
            "Expected one of: csv, xlsx, xls, pdf, ofx, qif, json."
        )
