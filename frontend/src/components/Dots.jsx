// Difficulty displayed as filled/empty dots: ●●●○○
// Pass onChange to make it interactive (click a dot to set difficulty).
export function Dots({ value, max = 5, size = 'md', onChange }) {
  const sz = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className={`${sz} tracking-wide ${onChange ? 'cursor-pointer select-none' : ''}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          onClick={onChange ? () => onChange(i + 1) : undefined}
          title={onChange ? `Set difficulty ${i + 1}` : undefined}
          className={`transition-colors ${
            i < value ? 'text-violet-400' : 'text-zinc-600'
          } ${onChange ? 'hover:text-violet-300' : ''}`}
        >
          {i < value ? '●' : '○'}
        </span>
      ))}
    </span>
  )
}
