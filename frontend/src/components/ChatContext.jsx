import { createContext, useContext, useRef, useState } from 'react'

const ChatContext = createContext(null)

// Stable thread ID for the session — persists across tab switches
const THREAD_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

function parseSSEChunk(chunk) {
  const events = []
  const blocks = chunk.split(/\n\n+/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    let event = 'message'
    let dataParts = []
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) dataParts.push(line.slice(6))
    }
    if (dataParts.length) events.push({ event, data: dataParts.join('\n') })
  }
  return events
}

export function ChatProvider({ children }) {
  const [messages,  setMessages]  = useState([])
  const [streaming, setStreaming] = useState(false)
  const bufferRef  = useRef('')
  const abortRef   = useRef(null)

  const send = async (text) => {
    if (!text.trim() || streaming) return

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setStreaming(true)
    bufferRef.current = ''

    setMessages(prev => [...prev,
      { role: 'user',      content: text },
      { role: 'assistant', content: null },  // null = still thinking
    ])

    try {
      const res = await fetch('/api/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, thread_id: THREAD_ID }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText)
        throw new Error(`${res.status}: ${err}`)
      }

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
          for (const { event, data } of parseSSEChunk(part + '\n\n')) {
            if (event === 'message') {
              bufferRef.current += data
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // User cancelled — keep whatever arrived so far, append a note
        if (!bufferRef.current) bufferRef.current = '_Cancelled._'
        else bufferRef.current += '\n\n_Stopped._'
      } else {
        bufferRef.current = bufferRef.current || `Error: ${e.message || 'could not reach the agent.'}`
      }
    } finally {
      const finalContent = bufferRef.current || 'No response.'
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { role: 'assistant', content: finalContent }
        return msgs
      })
      setStreaming(false)
      bufferRef.current = ''
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  return (
    <ChatContext.Provider value={{ messages, streaming, send, cancel }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatContext)
}
