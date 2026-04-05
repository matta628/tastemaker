const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getSongs: (status) =>
    request('GET', status ? `/songs?status=${status}` : '/songs'),
  addSong: (song) => request('POST', '/songs', song),
  updateSong: (id, updates) => request('PUT', `/songs/${id}`, updates),
  deleteSong: (id) => request('DELETE', `/songs/${id}`),
  logPractice:     (id)    => request('POST',   `/songs/${id}/practice`),
  getPracticeLog:  (id)    => request('GET',    `/songs/${id}/practice`),
  deletePractice:  (logId) => request('DELETE', `/practice/${logId}`),
}
