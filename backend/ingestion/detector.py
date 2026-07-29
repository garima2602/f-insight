"""File type detection module."""
import re


def detect_file_type(filename: str, content: bytes) -> str:
    """Detect file type from filename extension and content magic bytes."""
    filename_lower = filename.lower()

    if filename_lower.endswith(".csv"):
        return "csv"
    elif filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
        return "xlsx"
    elif filename_lower.endswith(".pdf"):
        return "pdf"
    elif filename_lower.endswith((".ofx", ".qfx")):
        return "ofx"
    elif filename_lower.endswith(".qif"):
        return "qif"
    elif filename_lower.endswith(".json"):
        return "json"
    elif filename_lower.endswith((".mt940", ".mt9", ".sta", ".swift")):
        return "mt940"

    # Check magic bytes
    if content[:4] == b"%PDF":
        return "pdf"
    if content[:2] == b"PK":  # ZIP-based (xlsx)
        return "xlsx"

    # Sniff text formats
    try:
        text = content[:2048].decode("utf-8", errors="replace")
        stripped = text.lstrip()
        if stripped.startswith(("OFXHEADER:", "<OFX>", "<ofx>")):
            return "ofx"
        if stripped.startswith("!Type:") or stripped.startswith("!Account"):
            return "qif"
        if stripped.startswith(":20:") or re.search(r"^:\d{2}\w?:", stripped, re.MULTILINE):
            return "mt940"
        if stripped.startswith(("{", "[")):
            return "json"
        lines = text.strip().split("\n")
        if len(lines) > 1 and "," in lines[0]:
            return "csv"
    except Exception:
        pass

    return "unknown"
