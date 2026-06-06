export function ChartCard({ title, hint, children, loading, error, className = '' }) {
  return (
    <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{title}</h3>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>
      <div className="flex-1 min-h-0 px-4 pb-4">
        {loading ? (
          <div className="h-full min-h-[140px] flex items-center justify-center">
            <span className="text-zinc-700 text-xs">Loading…</span>
          </div>
        ) : error ? (
          <div className="h-full min-h-[140px] flex items-center justify-center">
            <span className="text-zinc-700 text-xs">No data</span>
          </div>
        ) : children}
      </div>
    </div>
  )
}
