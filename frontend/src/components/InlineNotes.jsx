import { useState, useRef, useEffect } from 'react'

export function InlineNotes({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value || '')) onSave(draft)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        placeholder="Add notes…"
        className="w-full bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value || ''); setEditing(true) }}
      className="block text-xs truncate cursor-text group/notes"
      title={value || 'Click to add notes'}
    >
      {value
        ? <span className="text-zinc-400 group-hover/notes:text-zinc-200 transition-colors">{value}</span>
        : <span className="text-zinc-700 italic group-hover/notes:text-zinc-500 transition-colors">add notes…</span>
      }
    </span>
  )
}
