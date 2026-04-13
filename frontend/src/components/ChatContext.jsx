import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'

const ChatContext = createContext(null)

// Stable thread ID for the session — persists across tab switches
const THREAD_ID = Math.random().toString(36).slice(2) + Date.now().toString(36)

const BASE = '/api'

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
  // ── Chat state ─────────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState([])
  const [streaming, setStreaming] = useState(false)
  const bufferRef  = useRef('')
  const abortRef   = useRef(null)

  // ── Playlist state ─────────────────────────────────────────────────────────
  const [plPrompt,    setPlPrompt]    = useState('')
  const [plStatus,    setPlStatus]    = useState('idle')   // idle | loading | done | error
  const [plThoughts,  setPlThoughts]  = useState('')
  const [plPlaylist,  setPlPlaylist]  = useState(null)
  const [plToolMsg,   setPlToolMsg]   = useState('')
  const [plErrorMsg,  setPlErrorMsg]  = useState('')
  const [plSaved,     setPlSaved]     = useState([])
  const [plModifying, setPlModifying] = useState(null)
  const plAbortRef = useRef(null)

  const fetchSaved = useCallback(() => {
    fetch(`${BASE}/playlists`)
      .then(r => r.json())
      .then(setPlSaved)
      .catch(() => {})
  }, [])

  const submitPlaylist = useCallback(async (prompt, modifying = null) => {
    if (!prompt.trim() || plStatus === 'loading') return

    setPlPrompt(prompt)
    setPlStatus('loading')
    setPlThoughts('')
    setPlPlaylist(null)
    setPlToolMsg('')
    setPlErrorMsg('')

    plAbortRef.current = new AbortController()

    try {
      const body = { prompt: prompt.trim() }
      if (modifying) body.playlist_id = modifying.playlist_id

      const res = await fetch(`${BASE}/agent/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: plAbortRef.current.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   gotPlaylist = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        let eventType = 'message'
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (eventType === 'done') break
            if (eventType === 'error') {
              setPlErrorMsg(data)
              setPlStatus('error')
              return
            }
            if (eventType === 'tool_start') {
              setPlToolMsg(data === 'build_playlist' ? 'Building playlist…' : 'Querying your data…')
            } else if (eventType === 'tool_end') {
              setPlToolMsg('')
            } else if (eventType === 'playlist') {
              try {
                const p = JSON.parse(data)
                setPlPlaylist(p)
                gotPlaylist = true
              } catch (e) {
                console.error('Failed to parse playlist event:', data, e)
              }
            } else {
              setPlThoughts(prev => prev + data)
            }
          }
        }
      }

      if (!gotPlaylist) {
        setPlErrorMsg("The agent finished but didn't generate a playlist. Check Pi logs: docker compose logs backend -f")
        setPlStatus('error')
        return
      }

      setPlStatus('done')
      fetchSaved()
    } catch (e) {
      if (e.name === 'AbortError') {
        setPlStatus('idle')
      } else {
        setPlErrorMsg(e.message)
        setPlStatus('error')
      }
    }
  }, [plStatus, fetchSaved])

  const resetPlaylist = useCallback(() => {
    setPlStatus('idle')
    setPlPrompt('')
    setPlThoughts('')
    setPlPlaylist(null)
    setPlErrorMsg('')
    setPlModifying(null)
  }, [])

  const deletePlaylist = useCallback(async (id) => {
    if (!window.confirm('Delete this playlist?')) return
    await fetch(`${BASE}/playlists/${id}`, { method: 'DELETE' })
    fetchSaved()
  }, [fetchSaved])

  useEffect(() => { fetchSaved() }, [fetchSaved])

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
    <ChatContext.Provider value={{
      // chat
      messages, streaming, send, cancel,
      // playlist
      plPrompt, plStatus, plThoughts, plPlaylist, plToolMsg, plErrorMsg,
      plSaved, plModifying, setPlModifying, setPlPrompt,
      submitPlaylist, resetPlaylist, deletePlaylist, fetchSaved,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatContext)
}
