import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'

const ChatContext = createContext(null)

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
  const [messages,      setMessages]      = useState([])
  const [streaming,     setStreaming]      = useState(false)
  const [activeChatId,  setActiveChatId]  = useState(null)
  const [chats,         setChats]         = useState([])
  const bufferRef       = useRef('')
  const abortRef        = useRef(null)
  // Ref so send() closure always sees the latest activeChatId without re-binding
  const activeChatIdRef = useRef(null)
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])

  // ── Chat CRUD ──────────────────────────────────────────────────────────────
  const fetchChats = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/chats`)
      const data = await r.json()
      setChats(data)
    } catch {}
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

  const newChat = useCallback(() => {
    setMessages([])
    setActiveChatId(null)
    activeChatIdRef.current = null
    bufferRef.current = ''
  }, [])

  const loadChat = useCallback(async (chatId) => {
    try {
      const r = await fetch(`${BASE}/chats/${chatId}/messages`)
      const msgs = await r.json()
      setMessages(msgs)
      setActiveChatId(chatId)
      activeChatIdRef.current = chatId
    } catch {}
  }, [])

  const deleteChat = useCallback(async (chatId) => {
    if (!window.confirm('Delete this chat?')) return
    await fetch(`${BASE}/chats/${chatId}`, { method: 'DELETE' })
    if (activeChatIdRef.current === chatId) {
      setMessages([])
      setActiveChatId(null)
      activeChatIdRef.current = null
    }
    fetchChats()
  }, [fetchChats])

  // ── Send + stream ──────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    if (!text.trim() || streaming) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStreaming(true)
    bufferRef.current = ''

    setMessages(prev => [...prev,
      { role: 'user',      content: text },
      { role: 'assistant', content: null },   // null = TrackLoader while thinking
    ])

    // Create a new chat on the first message of a session
    let chatId = activeChatIdRef.current
    if (!chatId) {
      try {
        const title = text.length > 60 ? text.slice(0, 60) + '…' : text
        const r = await fetch(`${BASE}/chats`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title }),
        })
        const data = await r.json()
        chatId = data.chat_id
        setActiveChatId(chatId)
        activeChatIdRef.current = chatId
        fetchChats()
      } catch {}
    }

    try {
      const res = await fetch('/api/agent/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, thread_id: chatId || 'default' }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText)
        throw new Error(`${res.status}: ${err}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let rawBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        rawBuffer += decoder.decode(value, { stream: true })

        const parts = rawBuffer.split(/\n\n(?=(?:event:|data:|:))/)
        rawBuffer = parts.pop() ?? ''

        for (const part of parts) {
          // Skip SSE keep-alive comments (": keepalive")
          if (part.trimStart().startsWith(':')) continue
          for (const { event, data } of parseSSEChunk(part + '\n\n')) {
            if (event === 'message') {
              bufferRef.current += data
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        if (!bufferRef.current) bufferRef.current = '_Cancelled._'
        else bufferRef.current += '\n\n_Stopped._'
      } else {
        bufferRef.current = bufferRef.current
          ? bufferRef.current + '\n\n_(response cut short)_'
          : `Error: ${e.message || 'could not reach the agent.'}`
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

      // Persist the exchange to DB
      if (chatId) {
        try {
          await fetch(`${BASE}/chats/${chatId}/messages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify([
              { role: 'user',      content: text },
              { role: 'assistant', content: finalContent },
            ]),
          })
          fetchChats()
        } catch {}
      }
    }
  }, [streaming, fetchChats])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // ── Playlist state ─────────────────────────────────────────────────────────
  const [plPrompt,    setPlPrompt]    = useState('')
  const [plStatus,    setPlStatus]    = useState('idle')
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

    let gotPlaylist = false

    try {
      const body = { prompt: prompt.trim() }
      if (modifying) body.playlist_id = modifying.playlist_id

      const res = await fetch(`${BASE}/agent/playlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  plAbortRef.current.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

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
      } else if (gotPlaylist) {
        setPlStatus('done')
        fetchSaved()
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

  // ── Pipeline state ─────────────────────────────────────────────────────────
  const POLL_MS = 8000
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [syncState,      setSyncState]      = useState('idle')
  const [enrichState,    setEnrichState]    = useState('idle')
  const [enrichStuck,    setEnrichStuck]    = useState(false)
  const [goodreadsState, setGoodreadsState] = useState('idle')
  const [guitarState,    setGuitarState]    = useState('idle')
  const enrichStateRef  = useRef('idle')
  const prevPctsRef     = useRef(null)
  const stuckCountRef   = useRef(0)
  const pipelinePollRef = useRef(null)

  useEffect(() => { enrichStateRef.current = enrichState }, [enrichState])

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/pipelines/status`)
      const data = await r.json()
      setPipelineStatus(data)

      if (enrichStateRef.current === 'idle' && data.enrichment?.process_running) {
        setEnrichState('running')
        return
      }
      if (enrichStateRef.current === 'idle' && data.lastfm?.process_running) {
        setSyncState('running')
      }
      if (data.goodreads?.process_running) {
        setGoodreadsState(prev => prev === 'idle' ? 'running' : prev)
      } else {
        setGoodreadsState(prev => prev === 'running' ? (data.goodreads?.last_error ? 'error' : 'done') : prev)
      }
      if (data.guitar_import?.process_running) {
        setGuitarState(prev => prev === 'idle' ? 'running' : prev)
      } else {
        setGuitarState(prev => prev === 'running' ? (data.guitar_import?.last_error ? 'error' : 'done') : prev)
      }

      if (enrichStateRef.current === 'running' && data.enrichment) {
        const e = data.enrichment
        if (!e.process_running) {
          if (!e.last_error) {
            setEnrichState('done')
          } else if (e.last_error) {
            setEnrichState('error')
          } else {
            setEnrichState('idle')
          }
          setEnrichStuck(false)
          stuckCountRef.current = 0
          prevPctsRef.current = null
          return
        }

        const curPcts = [e.artist_tags.pct, e.artist_similar.pct, e.track_tags.pct].join(',')
        if (prevPctsRef.current === curPcts) {
          stuckCountRef.current += 1
          if (stuckCountRef.current >= 5) setEnrichStuck(true)
        } else {
          stuckCountRef.current = 0
          setEnrichStuck(false)
        }
        prevPctsRef.current = curPcts
      }
    } catch {}
  }, [])

  useEffect(() => {
    const running = syncState === 'running' || enrichState === 'running' ||
                    goodreadsState === 'running' || guitarState === 'running'
    if (running) {
      if (!pipelinePollRef.current) {
        pipelinePollRef.current = setInterval(fetchPipelineStatus, POLL_MS)
      }
    } else {
      clearInterval(pipelinePollRef.current)
      pipelinePollRef.current = null
    }
    return () => {
      clearInterval(pipelinePollRef.current)
      pipelinePollRef.current = null
    }
  }, [syncState, enrichState, goodreadsState, guitarState, fetchPipelineStatus])

  useEffect(() => { fetchPipelineStatus() }, [fetchPipelineStatus])

  const triggerSync = useCallback(async () => {
    if (syncState === 'running') return
    setSyncState('running')
    try {
      const res = await fetch(`${BASE}/pipelines/lastfm/sync`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const body = await res.json()
      if (body.status === 'already_running') return
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }, [syncState])

  const triggerEnrich = useCallback(async () => {
    if (enrichState === 'running') return
    try {
      const res = await fetch(`${BASE}/pipelines/lastfm/enrich`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const body = await res.json()
      if (body.status !== 'already_running') {
        setEnrichState('running')
        setEnrichStuck(false)
        stuckCountRef.current = 0
        prevPctsRef.current = null
      }
    } catch {
      setEnrichState('error')
      setTimeout(() => setEnrichState('idle'), 4000)
    }
  }, [enrichState])

  const uploadGoodreads = useCallback(async (file) => {
    if (goodreadsState === 'running') return
    setGoodreadsState('running')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/pipelines/goodreads/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const body = await res.json()
      if (body.status === 'already_running') setGoodreadsState('idle')
    } catch {
      setGoodreadsState('error')
      setTimeout(() => setGoodreadsState('idle'), 5000)
    }
  }, [goodreadsState])

  const uploadGuitar = useCallback(async (file) => {
    if (guitarState === 'running') return
    setGuitarState('running')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/pipelines/guitar/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const body = await res.json()
      if (body.status === 'already_running') setGuitarState('idle')
    } catch {
      setGuitarState('error')
      setTimeout(() => setGuitarState('idle'), 5000)
    }
  }, [guitarState])

  return (
    <ChatContext.Provider value={{
      // chat
      messages, streaming, send, cancel,
      chats, activeChatId, newChat, loadChat, deleteChat, fetchChats,
      // playlist
      plPrompt, plStatus, plThoughts, plPlaylist, plToolMsg, plErrorMsg,
      plSaved, plModifying, setPlModifying, setPlPrompt,
      submitPlaylist, resetPlaylist, deletePlaylist, fetchSaved,
      // pipeline
      pipelineStatus, syncState, enrichState, enrichStuck,
      triggerSync, triggerEnrich, fetchPipelineStatus,
      goodreadsState, guitarState, uploadGoodreads, uploadGuitar,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  return useContext(ChatContext)
}
