"""CSV bank statement parser."""

import io
import pandas as pd
from parsing.normalizer import normalize_transactions


def parse_csv(content: bytes) -> list[dict]:
    """Parse CSV bank statement into transaction list."""
    # Try different encodings
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("Unable to decode CSV file")

    # Read CSV with pandas — handle various formats
    df = pd.read_csv(io.StringIO(text), skipinitialspace=True)

    # Clean column names
    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]

    return normalize_transactions(df)
