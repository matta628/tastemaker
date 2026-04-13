// Sync tab — Last.fm sync status + enrichment progress with live polling.
import { useEffect, useState, useRef } from 'react'

const BASE = '/api'
const POLL_MS = 8000  // poll every 8s while something is running

function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1.5">
      <div
        className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function StatusDot({ stale }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
  )
}

function formatAge(daysAgo) {
  if (daysAgo === null) return 'Never'
  if (daysAgo < 1) return 'Today'
  if (daysAgo < 2) return 'Yesterday'
  return `${Math.floor(daysAgo)} days ago`
}

export function SyncTab() {
  const [status,      setStatus]      = useState(null)
  const [syncState,   setSyncState]   = useState('idle')   // idle | running | done | error
  const [enrichState, setEnrichState] = useState('idle')
  const pollRef = useRef(null)

  const fetchStatus = () => {
    fetch(`${BASE}/pipelines/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }

  // Start polling when enrichment or sync is running; stop when idle
  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    const running = syncState === 'running' || enrichState === 'running'
    if (running) {
      pollRef.current = setInterval(fetchStatus, POLL_MS)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [syncState, enrichState])

  const triggerSync = async () => {
    setSyncState('running')
    try {
      const res = await fetch(`${BASE}/pipelines/lastfm/sync`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setSyncState('running')  // stays running until we see updated timestamp
      setTimeout(() => { setSyncState('done'); fetchStatus() }, 3000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }

  const triggerEnrich = async () => {
    setEnrichState('running')
    try {
      const res = await fetch(`${BASE}/pipelines/lastfm/enrich`, { method: 'POST' })
      if (!res.ok) throw new Error()
      // Enrichment runs for hours — keep polling to show live progress
    } catch {
      setEnrichState('error')
      setTimeout(() => setEnrichState('idle'), 4000)
    }
  }

  const enrich = status?.enrichment

  // Determine if enrichment is actively running by checking if pct is < 100
  // and enrichState is running
  const enrichRunning = enrichState === 'running'
  const enrichComplete = enrich &&
    enrich.artist_tags.pct >= 100 &&
    enrich.artist_similar.pct >= 100 &&
    enrich.track_tags.pct >= 100

  return (
    <div className="max-w-xl mx-auto px-6 py-6 flex flex-col gap-8">

      {/* ── Last.fm Sync ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-zinc-100 font-semibold">Last.fm Sync</h3>
          <button
            onClick={triggerSync}
            disabled={syncState === 'running'}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 px-4 py-1.5 rounded-lg transition-colors"
          >
            {syncState === 'idle'    && '↻ Sync now'}
            {syncState === 'running' && '↻ Syncing…'}
            {syncState === 'done'    && '✓ Started'}
            {syncState === 'error'   && '✗ Failed'}
          </button>
        </div>

        {status ? (
          <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 flex items-center">
                <StatusDot stale={status.lastfm.stale} />
                Last synced
              </span>
              <span className="text-zinc-300">{formatAge(status.lastfm.days_ago)}</span>
            </div>
            {status.lastfm.last_fetched_at && (
              <p className="text-xs text-zinc-600">
                {new Date(status.lastfm.last_fetched_at).toLocaleString()}
              </p>
            )}
            {status.lastfm.stale && (
              <p className="text-xs text-amber-500 mt-1">
                Data is stale — sync to pull your recent scrobbles.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
        )}
      </section>

      {/* ── Enrichment ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-zinc-100 font-semibold">Tag Enrichment</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Genre tags, similar artists, mood tags — powers playlist generation</p>
          </div>
          {!enrichComplete && (
            <button
              onClick={triggerEnrich}
              disabled={enrichRunning}
              className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 px-4 py-1.5 rounded-lg transition-colors shrink-0 ml-4"
            >
              {enrichRunning ? '◈ Running…' : '◈ Run enrichment'}
            </button>
          )}
        </div>

        {enrich ? (
          <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-5">

            {enrichComplete && (
              <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                <span>✓</span> All passes complete
                {enrich.last_fetched_at && (
                  <span className="text-zinc-600 ml-1">· {formatAge(enrich.days_ago)}</span>
                )}
              </p>
            )}

            {[
              { key: 'artist_tags',    label: 'Artist tags',     desc: 'genre · mood · era' },
              { key: 'artist_similar', label: 'Similar artists', desc: 'taste graph' },
              { key: 'track_tags',     label: 'Track tags',      desc: 'seasonal · mood' },
            ].map(({ key, label, desc }) => {
              const p = enrich[key]
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">
                      {label}
                      <span className="text-zinc-600 ml-2 text-xs">{desc}</span>
                    </span>
                    <span className="text-zinc-400 text-xs tabular-nums">
                      {p.done.toLocaleString()} / {p.total.toLocaleString()}
                      <span className="text-zinc-600 ml-1.5">{p.pct}%</span>
                    </span>
                  </div>
                  <ProgressBar pct={p.pct} />
                </div>
              )
            })}

            {enrichRunning && (
              <p className="text-xs text-zinc-500 animate-pulse">
                Running in background — this page updates every {POLL_MS / 1000}s. Safe to navigate away.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
        )}
      </section>

    </div>
  )
}
