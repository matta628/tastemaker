import { useState, useRef, useEffect } from 'react'
import { useLyrics } from './useLyrics'
import { LyricsTape } from './LyricsTape'

const BASE = '/api'

// ── Saved playlist card ────────────────────────────────────────────────────

function PlaylistCard({ playlist, onDelete, onModify, onOpen }) {
  const [expanded, setExpanded] = useState(false)
  const tracks = typeof playlist.tracks === 'string'
    ? JSON.parse(playlist.tracks)
    : playlist.tracks

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-sm font-medium text-zinc-100 truncate">{playlist.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{tracks.length} tracks · {new Date(playlist.created_at).toLocaleDateString()}</p>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onOpen(playlist.shortcuts_url)}
            className="text-xs text-zinc-400 hover:text-violet-400 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Open in Apple Music"
          >↗</button>
          <button
            onClick={() => onModify(playlist)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Modify"
          >✎</button>
          <button
            onClick={() => onDelete(playlist.playlist_id)}
            className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Delete"
          >✕</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="text-xs text-zinc-600 mb-2 italic">"{playlist.prompt}"</p>
          <ol className="space-y-1">
            {tracks.map((t, i) => (
              <li key={i} className="flex items-baseline gap-3">
                <span className="text-xs text-zinc-600 w-5 text-right shrink-0">{i + 1}</span>
                <span className="text-xs text-zinc-300">{t.title}</span>
                <span className="text-xs text-zinc-500">· {t.artist}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PlaylistCreator() {
  const [prompt, setPrompt]           = useState('')
  const [status, setStatus]           = useState('idle')  // idle | loading | done | error
  const [thoughts, setThoughts]       = useState('')
  const [playlist, setPlaylist]       = useState(null)
  const [toolMsg, setToolMsg]         = useState('')
  const [errorMsg, setErrorMsg]       = useState('')
  const [saved, setSaved]             = useState([])
  const [modifying, setModifying]     = useState(null)   // playlist being modified
  const abortRef                      = useRef(null)
  const { tracks: lyrics }            = useLyrics()

  const fetchSaved = () => {
    fetch(`${BASE}/playlists`)
      .then(r => r.json())
      .then(setSaved)
      .catch(() => {})
  }

  useEffect(() => { fetchSaved() }, [])

  const submit = async (existingPlaylist = null) => {
    if (!prompt.trim() || status === 'loading') return

    setStatus('loading')
    setThoughts('')
    setPlaylist(null)
    setToolMsg('')
    setErrorMsg('')

    abortRef.current = new AbortController()

    try {
      const body = { prompt: prompt.trim() }
      if (existingPlaylist) body.playlist_id = existingPlaylist.playlist_id

      const res = await fetch(`${BASE}/agent/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
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
              setErrorMsg(data)
              setStatus('error')
              return
            }
            if (eventType === 'tool_start') {
              setToolMsg(data === 'build_playlist' ? 'Building playlist…' : 'Querying your data…')
            } else if (eventType === 'tool_end') {
              setToolMsg('')
            } else if (eventType === 'playlist') {
              try {
                const p = JSON.parse(data)
                setPlaylist(p)
                gotPlaylist = true
              } catch (e) {
                console.error('Failed to parse playlist event:', data, e)
              }
            } else {
              setThoughts(prev => prev + data)
            }
          }
        }
      }

      if (!gotPlaylist) {
        setErrorMsg('The agent finished but didn\'t generate a playlist. Check the Pi logs: docker compose logs backend -f')
        setStatus('error')
        return
      }

      setStatus('done')
      fetchSaved()
    } catch (e) {
      if (e.name === 'AbortError') {
        setStatus('idle')
      } else {
        setErrorMsg(e.message)
        setStatus('error')
      }
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this playlist?')) return
    await fetch(`${BASE}/playlists/${id}`, { method: 'DELETE' })
    fetchSaved()
  }

  const handleModify = (playlist) => {
    setModifying(playlist)
    setPrompt('')
    setStatus('idle')
    setPlaylist(null)
    setThoughts('')
    setErrorMsg('')
  }

  const handleOpen = (url) => { window.location.href = url }

  const reset = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setPrompt('')
    setThoughts('')
    setPlaylist(null)
    setErrorMsg('')
    setModifying(null)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <LyricsTape tracks={lyrics} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-center">
            <div className="text-2xl mb-2 animate-pulse">♪</div>
            <p className="text-zinc-300 font-medium">
              {toolMsg || 'Listening to your history…'}
            </p>
            <p className="text-zinc-600 text-sm mt-1 italic">"{prompt}"</p>
          </div>
          <button onClick={reset} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (status === 'done' && playlist) {
    const tracks = playlist.tracks || []
    return (
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="shrink-0 px-4 md:px-8 pt-5 pb-4 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                {modifying ? 'Modified playlist' : 'New playlist'} · {tracks.length} tracks
              </p>
              <h3 className="text-xl font-semibold text-zinc-100 leading-tight">{playlist.name}</h3>
              <p className="text-xs text-zinc-600 mt-1 italic truncate">"{playlist.prompt || prompt}"</p>
            </div>
            <button
              onClick={() => handleOpen(playlist.shortcuts_url)}
              className="shrink-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <span>Add to Apple Music</span>
              <span className="text-base leading-none">↗</span>
            </button>
          </div>
        </div>

        {/* Agent reasoning — collapsed */}
        {thoughts && (
          <details className="shrink-0 px-4 md:px-8 py-2.5 border-b border-zinc-800/60">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
              Agent reasoning
            </summary>
            <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap leading-relaxed pb-1">{thoughts}</p>
          </details>
        )}

        {/* Track list */}
        <div className="flex-1 overflow-y-auto">
          <ol>
            {tracks.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-4 px-4 md:px-8 py-3 border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors"
              >
                {/* Track number */}
                <span className="text-sm text-zinc-600 w-6 text-right shrink-0 tabular-nums">
                  {i + 1}
                </span>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{t.title}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{t.artist}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 md:px-8 py-4 border-t border-zinc-800 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            Opens the <span className="text-zinc-400">TastemakerPlaylist</span> shortcut on your iPhone.
          </p>
          <button onClick={reset} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
            ← New playlist
          </button>
        </div>

      </div>
    )
  }

  // ── Prompt input ─────────────────────────────────────────────────────────
  const examples = [
    'My top 25 songs in May 2025',
    'Funk playlist for my party Friday',
    'Songs to read Brothers Karamazov to',
    'My favorite fall songs',
    'Late night jazz from my history',
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6">
      <div className="max-w-xl w-full mx-auto flex flex-col gap-6">

        {/* Prompt box */}
        <div>
          {modifying ? (
            <div className="mb-3">
              <p className="text-zinc-100 font-semibold text-lg">Modify playlist</p>
              <p className="text-zinc-500 text-sm mt-0.5">
                Modifying <span className="text-zinc-300">"{modifying.name}"</span>
                <button onClick={() => setModifying(null)} className="text-zinc-600 hover:text-zinc-400 ml-2 text-xs">cancel</button>
              </p>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-zinc-100 font-semibold text-lg">Make a playlist</p>
              <p className="text-zinc-500 text-sm mt-1">Describe the vibe — built from your actual listening history.</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <textarea
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
              rows={3}
              placeholder={modifying ? 'How should it change? e.g. "add more upbeat tracks"' : 'Describe the playlist you want…'}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(modifying) }}
            />
            <button
              onClick={() => submit(modifying)}
              disabled={!prompt.trim()}
              className="self-end bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              {modifying ? 'Modify playlist' : 'Build playlist'}
            </button>
          </div>

          {status === 'error' && (
            <div className="mt-3 bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
              <p className="text-red-500 text-xs">{errorMsg}</p>
              <p className="text-zinc-600 text-xs mt-2">Check Pi logs: <code className="text-zinc-400">docker compose logs backend -f</code></p>
            </div>
          )}
        </div>

        {/* Example chips — only when not modifying */}
        {!modifying && (
          <div>
            <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Examples</p>
            <div className="flex flex-wrap gap-2">
              {examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved playlists */}
        {saved.length > 0 && (
          <div>
            <p className="text-xs text-zinc-600 mb-3 uppercase tracking-wider">Saved playlists</p>
            <div className="flex flex-col gap-2">
              {saved.map(p => (
                <PlaylistCard
                  key={p.playlist_id}
                  playlist={p}
                  onDelete={handleDelete}
                  onModify={handleModify}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
