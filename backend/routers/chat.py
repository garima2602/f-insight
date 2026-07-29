"""AI Chat router — local LLM assistant."""

import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Transaction, User
from analytics.engine import AnalyticsEngine
from ai.assistant import FinancialAssistant
from auth import get_current_user

router = APIRouter()

MAX_MESSAGE_LENGTH = 1000


class ChatRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty.")
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message exceeds {MAX_MESSAGE_LENGTH} characters. Please shorten your question.")
        return v


class ChatResponse(BaseModel):
    reply: str
    context_used: dict | None = None


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chat with the local AI financial assistant."""
    try:
        result = await db.execute(
            select(Transaction).where(Transaction.user_id == current_user.id)
        )
        transactions = result.scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load transaction data for the assistant.") from exc

    try:
        engine = AnalyticsEngine(transactions)
        assistant = FinancialAssistant(engine)
        reply, context = await assistant.answer(request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="The assistant encountered an error. Please try again.") from exc

    return ChatResponse(reply=reply, context_used=context)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Streaming chat — Server-Sent Events, scoped to the current user."""
    try:
        result = await db.execute(
            select(Transaction).where(Transaction.user_id == current_user.id)
        )
        transactions = result.scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load transaction data.") from exc

    engine = AnalyticsEngine(transactions)
    assistant = FinancialAssistant(engine)

    async def event_generator():
        try:
            async for chunk in assistant.answer_stream(request.message):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
