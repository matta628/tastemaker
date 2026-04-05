import { useState, useRef, useEffect } from 'react'

function fmt(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toInputVal(dateStr) {
  if (!dateStr) return ''
  return dateStr.slice(0, 10) // YYYY-MM-DD
}

export function InlineDate({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = (e) => {
    setEditing(false)
    if (e.target.value && e.target.value !== toInputVal(value)) {
      onSave(e.target.value)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={toInputVal(value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit(e)
          if (e.key === 'Escape') setEditing(false)
        }}
        className="bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none w-32"
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-xs cursor-text group/date"
      title="Click to edit date"
    >
      {value
        ? <span className="text-zinc-400 group-hover/date:text-zinc-200 transition-colors">{fmt(value)}</span>
        : <span className="text-zinc-700 italic group-hover/date:text-zinc-500 transition-colors">no date</span>
      }
    </span>
  )
}
