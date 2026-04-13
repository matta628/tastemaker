// Shows a banner when Last.fm data hasn't been synced in 7+ days.
// Uses shared pipeline state from ChatContext so banner and SyncTab don't diverge.
import { useState } from 'react'
import { useChatContext } from './ChatContext'

export function StaleBanner() {
  const { pipelineStatus: status, syncState, enrichState, triggerSync, triggerEnrich } = useChatContext()
  const [dismissed, setDismissed] = useState(false)

  if (!status || dismissed) return null

  const syncStale   = status.lastfm?.stale
  const enrichStale = status.enrichment?.stale
  if (!syncStale && !enrichStale) return null

  const syncDays   = status.lastfm?.days_ago
  const enrichDays = status.enrichment?.days_ago

  let msg = ''
  if (syncStale && enrichStale) {
    msg = syncDays === null
      ? 'Last.fm has never been synced.'
      : `Last.fm synced ${Math.floor(syncDays)}d ago · enrichment ${enrichDays === null ? 'never run' : `${Math.floor(enrichDays)}d ago`}.`
  } else if (syncStale) {
    msg = syncDays === null
      ? 'Last.fm has never been synced.'
      : `Last.fm data is ${Math.floor(syncDays)} days old.`
  } else {
    msg = enrichDays === null
      ? 'Genre enrichment has never been run.'
      : `Genre enrichment is ${Math.floor(enrichDays)} days old.`
  }

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/50 text-amber-300 text-xs">
      <span className="text-amber-500">⚠</span>
      <span className="flex-1 text-amber-400">{msg}</span>

      {syncStale && (
        <button
          onClick={triggerSync}
          disabled={syncState === 'running' || syncState === 'done'}
          className="shrink-0 px-3 py-1 rounded-lg bg-amber-800/50 hover:bg-amber-700/60 disabled:opacity-50 transition-colors font-medium"
        >
          {syncState === 'idle'    && 'Sync Last.fm'}
          {syncState === 'running' && 'Syncing…'}
          {syncState === 'done'    && '✓ Started'}
          {syncState === 'error'   && '✗ Failed'}
        </button>
      )}

      {enrichStale && (
        <button
          onClick={triggerEnrich}
          disabled={enrichState === 'running' || enrichState === 'done'}
          className="shrink-0 px-3 py-1 rounded-lg bg-amber-800/50 hover:bg-amber-700/60 disabled:opacity-50 transition-colors font-medium"
        >
          {enrichState === 'idle'    && 'Run Enrichment'}
          {enrichState === 'running' && 'Enriching…'}
          {enrichState === 'done'    && '✓ Started'}
          {enrichState === 'error'   && '✗ Failed'}
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-600 hover:text-amber-400 transition-colors pl-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
