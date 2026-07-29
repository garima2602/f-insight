"""Shared in-process state — avoids circular imports between main.py and routers."""

# job_id (str) → {"status": "processing"|"done"|"error", "pct": int, "message": str}
upload_progress: dict[str, dict] = {}
