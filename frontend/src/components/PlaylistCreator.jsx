import { useEffect, useState } from 'react'
import { useChatContext } from './ChatContext'
import { TrackLoader } from './OldChat'
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

// ── Helpers ────────────────────────────────────────────────────────────────

function parseTracks(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : (raw || [])
}
function parseQueries(raw) {
  if (!raw) return []
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}
function buildClipboardText(playlist) {
  const tracks = parseTracks(playlist.tracks)
  return [playlist.name, ...tracks.map(t => `${t.artist} -;- ${t.title}`)].join('\n')
}

// ── Playlist card (list view — compact, no expand) ────────────────────────

function PlaylistCard({ playlist, onModify, onDelete, onOpen }) {
  const [copied, setCopied] = useState(false)
  const tracks = parseTracks(playlist.tracks)

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(buildClipboardText(playlist)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
      onClick={() => onModify(playlist)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{playlist.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {tracks.length} tracks · {new Date(playlist.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onOpen(playlist.shortcuts_url) }}
            className="text-base text-zinc-400 hover:text-violet-400 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Open in Apple Music">↗</button>
          <button onClick={handleCopy}
            className="text-base text-zinc-400 hover:text-zinc-200 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Copy to clipboard">{copied ? '✓' : '⎘'}</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(playlist.playlist_id) }}
            className="text-zinc-500 hover:text-red-400 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modify target card ─────────────────────────────────────────────────────

function ModifyTarget({ playlist, onDelete, onCancel }) {
  const tracks = parseTracks(playlist.tracks)
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors rounded-t-xl"
        onClick={onCancel}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{playlist.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{tracks.length} tracks · {new Date(playlist.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDelete(playlist.playlist_id) }}
            className="text-zinc-500 hover:text-red-400 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Delete"><TrashIcon /></button>
        </div>
      </div>
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
    plThoughts, plPlaylist, plToolMsg, plErrorMsg,
    plSaved, plModifying, setPlModifying,
    submitPlaylist, resetPlaylist, deletePlaylist, fetchSaved,
  } = useChatContext()

  const { tracks: lyrics } = useLyrics()
  const [detailTab, setDetailTab] = useState('reasoning')
  const [mobileTab, setMobileTab] = useState('new')

  useEffect(() => { fetchSaved() }, [fetchSaved])

  const handleOpen = (url) => {
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  const handleModify = (playlist) => {
    if (plModifying?.playlist_id === playlist.playlist_id) {
      setPlModifying(null)
      setPlPrompt('')
    } else {
      setPlModifying(playlist)
      setPlPrompt('')
    }
  }

  const handleDelete = async (id) => {
    await deletePlaylist(id)
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

  // ── New playlist result ───────────────────────────────────────────────────
  if (plStatus === 'done' && plPlaylist) {
    const tracks = parseTracks(plPlaylist.tracks)
    const queries = parseQueries(plPlaylist.queries)

    return <ResultView
      playlist={plPlaylist}
      thoughts={plPlaylist.thoughts || plThoughts}
      tracks={tracks}
      queries={queries}
      modifying={plModifying}
      onBack={resetPlaylist}
      onOpen={handleOpen}
    />
  }

  // ── Prompt input + saved playlists ────────────────────────────────────────
  const examples = [
    'My top 25 songs in May 2025',
    'Funk playlist for my party Friday',
    'Songs to read Brothers Karamazov to',
    'My favorite fall songs',
    'Late night jazz from my history',
  ]

  const savedCount = plSaved.length

  // Prompt + examples panel (shared between mobile "New" tab and desktop left column)
  const NewPanel = (
    <div className="max-w-lg mx-auto flex flex-col gap-6 w-full">
      {plModifying ? (
        <div>
          <p className="text-zinc-100 font-semibold text-lg">Modify playlist</p>
          <p className="text-zinc-500 text-sm mt-0.5">Describe what should change below.</p>
        </div>
      ) : (
        <div>
          <p className="text-zinc-100 font-semibold text-lg">Make a playlist</p>
          <p className="text-zinc-500 text-sm mt-1">Describe the vibe — built from your actual listening history.</p>
        </div>
      )}

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

      {plStatus === 'error' && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm font-medium mb-1">Something went wrong</p>
          <p className="text-red-500 text-xs">{plErrorMsg}</p>
        </div>
      )}

      {!plModifying && (
        <div>
          <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Examples</p>
          <div className="flex flex-wrap gap-2">
            {examples.map(ex => (
              <button
                key={ex}
                onClick={() => setPlPrompt(ex)}
                className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
              >{ex}</button>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning / SQL for modify mode (left column on desktop) */}
      {plModifying && (() => {
        const thoughts = plModifying.thoughts
        const queries  = parseQueries(plModifying.queries)
        if (!thoughts && queries.length === 0) return null
        const tabs = [
          thoughts        && { id: 'reasoning', label: 'Reasoning' },
          queries.length  && { id: 'sql',       label: `SQL (${queries.length})` },
        ].filter(Boolean)
        const active = tabs.find(t => t.id === detailTab) ? detailTab : tabs[0].id
        return (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex border-b border-zinc-800">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setDetailTab(t.id)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${
                    active === t.id ? 'text-violet-400 bg-zinc-900' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-900/50'
                  }`}>{t.label}</button>
              ))}
            </div>
            <div>
              {active === 'reasoning' && thoughts && (
                <p className="px-4 py-4 text-xs text-zinc-500 whitespace-pre-wrap leading-relaxed">{thoughts}</p>
              )}
              {active === 'sql' && queries.map((q, i) => (
                <div key={i} className="px-4 py-4 border-b border-zinc-800/60 last:border-0">
                  {queries.length > 1 && <p className="text-xs text-zinc-600 mb-2">Query {i + 1}</p>}
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{q}</pre>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )

  // Saved playlists panel (shared between mobile "Saved" tab and desktop right column)
  const SavedPanel = (
    <div className="max-w-lg mx-auto flex flex-col gap-3 w-full">
      {plModifying ? (
        <>
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Modifying</p>
          <ModifyTarget
            playlist={plModifying}
            onDelete={handleDelete}
            onCancel={() => { setPlModifying(null); setPlPrompt('') }}
          />
        </>
      ) : savedCount > 0 ? (
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
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Mobile tab bar (hidden on desktop) ── */}
      <div className="md:hidden shrink-0 flex border-b border-zinc-800">
        {[
          { id: 'new',   label: 'New' },
          { id: 'saved', label: savedCount > 0 ? `Saved (${savedCount})` : 'Saved' },
        ].map(t => (
          <button key={t.id} onClick={() => setMobileTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mobileTab === t.id
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-zinc-500'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Mobile content ── */}
      <div className="md:hidden flex-1 overflow-y-auto px-6 py-6">
        {mobileTab === 'new'   ? NewPanel   : SavedPanel}
      </div>

      {/* ── Desktop two-column (hidden on mobile) ── */}
      <div className="hidden md:flex flex-row flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-zinc-800 overflow-y-auto px-6 py-6 shrink-0">
          {NewPanel}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {SavedPanel}
        </div>
      </div>

    </div>
  )
}

// ── Result view (newly generated playlist) ────────────────────────────────

function TrackList({ tracks, padded = false }) {
  const px = padded ? 'px-6' : 'px-4'
  return (
    <ol>
      {tracks.map((t, i) => (
        <li key={i} className={`flex items-center gap-4 ${px} py-3 border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors`}>
          <span className="text-sm text-zinc-600 w-6 text-right shrink-0 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{t.title}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{t.artist}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function ReasoningContent({ thoughts, queries, padded = false }) {
  const px = padded ? 'px-6' : 'px-4'
  return (
    <div className={`${px} py-4 flex flex-col gap-4`}>
      {thoughts && (
        <p className="text-xs text-zinc-500 whitespace-pre-wrap leading-relaxed">{thoughts}</p>
      )}
      {queries.length > 0 && (
        <div className="flex flex-col gap-3">
          {queries.length > 1 && <p className="text-xs text-zinc-600 uppercase tracking-wider">SQL queries</p>}
          {queries.map((q, i) => (
            <div key={i}>
              {queries.length > 1 && <p className="text-xs text-zinc-600 mb-1">Query {i + 1}</p>}
              <pre className="text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">{q}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultView({ playlist, thoughts, tracks, queries, modifying, onBack, onOpen }) {
  const [tab, setTab] = useState('tracks')
  const [copied, setCopied] = useState(false)

  const hasReasoning = !!thoughts
  const hasSql = queries.length > 0

  const mobileTabs = [
    { id: 'tracks',    label: 'Tracks' },
    hasReasoning && { id: 'reasoning', label: 'Reasoning' },
    hasSql       && { id: 'sql',       label: `SQL (${queries.length})` },
  ].filter(Boolean)

  const handleCopy = () => {
    navigator.clipboard.writeText(buildClipboardText(playlist)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header — always full width */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={onBack}
              className="mt-0.5 shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Back">
              <BackArrow />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">
                {modifying ? 'Modified playlist' : 'New playlist'} · {tracks.length} tracks
              </p>
              <h3 className="text-xl font-semibold text-zinc-100 leading-tight">{playlist.name}</h3>
              <p className="text-xs text-zinc-600 mt-1 italic truncate">"{playlist.prompt}"</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-2 rounded-xl transition-colors">
              {copied ? '✓' : '⎘'}
            </button>
            <button onClick={() => onOpen(playlist.shortcuts_url)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors">
              <span>Add</span>
              <span className="text-base leading-none">↗</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: tab bar + tab content ── */}
      {mobileTabs.length > 1 && (
        <div className="md:hidden shrink-0 flex border-b border-zinc-800 px-4">
          {mobileTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500'
              }`}>{t.label}</button>
          ))}
        </div>
      )}

      <div className="md:hidden flex-1 min-h-0 overflow-y-auto">
        {tab === 'tracks'    && <TrackList tracks={tracks} />}
        {tab === 'reasoning' && (
          <div className="px-4 py-4">
            <p className="text-xs text-zinc-500 whitespace-pre-wrap leading-relaxed">{thoughts}</p>
          </div>
        )}
        {tab === 'sql' && (
          <div className="px-4 py-4 flex flex-col gap-3">
            {queries.map((q, i) => (
              <div key={i}>
                {queries.length > 1 && <p className="text-xs text-zinc-600 mb-1">Query {i + 1}</p>}
                <pre className="text-xs text-zinc-400 bg-zinc-800/60 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">{q}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: two-column ── */}
      <div className="hidden md:flex flex-1 min-h-0">
        {/* Left: reasoning + SQL */}
        {(hasReasoning || hasSql) && (
          <div className="w-2/5 border-r border-zinc-800 overflow-y-auto shrink-0">
            <ReasoningContent thoughts={thoughts} queries={queries} padded />
          </div>
        )}
        {/* Right: tracks */}
        <div className="flex-1 overflow-y-auto">
          <TrackList tracks={tracks} padded />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Opens the <span className="text-zinc-400">TastemakerPlaylist</span> shortcut on your iPhone.
        </p>
      </div>

    </div>
  )
}
