import { useState } from 'react'

const BASE = '/api'

async function postPipeline(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' })
  if (!res.ok) throw new Error()
}

export function SyncButton() {
  const [syncState,   setSyncState]   = useState('idle')  // idle | running | done | error
  const [enrichState, setEnrichState] = useState('idle')

  const sync = async () => {
    setSyncState('running')
    try {
      await postPipeline('/pipelines/lastfm/sync')
      setSyncState('done')
      setTimeout(() => setSyncState('idle'), 4000)
    } catch {
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 4000)
    }
  }

  const enrich = async () => {
    setEnrichState('running')
    try {
      await postPipeline('/pipelines/lastfm/enrich')
      setEnrichState('done')
      setTimeout(() => setEnrichState('idle'), 4000)
    } catch {
      setEnrichState('error')
      setTimeout(() => setEnrichState('idle'), 4000)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={sync}
        disabled={syncState === 'running'}
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors text-left"
      >
        {syncState === 'idle'    && '↻ sync last.fm'}
        {syncState === 'running' && '↻ syncing…'}
        {syncState === 'done'    && '✓ sync started'}
        {syncState === 'error'   && '✗ sync failed'}
      </button>
      <button
        onClick={enrich}
        disabled={enrichState === 'running'}
        className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors text-left"
      >
        {enrichState === 'idle'    && '◈ enrich tags'}
        {enrichState === 'running' && '◈ enriching…'}
        {enrichState === 'done'    && '✓ enrich started'}
        {enrichState === 'error'   && '✗ enrich failed'}
      </button>
    </div>
  )
}
