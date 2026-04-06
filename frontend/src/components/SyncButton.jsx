import { useState } from 'react'

export function SyncButton() {
  const [state, setState] = useState('idle') // idle | syncing | done | error

  const sync = async () => {
    setState('syncing')
    try {
      const res = await fetch('/api/pipelines/lastfm/sync', { method: 'POST' })
      if (!res.ok) throw new Error()
      setState('done')
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <button
      onClick={sync}
      disabled={state === 'syncing'}
      className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors text-left"
    >
      {state === 'idle'    && '↻ sync last.fm'}
      {state === 'syncing' && '↻ syncing…'}
      {state === 'done'    && '✓ sync started'}
      {state === 'error'   && '✗ sync failed'}
    </button>
  )
}
