import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLyrics } from './useLyrics'
import { useChatContext } from './ChatContext'

function SnippetLines({ snippet }) {
  const lines = snippet.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <p className="text-zinc-200 text-sm italic leading-relaxed text-center">
      <span className="text-zinc-500">… </span>
      {lines.map((line, i) => (
        <span key={i}>{i > 0 && <br />}{line}</span>
      ))}
      <span className="text-zinc-500"> …</span>
    </p>
  )
}

export function TrackLoader({ tracks }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * Math.max(tracks.length, 1)))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!tracks.length) return
    const cycle = () => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => {
          let next = Math.floor(Math.random() * tracks.length)
          if (next === i) next = (next + 1) % tracks.length
          return next
        })
        setVisible(true)
      }, 500)
    }
    const timer = setInterval(cycle, 6000)
    return () => clearInterval(timer)
  }, [tracks.length])

  const item = tracks[idx % Math.max(tracks.length, 1)] ?? null

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 gap-4 text-center min-w-[220px]">
      <div className="flex gap-1 mb-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-0.5 bg-violet-500 rounded-full animate-bounce"
            style={{ height: '20px', animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
      <div
        className="transition-opacity duration-500 min-h-[4rem] flex flex-col items-center justify-center gap-1"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {item ? (
          item.snippet ? (
            <>
              <SnippetLines snippet={item.snippet} />
              <p className="text-zinc-500 text-xs mt-1">{item.track} · {item.artist}</p>
            </>
          ) : (
            <>
              <p className="text-zinc-200 text-sm font-medium">{item.track}</p>
              <p className="text-zinc-500 text-xs">{item.artist}</p>
            </>
          )
        ) : (
          <p className="text-zinc-500 text-xs">Loading your top tracks…</p>
        )}
      </div>
      <p className="text-zinc-600 text-xs animate-pulse">thinking about your taste…</p>
    </div>
  )
}

export function AgentChat() {
  const { messages, streaming, send, cancel } = useChatContext()
  const { tracks } = useLyrics()
  const [input, setInput]   = useState('')
  const bottomRef           = useRef(null)
  const inputRef            = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Refocus input when streaming finishes and we're on this tab
  useEffect(() => {
    if (!streaming) inputRef.current?.focus()
  }, [streaming])

  const handleSend = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    send(text)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-full">
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
                <button key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors"
                >{s}</button>
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
                msg.content === null ? (
                  <TrackLoader tracks={tracks} />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-table:text-xs prose-table:border-collapse
                    prose-th:bg-zinc-700 prose-th:px-2 prose-th:py-1 prose-th:text-left
                    prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-zinc-700
                    prose-code:text-violet-300 prose-pre:bg-zinc-900
                    prose-headings:text-zinc-100 prose-strong:text-zinc-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )
              ) : msg.content}
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
            placeholder={streaming ? 'Thinking… (you can switch tabs)' : 'Ask about your taste…'}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100
              placeholder:text-zinc-500 resize-none focus:outline-none focus:border-violet-500
              disabled:opacity-50 transition-colors"
          />
          {streaming ? (
            <button
              onClick={cancel}
              className="bg-zinc-700 hover:bg-red-900 text-zinc-300 hover:text-red-300
                rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
                text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
            >
              Send
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-600 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
