/**
 * Canonical cache-key builder for the demo analytics fixture lookup.
 *
 * The real backend accepts arbitrary from_date/to_date, but every caller in
 * this app only ever produces one of two shapes:
 *   - relative to "now" (e.g. "last 90 days" from the Dashboard period
 *     buttons) — these drift by the second, so a demo built today can't
 *     bake literal dates and expect them to match a visitor's browser
 *     tomorrow.
 *   - an exact calendar-year era (Time Machine presets: 2021-01-01 .. 2022-01-01)
 *     — these are stable and could be matched literally, but are bucketed
 *     the same way for one consistent code path.
 *
 * So instead of keying fixtures by literal dates, both this file and
 * scripts/export_demo_fixtures.py key them by which *bucket* the range
 * falls into. Keep the two in sync — REL_DAYS/ERA_YEARS here must match
 * REL_DAYS/ERA_YEARS there.
 */

const REL_DAYS = {
  '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365,
  '2y': 730, '3y': 1095, '4y': 1460, '5y': 1825,
}
const KNOWN_DAY_SPANS = Object.entries(REL_DAYS) // [[label, days], ...]

function bucketize(fromDate, toDate) {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  if (isNaN(from) || isNaN(to)) return null

  // Exact calendar-year era: Jan 1 .. Jan 1 of the following year
  const isJan1 = (d) => d.getUTCMonth() === 0 && d.getUTCDate() === 1
  if (isJan1(from) && isJan1(to) && to.getUTCFullYear() === from.getUTCFullYear() + 1) {
    return `era:${from.getUTCFullYear()}`
  }

  // Otherwise, nearest known relative span
  const days = Math.round((to - from) / 86400000)
  let bestLabel = null
  let bestDiff = Infinity
  for (const [label, span] of KNOWN_DAY_SPANS) {
    const diff = Math.abs(span - days)
    if (diff < bestDiff) {
      bestDiff = diff
      bestLabel = label
    }
  }
  return `rel:${bestLabel}`
}

/**
 * Build the same canonical key the export script writes fixtures under.
 * `params` is a plain object of decoded query param values (from_date/
 * to_date get collapsed into a single `_range` bucket token; everything
 * else passes through unchanged).
 */
export function canonicalKey(path, params = {}) {
  const rest = { ...params }
  const fromDate = rest.from_date
  const toDate = rest.to_date
  delete rest.from_date
  delete rest.to_date

  if (fromDate && toDate) {
    const bucket = bucketize(fromDate, toDate)
    if (bucket) rest._range = bucket
  }

  const parts = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== null && rest[k] !== undefined)
    .map((k) => `${k}=${rest[k]}`)

  return parts.length ? `${path}?${parts.join('&')}` : path
}

/** Parse a fetch path (e.g. "/analytics/foo?a=1&b=2") into {path, params}. */
export function parsePathAndQuery(fullPath) {
  const [path, qs] = fullPath.split('?')
  const params = {}
  if (qs) {
    for (const [k, v] of new URLSearchParams(qs)) params[k] = v
  }
  return { path, params }
}
