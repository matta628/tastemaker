// Horizontal scrolling lyrics ticker shown at the top of every page.

export function LyricsTape({ tracks }) {
  if (!tracks.length) return null

  // Build tape items — prefer snippet, fall back to track title
  const items = tracks.map(t =>
    t.snippet
      ? `… ${t.snippet.replace(/\n\s*/g, ' / ')} … — ${t.track} · ${t.artist}`
      : `${t.track} · ${t.artist}`
  )

  // Separator between items
  const separator = '  ✦  '
  const content = items.join(separator) + separator

  return (
    <div className="w-full overflow-hidden border-b border-zinc-800 bg-zinc-950 py-1.5 select-none shrink-0">
      {/* Duplicate content so the loop is seamless */}
      <div className="flex animate-marquee whitespace-nowrap">
        <span className="text-xs text-zinc-500 pr-0">{content}</span>
        <span className="text-xs text-zinc-500 pr-0">{content}</span>
      </div>
    </div>
  )
}
