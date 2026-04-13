import { useEffect, useState } from 'react'
import { useChatContext } from './ChatContext'
import { TrackLoader } from './AgentChat'
import { useLyrics } from './useLyrics'

// ── Icons ──────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

// ── Saved playlist card (list view) ───────────────────────────────────────

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
            className="text-zinc-600 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Delete"
          ><TrashIcon /></button>
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

// ── Expanded modify target card ────────────────────────────────────────────

function ModifyTarget({ playlist, onDelete, onCancel }) {
  const tracks = typeof playlist.tracks === 'string'
    ? JSON.parse(playlist.tracks)
    : playlist.tracks

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{playlist.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{tracks.length} tracks · {new Date(playlist.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Cancel edit"
          >✕ cancel</button>
          <button
            onClick={() => onDelete(playlist.playlist_id)}
            className="text-zinc-600 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Delete playlist"
          ><TrashIcon /></button>
        </div>
      </div>
      {/* Track list */}
      <div className="px-4 py-3">
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
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PlaylistCreator() {
  const {
    plPrompt, setPlPrompt,
    plStatus,
    plThoughts, plPlaylist, plToolMsg,
    plErrorMsg,
    plSaved, plModifying, setPlModifying,
    submitPlaylist, resetPlaylist, deletePlaylist, fetchSaved,
  } = useChatContext()

  const { tracks: lyrics } = useLyrics()

  useEffect(() => { fetchSaved() }, [fetchSaved])

  const handleOpen = (url) => { window.location.href = url }

  const handleModify = (playlist) => {
    setPlModifying(playlist)
    setPlPrompt('')
  }

  const handleDelete = async (id) => {
    await deletePlaylist(id)
    // If we were modifying this playlist, cancel the modify mode too
    if (plModifying?.playlist_id === id) setPlModifying(null)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (plStatus === 'loading') {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6">
        <div className="w-full max-w-sm bg-zinc-800 rounded-2xl">
          <TrackLoader tracks={lyrics} />
        </div>
        <p className="text-zinc-500 text-sm text-center">
          {plToolMsg || 'Listening to your history…'}
        </p>
        <p className="text-zinc-700 text-xs italic text-center">"{plPrompt}"</p>
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (plStatus === 'done' && plPlaylist) {
    const tracks = plPlaylist.tracks || []
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 md:px-8 pt-4 pb-4 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            {/* Back arrow + title */}
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={resetPlaylist}
                className="mt-0.5 shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Back to playlists"
              >
                <BackArrow />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">
                  {plModifying ? 'Modified playlist' : 'New playlist'} · {tracks.length} tracks
                </p>
                <h3 className="text-xl font-semibold text-zinc-100 leading-tight">{plPlaylist.name}</h3>
                <p className="text-xs text-zinc-600 mt-1 italic truncate">"{plPlaylist.prompt || plPrompt}"</p>
              </div>
            </div>
            <button
              onClick={() => handleOpen(plPlaylist.shortcuts_url)}
              className="shrink-0 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <span>Add to Apple Music</span>
              <span className="text-base leading-none">↗</span>
            </button>
          </div>
        </div>

        {/* Agent reasoning — collapsed */}
        {plThoughts && (
          <details className="shrink-0 px-4 md:px-8 py-2.5 border-b border-zinc-800/60">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 select-none">
              Agent reasoning
            </summary>
            <p className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap leading-relaxed pb-1">{plThoughts}</p>
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
                <span className="text-sm text-zinc-600 w-6 text-right shrink-0 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{t.title}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{t.artist}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer hint */}
        <div className="shrink-0 px-4 md:px-8 py-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            Opens the <span className="text-zinc-400">TastemakerPlaylist</span> shortcut on your iPhone.
          </p>
        </div>
      </div>
    )
  }

  // ── Prompt input + saved playlists (two-column on desktop) ────────────────
  const examples = [
    'My top 25 songs in May 2025',
    'Funk playlist for my party Friday',
    'Songs to read Brothers Karamazov to',
    'My favorite fall songs',
    'Late night jazz from my history',
  ]

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">

      {/* ── Left column: prompt + examples ────────────────────────────── */}
      <div className="md:w-1/2 md:border-r md:border-zinc-800 overflow-y-auto px-6 py-6 shrink-0">
        <div className="max-w-lg mx-auto flex flex-col gap-6">

          {/* Heading */}
          {plModifying ? (
            <div>
              <p className="text-zinc-100 font-semibold text-lg">Modify playlist</p>
              <p className="text-zinc-500 text-sm mt-0.5">
                Describe what should change below.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-zinc-100 font-semibold text-lg">Make a playlist</p>
              <p className="text-zinc-500 text-sm mt-1">Describe the vibe — built from your actual listening history.</p>
            </div>
          )}

          {/* Textarea + submit */}
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
              rows={3}
              placeholder={plModifying ? 'How should it change? e.g. "add more upbeat tracks"' : 'Describe the playlist you want…'}
              value={plPrompt}
              onChange={e => setPlPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitPlaylist(plPrompt, plModifying) }}
            />
            <button
              onClick={() => submitPlaylist(plPrompt, plModifying)}
              disabled={!plPrompt.trim()}
              className="self-end bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              {plModifying ? 'Modify playlist' : 'Build playlist'}
            </button>
          </div>

          {/* Error */}
          {plStatus === 'error' && (
            <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
              <p className="text-red-500 text-xs">{plErrorMsg}</p>
              <p className="text-zinc-600 text-xs mt-2">Check Pi logs: <code className="text-zinc-400">docker compose logs backend -f</code></p>
            </div>
          )}

          {/* Example chips — only when not modifying */}
          {!plModifying && (
            <div>
              <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Examples</p>
              <div className="flex flex-wrap gap-2">
                {examples.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setPlPrompt(ex)}
                    className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Right column: saved playlists (or modify target) ──────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 border-t border-zinc-800 md:border-t-0">
        <div className="max-w-lg mx-auto flex flex-col gap-4">

          {plModifying ? (
            /* Modify mode: show only the target playlist, expanded */
            <>
              <p className="text-xs text-zinc-600 uppercase tracking-wider">Modifying</p>
              <ModifyTarget
                playlist={plModifying}
                onDelete={handleDelete}
                onCancel={() => { setPlModifying(null); setPlPrompt('') }}
              />
            </>
          ) : plSaved.length > 0 ? (
            /* Normal mode: show all saved playlists */
            <>
              <p className="text-xs text-zinc-600 uppercase tracking-wider">Saved playlists</p>
              {plSaved.map(p => (
                <PlaylistCard
                  key={p.playlist_id}
                  playlist={p}
                  onDelete={handleDelete}
                  onModify={handleModify}
                  onOpen={handleOpen}
                />
              ))}
            </>
          ) : (
            <p className="text-zinc-700 text-sm text-center pt-8">No saved playlists yet.</p>
          )}

        </div>
      </div>

    </div>
  )
}
