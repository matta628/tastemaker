import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const THREAD_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

// Keyed by lowercase artist name — add more as needed
const LYRICS_BY_ARTIST = {
  'elliott smith': [
    { text: "I'm never gonna know you now, but I'm gonna love you anyhow", credit: "Elliott Smith — Waltz #2 (XO)" },
    { text: "Drink up baby, stay up all night with the things you could do", credit: "Elliott Smith — Between the Bars" },
    { text: "I'm never gonna know you now, but I'm gonna love you anyhow", credit: "Elliott Smith — Waltz #2 (XO)" },
    { text: "Got a long way to go for someone moving fast", credit: "Elliott Smith — Speed Trials" },
    { text: "I could make you satisfied in everything you do", credit: "Elliott Smith — Say Yes" },
  ],
  'the strokes': [
    { text: "Life is simple in the moonlight", credit: "The Strokes — Life Is Simple in the Moonlight" },
    { text: "Take it or leave it", credit: "The Strokes — Take It or Leave It" },
    { text: "I want to be forgotten, and I don't want to be reminded", credit: "The Strokes — Someday" },
    { text: "You said it changed your life, but you couldn't say why", credit: "The Strokes — Under Cover of Darkness" },
  ],
  'the voidz': [
    { text: "All this machinery making modern music", credit: "The Voidz — Leave It in My Heart" },
    { text: "We'll never get back those feelings we had", credit: "The Voidz — Pyramid of Bones" },
  ],
  'lana del rey': [
    { text: "Will you still love me when I'm no longer young and beautiful?", credit: "Lana Del Rey — Young and Beautiful" },
    { text: "I was always an unusual girl, my mother told me I had a chameleon soul", credit: "Lana Del Rey — Ride" },
    { text: "Who are you? Are you in touch with all of your darkest fantasies?", credit: "Lana Del Rey — Ride" },
  ],
  'arctic monkeys': [
    { text: "Do I wanna know, if this feeling flows both ways?", credit: "Arctic Monkeys — Do I Wanna Know?" },
    { text: "I bet that you look good on the dancefloor", credit: "Arctic Monkeys — I Bet You Look Good on the Dancefloor" },
    { text: "Mardy bum, now I'm sitting here, can't work you out", credit: "Arctic Monkeys — Mardy Bum" },
  ],
  'baustelle': [
    { text: "Sono venuto a capo di tutto, e non c'è niente", credit: "Baustelle — Niente" },
    { text: "L'amore non esiste, è solo un altro modo per morire", credit: "Baustelle — La morte non ha età" },
    { text: "Siamo soli, siamo soli nel mondo", credit: "Baustelle — Colombo" },
  ],
  'keyshia cole': [
    { text: "I want you to know that I love you so, always", credit: "Keyshia Cole — Love" },
    { text: "Let it go, let it go, I should've let you go", credit: "Keyshia Cole — Let It Go" },
  ],
  'deftones': [
    { text: "We can bathe in the water... while the morning comes", credit: "Deftones — Sextape" },
    { text: "I'll try, I'll try... be with you", credit: "Deftones — Be Quiet and Drive" },
  ],
  'wednesday': [
    { text: "I'm not gonna die in this county", credit: "Wednesday — Bull Believer" },
    { text: "I just want to feel something, anything at all", credit: "Wednesday — Chosen to Deserve" },
  ],
  'michael jackson': [
    { text: "You are not alone, I am here with you", credit: "Michael Jackson — You Are Not Alone" },
    { text: "Billie Jean is not my lover", credit: "Michael Jackson — Billie Jean" },
  ],
}

const FALLBACK_LYRICS = [
  { text: "I'm never gonna know you now, but I'm gonna love you anyhow", credit: "Elliott Smith — Waltz #2 (XO)" },
  { text: "Life is simple in the moonlight", credit: "The Strokes — Life Is Simple in the Moonlight" },
]

function LyricsLoader({ lyrics }) {
  const pool = lyrics?.length ? lyrics : FALLBACK_LYRICS
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = () => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % pool.length)
        setVisible(true)
      }, 600)
    }
    const timer = setInterval(cycle, 6000)
    return () => clearInterval(timer)
  }, [pool.length])

  const { text, credit } = pool[idx % pool.length]

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 gap-4 text-center">
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
        className="transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-zinc-200 text-base italic leading-relaxed">"{text}"</p>
        <p className="text-zinc-500 text-xs mt-2">— {credit}</p>
      </div>
      <p className="text-zinc-600 text-xs mt-2 animate-pulse">thinking about your taste…</p>
    </div>
  )
}

function parseSSEChunk(chunk) {
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
  const [lyrics, setLyrics] = useState([])
  const bufferRef = useRef('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/taste/top-artists?days=30&limit=10')
      .then(r => r.json())
      .then(artists => {
        const pool = []
        for (const { artist } of artists) {
          const key = artist.toLowerCase()
          const matches = Object.entries(LYRICS_BY_ARTIST).find(([k]) => key.includes(k) || k.includes(key))
          if (matches) pool.push(...matches[1])
        }
        if (pool.length >= 3) setLyrics(pool)
      })
      .catch(() => {}) // silently fall back to hardcoded
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setStreaming(true)
    bufferRef.current = ''

    const userMsg = { role: 'user', content: text }
    // assistant placeholder — content null means "still thinking"
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: null }])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, thread_id: THREAD_ID }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let rawBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        rawBuffer += decoder.decode(value, { stream: true })

        const parts = rawBuffer.split(/\n\n(?=(?:event:|data:))/)
        rawBuffer = parts.pop() ?? ''

        for (const part of parts) {
          const parsed = parseSSEChunk(part + '\n\n')
          for (const { event, data } of parsed) {
            if (event === 'message' || event === 'message\r') {
              bufferRef.current += data
            } else if (event === 'done') {
              // handled below
            }
            // tool_start / tool_end — lyrics loader handles the visual
          }
        }
      }
    } catch (e) {
      bufferRef.current = 'Error: could not reach the agent.'
    } finally {
      const finalContent = bufferRef.current || 'No response.'
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { role: 'assistant', content: finalContent }
        return msgs
      })
      setStreaming(false)
      bufferRef.current = ''
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
                msg.content === null ? (
                  <LyricsLoader lyrics={lyrics} />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-table:text-xs prose-table:border-collapse
                    prose-th:bg-zinc-700 prose-th:px-2 prose-th:py-1 prose-th:text-left
                    prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-zinc-700
                    prose-code:text-violet-300 prose-pre:bg-zinc-900
                    prose-headings:text-zinc-100 prose-strong:text-zinc-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )
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
