import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const THREAD_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

function parseSSEChunk(chunk) {
  // Parse a raw SSE chunk into { event, data } pairs
  const events = []
  const blocks = chunk.split(/\n\n+/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    let event = 'message'
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) data += line.slice(6)
    }
    if (data) events.push({ event, data })
  }
  return events
}

export function AgentChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [querying, setQuerying] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setStreaming(true)
    setQuerying(false)

    const userMsg = { role: 'user', content: text }
    const assistantMsg = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, thread_id: THREAD_ID }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE blocks (separated by double newline)
        const parts = buffer.split(/\n\n(?=(?:event:|data:))/)
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const parsed = parseSSEChunk(part + '\n\n')
          for (const { event, data } of parsed) {
            if (event === 'tool_start') {
              setQuerying(true)
            } else if (event === 'tool_end') {
              setQuerying(false)
            } else if (event === 'done') {
              // stream finished
            } else {
              // default: text token
              setMessages(prev => {
                const msgs = [...prev]
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  content: msgs[msgs.length - 1].content + data,
                }
                return msgs
              })
            }
          }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: 'Error: could not reach the agent.' }
        return msgs
      })
    } finally {
      setStreaming(false)
      setQuerying(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100svh-8rem)] md:h-[calc(100svh-5rem)]">

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            <p className="text-zinc-400 text-sm">Ask anything about your taste.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'What should I learn on guitar next?',
                'What have I been listening to most this year?',
                'Find connections between my music and books.',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none
                  prose-table:text-xs prose-table:border prose-table:border-zinc-700
                  prose-th:bg-zinc-700 prose-th:px-2 prose-th:py-1
                  prose-td:px-2 prose-td:py-1 prose-td:border-zinc-700
                  prose-code:text-violet-300 prose-pre:bg-zinc-900">
                  {msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="text-zinc-500 animate-pulse">
                      {querying ? 'Querying your data…' : '…'}
                    </span>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-800 pt-3 pb-safe">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={streaming}
            placeholder="Ask about your taste…"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100
              placeholder:text-zinc-500 resize-none focus:outline-none focus:border-violet-500
              disabled:opacity-50 transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
              text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
          >
            {streaming ? '…' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
