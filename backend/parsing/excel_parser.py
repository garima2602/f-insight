"""Excel bank statement parser."""

import io
import pandas as pd
from parsing.normalizer import normalize_transactions


def parse_excel(content: bytes) -> list[dict]:
    """Parse Excel bank statement into transaction list."""
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl")

    # Clean column names
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]

    return normalize_transactions(df)
