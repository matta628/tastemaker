// Sync tab — pure view; all state lives in ChatContext so it persists across tab switches.
import { useRef } from 'react'
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

function UploadButton({ label, accept, state, onFile, running }) {
  const inputRef = useRef(null)
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={running}
        className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 px-4 py-1.5 rounded-lg transition-colors shrink-0"
      >
        {running ? '↑ Importing…' : state === 'done' ? '✓ Imported' : state === 'error' ? '↻ Retry' : label}
      </button>
    </div>
  )
}

export function SyncTab() {
  const {
    pipelineStatus: status,
    syncState, enrichState, enrichStuck,
    triggerSync, triggerEnrich,
    goodreadsState, guitarState,
    uploadGoodreads, uploadGuitar,
    mbState, triggerMusicBrainz,
  } = useChatContext()

  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    return (
      <div className="px-6 py-8 max-w-lg mx-auto">
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-zinc-300 mb-1">Demo mode</p>
          <p className="text-sm text-zinc-500">
            Pipeline sync is disabled here. In the real app, this tab syncs your Last.fm scrobble history
            (~121k plays since 2019), enriches artist and track tags, and imports your Goodreads library — all
            running automatically on a Raspberry Pi via cron.
          </p>
        </div>
        <div className="flex flex-col gap-3 opacity-40 pointer-events-none select-none">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-sm text-zinc-400">Last.fm sync · last ran today</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-sm text-zinc-400">Tag enrichment · 87% complete</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-sm text-zinc-400">Goodreads · 247 books</p>
          </div>
        </div>
      </div>
    )
  }

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
              { key: 'track_tags',     label: 'Track tags',      desc: 'Last.fm community tags' },
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

            {/* Context tags — personal behavior derived, no pct denominator */}
            {enrich.context_tags && (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">
                    Personal context tags
                    <span className="text-zinc-600 ml-2 text-xs">time · season · frequency</span>
                  </span>
                  <span className="text-zinc-400 text-xs tabular-nums">
                    {enrich.context_tags.done.toLocaleString()} tracks
                  </span>
                </div>
              </div>
            )}

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

      {/* ── MusicBrainz ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-zinc-100 font-semibold">MusicBrainz</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Artist type, country, formed year — improves discovery filtering</p>
          </div>
          <button
            onClick={triggerMusicBrainz}
            disabled={mbState === 'running'}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 px-4 py-1.5 rounded-lg transition-colors shrink-0 ml-4"
          >
            {mbState === 'running' ? '◈ Running…' : mbState === 'error' ? '↻ Retry' : mbState === 'done' ? '✓ Done' : '◈ Run'}
          </button>
        </div>

        {status?.musicbrainz ? (
          <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  Artists enriched
                  <span className="text-zinc-600 ml-2 text-xs">type · country · genre</span>
                </span>
                <span className="text-zinc-400 text-xs tabular-nums">
                  {status.musicbrainz.artist_count.done.toLocaleString()} / {status.musicbrainz.artist_count.total.toLocaleString()}
                  <span className="text-zinc-600 ml-1.5">{status.musicbrainz.artist_count.pct}%</span>
                </span>
              </div>
              <ProgressBar pct={status.musicbrainz.artist_count.pct} />
            </div>
            {mbState === 'running' && (
              <p className="text-xs text-zinc-500 animate-pulse">
                Running — ~30–40 min for first full run (1 req/sec MusicBrainz limit). Safe to navigate away.
              </p>
            )}
            {mbState === 'error' && status.musicbrainz.last_error && (
              <p className="text-xs text-red-400 font-mono break-all">{status.musicbrainz.last_error}</p>
            )}
            {status.musicbrainz.last_fetched_at && mbState !== 'running' && (
              <p className="text-xs text-zinc-600">Last run: {formatAge(status.musicbrainz.days_ago)}</p>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
        )}
      </section>

      {/* ── Goodreads ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-zinc-100 font-semibold">Goodreads</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Export CSV from Goodreads → My Books → Import/Export</p>
          </div>
          <UploadButton
            label="↑ Upload CSV"
            accept=".csv"
            state={goodreadsState}
            running={goodreadsState === 'running'}
            onFile={uploadGoodreads}
          />
        </div>

        {status ? (
          <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 flex items-center">
                <StatusDot stale={status.goodreads?.stale ?? true} />
                Last imported
              </span>
              <span className="text-zinc-300">{formatAge(status.goodreads?.days_ago)}</span>
            </div>
            {status.goodreads?.last_fetched_at && (
              <p className="text-xs text-zinc-600">
                {new Date(status.goodreads.last_fetched_at).toLocaleString()}
              </p>
            )}
            {status.goodreads?.book_count > 0 && (
              <p className="text-xs text-zinc-500">
                {status.goodreads.book_count.toLocaleString()} books in library
              </p>
            )}
            {goodreadsState === 'running' && (
              <p className="text-xs text-zinc-500 animate-pulse">Importing — fetching OpenLibrary data per book…</p>
            )}
            {goodreadsState === 'error' && status.goodreads?.last_error && (
              <div className="bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2.5 mt-1">
                <p className="text-xs text-red-400 font-medium mb-1">Import failed</p>
                <p className="text-xs text-red-600 font-mono break-all">{status.goodreads.last_error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
        )}
      </section>

      {/* ── Ultimate Guitar ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-zinc-100 font-semibold">Ultimate Guitar</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Save ultimate-guitar.com/user/mytabs as HTML, upload here</p>
          </div>
          <UploadButton
            label="↑ Upload HTML"
            accept=".html,.htm"
            state={guitarState}
            running={guitarState === 'running'}
            onFile={uploadGuitar}
          />
        </div>

        {status ? (
          <div className="bg-zinc-900 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400 flex items-center">
                <StatusDot stale={status.guitar_import?.stale ?? true} />
                Last imported
              </span>
              <span className="text-zinc-300">{formatAge(status.guitar_import?.days_ago)}</span>
            </div>
            {status.guitar_import?.last_fetched_at && (
              <p className="text-xs text-zinc-600">
                {new Date(status.guitar_import.last_fetched_at).toLocaleString()}
              </p>
            )}
            {status.guitar_import?.song_count > 0 && (
              <p className="text-xs text-zinc-500">
                {status.guitar_import.song_count.toLocaleString()} songs in library
              </p>
            )}
            {guitarState === 'running' && (
              <p className="text-xs text-zinc-500 animate-pulse">Importing — adding new tabs…</p>
            )}
            {guitarState === 'error' && status.guitar_import?.last_error && (
              <div className="bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2.5 mt-1">
                <p className="text-xs text-red-400 font-medium mb-1">Import failed</p>
                <p className="text-xs text-red-600 font-mono break-all">{status.guitar_import.last_error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 text-zinc-600 text-sm animate-pulse">Loading…</div>
        )}
      </section>

    </div>
  )
}
