// Playlist Creator — prompt → agent → track list → iOS Shortcuts → Apple Music
import { useState, useRef } from 'react'
import { useLyrics } from './useLyrics'
import { LyricsTape } from './LyricsTape'

const BASE = '/api'

export function PlaylistCreator() {
  const [prompt, setPrompt]       = useState('')
  const [status, setStatus]       = useState('idle')   // idle | loading | done | error
  const [thoughts, setThoughts]   = useState('')        // agent's reasoning text
  const [playlist, setPlaylist]   = useState(null)      // { name, tracks, shortcuts_url }
  const [toolMsg, setToolMsg]     = useState('')
  const abortRef                  = useRef(null)
  const lyrics                    = useLyrics()

  const submit = async () => {
    if (!prompt.trim() || status === 'loading') return

    setStatus('loading')
    setThoughts('')
    setPlaylist(null)
    setToolMsg('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${BASE}/agent/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()  // keep incomplete line

        let eventType = 'message'
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (eventType === 'done') break
            if (eventType === 'tool_start') {
              setToolMsg(data === 'build_playlist' ? 'Building playlist…' : 'Querying your data…')
            } else if (eventType === 'tool_end') {
              setToolMsg('')
            } else if (eventType === 'playlist') {
              try { setPlaylist(JSON.parse(data)) } catch { /* ignore */ }
            } else {
              // regular text token
              setThoughts(prev => prev + data)
            }
          }
        }
      }

      setStatus('done')
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('error')
    }
  }

  const openShortcut = () => {
    if (playlist?.shortcuts_url) window.location.href = playlist.shortcuts_url
  }

  const reset = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setPrompt('')
    setThoughts('')
    setPlaylist(null)
    setToolMsg('')
  }

  // ── Loading state: lyrics carousel + pulsing status ──────────────────────
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
          <button
            onClick={reset}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Playlist result ───────────────────────────────────────────────────────
  if (status === 'done' && playlist) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{playlist.name}</h3>
            <p className="text-sm text-zinc-500 mt-0.5">{playlist.tracks.length} tracks</p>
          </div>
          <button
            onClick={openShortcut}
            className="shrink-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <span>Add to Apple Music</span>
            <span className="text-base">↗</span>
          </button>
        </div>

        {/* Agent reasoning (collapsed by default) */}
        {thoughts && (
          <details className="shrink-0 px-6 py-3 border-b border-zinc-800">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
              Agent reasoning
            </summary>
            <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap leading-relaxed">{thoughts}</p>
          </details>
        )}

        {/* Track list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ol className="space-y-1">
            {playlist.tracks.map((t, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1.5">
                <span className="text-xs text-zinc-600 w-6 text-right shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <span className="text-sm text-zinc-200">{t.title}</span>
                  <span className="text-sm text-zinc-500"> · {t.artist}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 mb-3">
            Tap "Add to Apple Music" → opens Shortcuts → playlist appears in your library.
            <br />
            You'll need the <span className="text-zinc-400">TastemakerPlaylist</span> shortcut set up on your iPhone.
          </p>
          <button
            onClick={reset}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Make another playlist
          </button>
        </div>
      </div>
    )
  }

  // ── Default: prompt input ─────────────────────────────────────────────────
  const examples = [
    'Funk playlist for my party Friday',
    'Songs to read Brothers Karamazov to',
    'My favorite fall songs',
    'Late night jazz from my history',
    'Rainy Sunday morning',
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6">
      <div className="max-w-xl w-full mx-auto flex flex-col gap-6">

        <div>
          <h2 className="text-zinc-100 font-semibold text-lg">Make a playlist</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Describe the vibe — the agent queries your actual listening history and builds it for you.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <textarea
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
            rows={3}
            placeholder="Describe the playlist you want…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          />
          <button
            onClick={submit}
            disabled={!prompt.trim()}
            className="self-end bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            Build playlist
          </button>
        </div>

        {status === 'error' && (
          <p className="text-red-400 text-sm">Something went wrong. Try again.</p>
        )}

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

      </div>
    </div>
  )
}
