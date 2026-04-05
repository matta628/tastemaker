const CONFIG = {
  want_to_learn: { label: 'Want to Learn', classes: 'bg-zinc-700 text-zinc-300' },
  learning:      { label: 'Learning',       classes: 'bg-blue-900 text-blue-300' },
  learned:       { label: 'Learned',        classes: 'bg-emerald-900 text-emerald-300' },
  abandoned:     { label: 'Abandoned',      classes: 'bg-red-950 text-red-400' },
}

export function StatusPill({ status }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.want_to_learn
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}>
      {label}
    </span>
  )
}

export const STATUS_OPTIONS = Object.entries(CONFIG).map(([value, { label }]) => ({
  value,
  label,
}))
