// Sync tab — pure view; all state lives in ChatContext so it persists across tab switches.
import { useChatContext } from './ChatContext'

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
  if (daysAgo === null || daysAgo === undefined) return 'Never'
  if (daysAgo < 1) return 'Today'
  if (daysAgo < 2) return 'Yesterday'
  return `${Math.floor(daysAgo)} days ago`
}

export function SyncTab() {
  const {
    pipelineStatus: status,
    syncState, enrichState, enrichStuck,
    triggerSync, triggerEnrich,
  } = useChatContext()

  const enrich = status?.enrichment
  // Complete = process finished with no error (skipped entries mean pct never hits 100)
  const enrichComplete = enrich && !enrich.process_running && !enrich.last_error && enrich.last_fetched_at

  const enrichRunning = enrichState === 'running'
  const enrichError   = enrichState === 'error'

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

      {/* ── Tag Enrichment ── */}
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
              {enrichRunning ? '◈ Running…' : enrichError ? '↻ Retry' : '◈ Run enrichment'}
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

            {/* Status messages */}
            {enrichRunning && !enrichStuck && (
              <p className="text-xs text-zinc-500 animate-pulse">
                Running in background — safe to navigate away. Updates every 8s.
              </p>
            )}

            {enrichRunning && enrichStuck && (
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2.5">
                <p className="text-xs text-amber-400 font-medium mb-1">Progress has stalled</p>
                <p className="text-xs text-amber-600">No new tags in ~40s. The process may be rate-limited or stuck.</p>
                <p className="text-xs text-zinc-600 mt-1.5">
                  Check Pi logs: <code className="text-zinc-400">docker compose logs backend -f</code>
                </p>
              </div>
            )}

            {enrichError && enrich.last_error && (
              <div className="bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-400 font-medium mb-1">Enrichment failed</p>
                <p className="text-xs text-red-600 font-mono break-all">{enrich.last_error}</p>
                <p className="text-xs text-zinc-600 mt-1.5">
                  Full logs: <code className="text-zinc-400">docker compose logs backend -f</code>
                </p>
              </div>
            )}

            {enrichError && !enrich.last_error && (
              <p className="text-xs text-red-400">
                Enrichment stopped unexpectedly. Check Pi logs: <code className="text-zinc-500">docker compose logs backend -f</code>
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
