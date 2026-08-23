// Persistent disclosure banner for the static GitHub Pages build — makes it
// clear that chat/action-bus replies are pre-recorded fixtures, not a live
// model call, without anyone having to guess.
export function DemoBanner() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null

  return (
    <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-1.5 bg-violet-950/60 border-b border-violet-800/50 text-violet-300 text-[11px] text-center">
      <span className="font-semibold text-violet-200">Demo mode</span>
      <span>— chat &amp; action-bus replies are pre-recorded.</span>
      <span className="text-violet-400">Self-hosted, this calls Claude live.</span>
    </div>
  )
}
