import { useCallback, useState } from 'react'

/**
 * Drives a scripted, turn-by-turn chat demo. The next scripted user message
 * sits as greyed-out placeholder text in an otherwise-empty input — Tab
 * copies it into the real (editable) input, Enter sends whatever text is in
 * the input, falling back to the ghost text if the input is empty. Once
 * `turns` is exhausted, `done` flips true and callers should stop accepting
 * input.
 *
 * `turns` is an array of objects each carrying a `user` string; everything
 * else on each turn is caller-defined (mockFetch.js reads the same array to
 * decide how to answer).
 */
export function useGhostScript(turns) {
  const [turnIndex, setTurnIndex] = useState(0)

  const done = turnIndex >= turns.length
  const ghostText = done ? null : turns[turnIndex].user

  const advance = useCallback(() => {
    setTurnIndex((i) => Math.min(i + 1, turns.length))
  }, [turns.length])

  const reset = useCallback(() => setTurnIndex(0), [])

  // Call from onKeyDown. Fills `inputValue` with the ghost text on Tab when
  // the real input is empty. Returns true if it handled the key.
  const handleTabFill = useCallback(
    (e, inputValue, setInputValue) => {
      if (e.key !== 'Tab' || done || inputValue) return false
      e.preventDefault()
      setInputValue(ghostText)
      return true
    },
    [done, ghostText]
  )

  return { ghostText, done, turnIndex, advance, reset, handleTabFill }
}
