/**
 * Demo mode fetch interceptor.
 * Installed once before React mounts. Intercepts all /api/* calls and
 * returns fixture data or fake SSE streams — no backend required.
 */

import songs_fixture      from './fixtures/songs.json'
import playlists_fixture  from './fixtures/playlists.json'
import chats_fixture      from './fixtures/chats.json'
import chat_messages_fix  from './fixtures/chat_messages.json'
import pipeline_fixture   from './fixtures/pipeline_status.json'
import lyrics_fixture     from './fixtures/lyrics.json'
import playlist_stream    from './fixtures/playlist_stream.js'
import chat_stream        from './fixtures/chat_stream.js'

// ---------------------------------------------------------------------------
// In-memory state (resets on page refresh — intentional for demo)
// ---------------------------------------------------------------------------

let songs     = songs_fixture.map(s => ({ ...s }))
let playlists = playlists_fixture.map(p => ({ ...p }))
let chats     = chats_fixture.map(c => ({ ...c }))
let practice  = {}  // { song_id: [{ log_id, song_id, practiced_at }] }

function uuid() {
  return 'demo-' + Math.random().toString(36).slice(2, 10)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent() {
  return new Response(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// SSE stream helper
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function makeSSEStream(events) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        for (const { event, data, delayMs } of events) {
          await sleep(delayMs)
          const line =
            event === 'message'
              ? `data: ${data}\n\n`
              : `event: ${event}\ndata: ${data}\n\n`
          controller.enqueue(enc.encode(line))
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function route(url, method, body) {
  const path = url.replace(/^\/api/, '')

  // Health
  if (path === '/health' && method === 'GET')
    return json({ status: 'ok' })

  // Songs
  if (path === '/songs' && method === 'GET')
    return json(songs)

  if (path === '/songs' && method === 'POST') {
    const song = { ...body, song_id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    songs.unshift(song)
    return json(song, 201)
  }

  const songMatch = path.match(/^\/songs\/([^/]+)$/)
  if (songMatch) {
    const id = songMatch[1]
    if (method === 'PUT') {
      songs = songs.map(s => s.song_id === id ? { ...s, ...body, updated_at: new Date().toISOString() } : s)
      return json(songs.find(s => s.song_id === id))
    }
    if (method === 'DELETE') {
      songs = songs.filter(s => s.song_id !== id)
      return noContent()
    }
  }

  const practiceMatch = path.match(/^\/songs\/([^/]+)\/practice$/)
  if (practiceMatch) {
    const id = practiceMatch[1]
    if (method === 'GET')
      return json(practice[id] || [])
    if (method === 'POST') {
      const entry = { log_id: uuid(), song_id: id, practiced_at: new Date().toISOString() }
      practice[id] = [...(practice[id] || []), entry]
      return json(entry, 201)
    }
  }

  const practiceDeleteMatch = path.match(/^\/practice\/([^/]+)$/)
  if (practiceDeleteMatch && method === 'DELETE') {
    const lid = practiceDeleteMatch[1]
    for (const id in practice) practice[id] = practice[id].filter(e => e.log_id !== lid)
    return noContent()
  }

  // Chats
  if (path === '/chats' && method === 'GET')
    return json(chats)

  if (path === '/chats' && method === 'POST') {
    const chat = { chat_id: uuid(), title: body.title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    chats.unshift(chat)
    return json(chat, 201)
  }

  const chatMatch = path.match(/^\/chats\/([^/]+)$/)
  if (chatMatch) {
    const id = chatMatch[1]
    if (method === 'DELETE') {
      chats = chats.filter(c => c.chat_id !== id)
      return noContent()
    }
  }

  const chatMsgsMatch = path.match(/^\/chats\/([^/]+)\/messages$/)
  if (chatMsgsMatch) {
    const id = chatMsgsMatch[1]
    if (method === 'GET')
      return json(chat_messages_fix[id] || [])
    if (method === 'POST')
      return json({ ok: true }, 201)
  }

  // Playlists
  if (path === '/playlists' && method === 'GET')
    return json(playlists)

  const plMatch = path.match(/^\/playlists\/([^/]+)$/)
  if (plMatch && method === 'DELETE') {
    playlists = playlists.filter(p => p.playlist_id !== plMatch[1])
    return noContent()
  }

  // Agent — playlist (SSE stream)
  if (path === '/agent/playlist' && method === 'POST')
    return makeSSEStream(playlist_stream)

  // Agent — chat (SSE stream)
  if (path === '/agent/chat' && method === 'POST')
    return makeSSEStream(chat_stream)

  // Pipelines — status
  if (path === '/pipelines/status' && method === 'GET')
    return json(pipeline_fixture)

  // Pipelines — any trigger/upload (silently succeed)
  if (path.startsWith('/pipelines/') && method === 'POST')
    return json({ status: 'demo_mode' })

  // Taste / lyrics
  if ((path === '/taste/lyrics-snippets' || path.startsWith('/taste/top-tracks')) && method === 'GET')
    return json(lyrics_fixture)

  // Fallback
  console.warn('[demo] unhandled:', method, path)
  return json({ error: 'not found' }, 404)
}

// ---------------------------------------------------------------------------
// Fetch interceptor
// ---------------------------------------------------------------------------

export function installMockFetch() {
  const original = window.fetch
  window.fetch = async (input, init = {}) => {
    const url    = typeof input === 'string' ? input : input.url
    const method = (init.method || 'GET').toUpperCase()

    if (!url.startsWith('/api')) return original(input, init)

    let body = null
    if (init.body) {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }

    return route(url, method, body)
  }
}
