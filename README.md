# F-Insight

A multi-user, local-first financial intelligence platform. Upload your bank statements and get automatic transaction categorisation, spending analytics, cash flow forecasts, and an AI-powered chat assistant — all running on your own machine with no data sent anywhere.

---

## Features

- **Multi-format import** — PDF, CSV, Excel, OFX/QFX, QIF, MT940, JSON, images (OCR)
- **Bank-specific parsers** — HDFC, SBI, Axis Bank, ICICI; generic fallback for all others
- **4-pass ML categorisation** — keyword rules → FAISS vector search → ChromaDB semantic correction → Ollama LLM
- **Analytics dashboard** — income, expenses, savings rate, health score, anomaly detection
- **3-month cash flow forecast** — trend-damped projection from last 3 complete months
- **AI chat assistant** — natural language queries over your transactions via Ollama (LLaMA 3.2), with a rule-based fallback if Ollama is not running
- **Multi-user support** — JWT authentication, per-user data isolation, account settings
- **Encrypted backup** — AES-128-CBC export with a user-supplied passphrase
- **Dark mode**, spending heatmap, subscription tracker, budget goals, net worth tracker

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2, Alembic |
| Database | SQLite (default) / PostgreSQL |
| Cache | Redis (optional) |
| ML | FAISS, sentence-transformers (all-MiniLM-L6-v2) |
| Vector store | ChromaDB (optional) |
| LLM | Ollama (local, optional) |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Auth | JWT (python-jose), bcrypt |
| Tests | pytest (backend), Vitest + Testing Library (frontend) |

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Tesseract OCR (for scanned PDFs and images)
- Ollama (optional — for AI chat)

### Install Tesseract

- **Windows:** Download from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki)
- **macOS:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr poppler-utils`

### Install Ollama (optional)

```bash
# Install from https://ollama.com, then pull a model
ollama pull llama3.2:1b
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env

# Run database migrations
python -m alembic upgrade head

# Start the server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, and start uploading statements.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values.

| Variable | Default | Description |
|---|---|---|
| `FINSIGHT_SECRET_KEY` | *(required in production)* | JWT signing key — minimum 32 characters. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FINSIGHT_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | JWT lifetime in minutes |
| `DATABASE_URL` | `sqlite+aiosqlite:///data/finsight.db` | Switch to PostgreSQL by setting `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | *(none — caching disabled)* | Optional Redis URL e.g. `redis://localhost:6379/0` |
| `TESSERACT_CMD` | *(auto-detected)* | Path to the tesseract binary |

---

## Docker

```bash
docker compose up --build
```

Starts PostgreSQL, Redis, backend, and nginx-fronted frontend in one command. Data is persisted in named volumes.

---

## Running Tests

**Backend**
```bash
cd backend
pytest tests/ -v
```

**Frontend**
```bash
cd frontend
npm test
```

---

## Project Structure

```
f-insight/
├── backend/
│   ├── ai/                  # Merchant classifier, vector store, AI assistant
│   ├── analytics/           # Analytics engine (forecasts, health score, anomalies)
│   ├── ingestion/           # File type detection
│   ├── migrations/          # Alembic schema migrations
│   ├── parsing/             # Statement parsers (HDFC, SBI, Axis, ICICI, generic)
│   ├── routers/             # API route handlers (auth, upload, analytics, chat, settings)
│   ├── tests/               # pytest test suite
│   ├── main.py              # FastAPI app entry point
│   ├── models.py            # SQLAlchemy models
│   ├── auth.py              # JWT + bcrypt authentication
│   ├── cache.py             # Redis cache decorator
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── contexts/        # React context providers
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Page-level components
│   │   └── test/            # Vitest test suite
│   └── package.json
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## Privacy

- All financial data is stored locally (SQLite) or within your own infrastructure
- No data is sent to external servers
- Ollama runs locally; ChromaDB runs locally
- Encrypted backup uses AES-128-CBC with a passphrase you control

