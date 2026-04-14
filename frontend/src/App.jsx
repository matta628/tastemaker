import { useEffect, useState } from 'react'
import { api } from './api'
import { SongLibrary } from './components/SongLibrary'
import { SongForm } from './components/SongForm'
import { PracticeQueue } from './components/PracticeQueue'
import { NudgePanel } from './components/NudgePanel'
import { AgentChat } from './components/AgentChat'
import { ChatProvider, useChatContext } from './components/ChatContext'
import { LyricsTape } from './components/LyricsTape'
import { Vibes } from './components/Vibes'
import { PlaylistCreator } from './components/PlaylistCreator'
import { SyncTab } from './components/SyncTab'
import { useLyrics } from './components/useLyrics'
import { SyncButton } from './components/SyncButton'
import { StaleBanner } from './components/StaleBanner'
import './index.css'

const NAV = [
  { id: 'Library',   icon: '📚', label: 'Library'   },
  { id: 'Practice',  icon: '🎸', label: 'Practice'  },
  { id: 'Add Song',  icon: '+',  label: 'Add Song'   },
  { id: 'Playlist',  icon: '♫',  label: 'Playlist'  },
  { id: 'Chat',      icon: '✦',  label: 'Chat'       },
  { id: 'Vibes',     icon: '♪',  label: 'Vibes'      },
  { id: 'Sync',      icon: '↻',  label: 'Sync'       },
]

function AppInner() {
  const { streaming } = useChatContext()
  const [tab, setTab] = useState('Library')
  const [songs, setSongs] = useState([])
  const { tracks: lyrics } = useLyrics()
  const [editingSong, setEditingSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSongs = async () => {
    try {
      const data = await api.getSongs()
      setSongs(data)
      setError(null)
    } catch (e) {
      setError('Could not reach the API. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSongs() }, [])

  const handleAdd = async (form) => {
    await api.addSong(form)
    await fetchSongs()
    setTab('Library')
  }

  const handleEdit = (song) => {
    setEditingSong(song)
    setTab('edit')
  }

  const handleUpdate = async (form) => {
    await api.updateSong(editingSong.song_id, form)
    await fetchSongs()
    setEditingSong(null)
    setTab('Library')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this song?')) return
    await api.deleteSong(id)
    await fetchSongs()
  }

  const handleUpdateDifficulty = async (id, difficulty) => {
    await api.updateSong(id, { difficulty })
    await fetchSongs()
  }

  const handleUpdateNotes = async (id, notes) => {
    await api.updateSong(id, { notes })
    await fetchSongs()
  }

  const handleUpdateDate = async (id, date_started) => {
    await api.updateSong(id, { date_started })
    await fetchSongs()
  }

  const handleNudgeSave = async (id, field, value) => {
    await api.updateSong(id, { [field]: value })
    await fetchSongs()
  }

  const handleJump = (songId) => {
    const el = document.getElementById(`song-${songId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-row')
    setTimeout(() => el.classList.remove('highlight-row'), 1800)
  }

  const activeTab = tab === 'edit' ? 'edit' : tab

  const goTo = (t) => { setTab(t); setEditingSong(null) }

  return (
    <div className="h-svh overflow-hidden bg-zinc-950 flex flex-col">
      <LyricsTape tracks={lyrics} />

      <StaleBanner />

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-zinc-800 h-full">
        <div className="px-5 py-6 border-b border-zinc-800">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">🎸 Tastemaker</h1>
          <p className="text-xs text-zinc-500 mt-0.5">guitar log</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => goTo(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === id || (activeTab === 'edit' && id === 'Library')
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span className="flex-1">{label}</span>
              {id === 'Chat' && streaming && (
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              )}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">{songs.length} entries</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile header + tabs */}
        <div className="md:hidden">
          <header className="px-4 pt-6 pb-2">
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">🎸 Tastemaker</h1>
            <p className="text-xs text-zinc-500 mt-0.5">guitar log</p>
          </header>
          <nav className="flex px-4 gap-1 border-b border-zinc-800 mt-2 overflow-x-auto scrollbar-none">
            {NAV.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => goTo(id)}
                className={`relative shrink-0 text-sm px-4 py-2.5 font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
                {id === 'Chat' && streaming && (
                  <span className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop page title */}
        <div className="hidden md:flex items-center justify-between px-8 py-5 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-100">
            {activeTab === 'edit' ? 'Edit Song' : activeTab}
          </h2>
          {activeTab === 'Library' && (
            <span className="text-sm text-zinc-500">
              {songs.filter(s => !s.notes?.trim()).length} songs missing notes
            </span>
          )}
          {activeTab === 'Playlist' && (
            <span className="text-sm text-zinc-500">powered by Claude · opens in Shortcuts</span>
          )}
          {activeTab === 'Chat' && (
            <span className="text-sm text-zinc-500">powered by Claude</span>
          )}
          {activeTab === 'Vibes' && (
            <span className="text-sm text-zinc-500">Genius lyrics · top 100 tracks</span>
          )}
        </div>

        {/* Content */}
        <main className={`flex-1 overflow-hidden ${activeTab === 'Playlist' ? '' : !['Chat', 'Vibes'].includes(activeTab) ? 'overflow-y-auto px-4 md:px-8 py-5' : 'px-4 md:px-8'}`}>
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-zinc-500 text-center pt-16">Loading…</p>
          ) : activeTab === 'Library' ? (
            <>
              <NudgePanel songs={songs} onSave={handleNudgeSave} onJump={handleJump} />
              <SongLibrary songs={songs} onEdit={handleEdit} onDelete={handleDelete} onUpdateDifficulty={handleUpdateDifficulty} onUpdateNotes={handleUpdateNotes} onUpdateDate={handleUpdateDate} />
            </>
          ) : activeTab === 'Practice' ? (
            <PracticeQueue songs={songs} onRefresh={fetchSongs} />
          ) : activeTab === 'Add Song' ? (
            <div className="max-w-lg">
              <SongForm onSave={handleAdd} songs={songs} />
            </div>
          ) : activeTab === 'Sync' ? (
            <SyncTab />
          ) : activeTab === 'Playlist' ? (
            <PlaylistCreator />
          ) : activeTab === 'Vibes' ? (
            <Vibes />
          ) : activeTab === 'Chat' ? (
            <AgentChat onGoToPlaylist={() => goTo('Playlist')} />
          ) : activeTab === 'edit' && editingSong ? (
            <div className="max-w-lg">
              <SongForm
                initial={editingSong}
                onSave={handleUpdate}
                onCancel={() => { setEditingSong(null); setTab('Library') }}
                songs={songs}
              />
            </div>
          ) : null}
        </main>
      </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ChatProvider>
      <AppInner />
    </ChatProvider>
  )
}
