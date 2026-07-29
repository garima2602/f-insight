import React, { useState, useRef, useEffect, useId } from 'react'
import { Send, Bot, User, Loader2, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { sendChatMessageStream } from '../api'

const SUGGESTIONS = [
  'Where am I spending most?',
  'Am I saving enough?',
  'How much did I spend on food?',
  'What should I improve?',
  'Show my subscription costs',
  'How is my cash flow this month?',
]

function ConfidenceBadge({ level }) {
  if (!level) return null
  const map = {
    high:   { label: 'High confidence',   cls: 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 ring-brand-200 dark:ring-brand-800' },
    medium: { label: 'Medium confidence', cls: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800' },
    low:    { label: 'Low confidence',    cls: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 ring-red-200 dark:ring-red-800' },
  }
  const { label, cls } = map[level.toLowerCase()] ?? map.medium
  return (
    <span className={`badge ring-1 text-[10px] mt-1 ${cls}`}>{label}</span>
  )
}

function ReasoningPanel({ steps }) {
  const [open, setOpen] = useState(false)
  if (!steps?.length) return null
  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold
                   text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>Reasoning steps ({steps.length})</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <ol className="px-3 pb-3 space-y-1.5 text-[11px] text-gray-600 dark:text-gray-400 list-decimal list-inside">
          {steps.map((step, i) => (
            <li key={i} className="leading-snug">{step}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
          <Bot size={13} className="text-brand-600 dark:text-brand-400" />
        </div>
      )}

      <div className="max-w-[78%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'bg-brand-600 text-white rounded-tr-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-sm'
            }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        {!isUser && (
          <>
            {msg.confidence && <ConfidenceBadge level={msg.confidence} />}
            {msg.reasoning   && <ReasoningPanel steps={msg.reasoning} />}
          </>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
          <User size={13} className="text-gray-500 dark:text-gray-400" />
        </div>
      )}
    </div>
  )
}

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your local AI financial assistant. Ask me anything about your spending, savings, or financial habits.\n\nAll analysis happens on your machine. Nothing ever leaves localhost.",
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const endRef   = useRef(null)
  const inputRef = useRef(null)
  const inputId  = useId()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Build history for the last 5 turns
  const getHistory = () => {
    const turns = []
    const chatMsgs = messages.filter(m => m.role === 'user' || m.role === 'assistant')
    for (let i = Math.max(0, chatMsgs.length - 10); i < chatMsgs.length; i++) {
      const m = chatMsgs[i]
      if (m.role === 'user' || m.role === 'assistant') {
        turns.push({ role: m.role, content: m.content })
      }
    }
    return turns
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => {
      const next = [...prev, { role: 'user', content: text }]
      return next.length > 100 ? next.slice(-100) : next
    })
    setLoading(true)

    // Insert a placeholder assistant message that we'll fill in via streaming
    const placeholderIdx = { current: -1 }
    setMessages(prev => {
      placeholderIdx.current = prev.length
      return [...prev, { role: 'assistant', content: '', streaming: true }]
    })

    try {
      await sendChatMessageStream(text, (chunk) => {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.streaming) {
            copy[copy.length - 1] = { ...last, content: last.content + chunk }
          }
          return copy
        })
      })
      // Mark streaming complete
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false }
        return copy
      })
    } catch (err) {
      const isOllamaDown = err?.message?.toLowerCase().includes('ollama') ||
                           err?.message?.toLowerCase().includes('model') ||
                           err?.message?.toLowerCase().includes('500') ||
                           err?.message?.toLowerCase().includes('connect')
      setMessages(prev => {
        const copy = prev.filter(m => !m.streaming)
        return [...copy, {
          role: 'assistant',
          content: isOllamaDown
            ? "I couldn't reach the local AI model.\n\n**To set up Ollama:**\n1. Install from https://ollama.com\n2. Run: `ollama pull mistral`\n3. Run: `ollama serve`\n\nAnalytics and charts on the Dashboard still work without it."
            : `Something went wrong: ${err?.message || 'Unknown error'}.\n\nTry again or check that the backend server is running.`,
          isError: true,
        }]
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); handleSend() }
  const showSuggestions = messages.length <= 1

  return (
    <div className="card flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="card-header flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </div>
        <div>
          <h3 className="section-title leading-none">AI Financial Assistant</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Powered by Ollama · local only</p>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        <div role="status" aria-live="polite" aria-label={loading ? 'Assistant is thinking' : undefined}>
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0" aria-hidden="true">
                <Bot size={13} className="text-brand-600 dark:text-brand-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        <div ref={endRef} />
      </div>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="px-5 pb-2" aria-label="Suggested questions">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2" id="suggestions-label">Try asking:</p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-labelledby="suggestions-label">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                role="listitem"
                onClick={() => { setInput(s); inputRef.current?.focus() }}
                className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                           text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-gray-100 dark:border-gray-800"
        aria-label="Send a message"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor={inputId} className="sr-only">Message to AI assistant</label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Ask about your finances…"
              disabled={loading}
              aria-disabled={loading}
              className="input resize-none py-2.5 leading-snug text-sm max-h-32"
              style={{ height: 'auto', minHeight: '42px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label={loading ? 'Sending…' : 'Send message'}
            className="btn-primary px-3 py-2.5 shrink-0 self-end"
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              : <Send size={15} aria-hidden="true" />
            }
          </button>
        </div>
        <p className="text-[11px] text-gray-300 dark:text-gray-700 mt-1.5 text-center" aria-hidden="true">
          Enter to send · Shift+Enter for new line
        </p>
      </form>
    </div>
  )
}
