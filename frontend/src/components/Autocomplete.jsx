import { useState, useRef, useEffect } from 'react'

// Fuzzy match: every character in `query` appears in `str` in order (case-insensitive).
// Also boosts substring matches so they sort first.
function matches(str, query) {
  if (!query) return false
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  if (s.includes(q)) return true
  // subsequence check
  let si = 0
  for (const ch of q) {
    si = s.indexOf(ch, si)
    if (si === -1) return false
    si++
  }
  return true
}

function score(str, query) {
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  if (s.startsWith(q)) return 0
  if (s.includes(q)) return 1
  return 2 // subsequence
}

export function Autocomplete({ value, onChange, onSelect, suggestions, placeholder, className }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef(null)

  const filtered = suggestions
    .filter((s) => matches(s, value) && s.toLowerCase() !== value.toLowerCase())
    .sort((a, b) => score(a, value) - score(b, value))
    .slice(0, 6)

  useEffect(() => { setActive(0) }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (val) => {
    onSelect(val)
    setOpen(false)
  }

  const handleKey = (e) => {
    if (!open || !filtered.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); pick(filtered[active]) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => pick(s)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                i === active ? 'bg-violet-600 text-white' : 'text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
