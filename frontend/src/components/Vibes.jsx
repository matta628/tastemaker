// Debug tab: full-screen lyrics carousel to see the Genius integration in action.
import { TrackLoader } from './OldChat'
import { useLyrics } from './useLyrics'

export function Vibes() {
  const { tracks, loading } = useLyrics()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <p className="text-zinc-600 text-xs uppercase tracking-widest">your top tracks · last 30 days</p>
      {loading ? (
        <p className="text-zinc-600 text-sm animate-pulse">Loading tracks…</p>
      ) : tracks.length === 0 ? (
        <p className="text-zinc-600 text-sm">No scrobble data yet — sync Last.fm first.</p>
      ) : (
        <>
          <div className="w-full max-w-sm bg-zinc-800 rounded-2xl">
            <TrackLoader tracks={tracks} />
          </div>
          <p className="text-zinc-600 text-xs">
            {tracks.length} tracks loaded · {tracks.filter(t => t.snippet).length} with lyrics
          </p>
        </>
      )}
    </div>
  )
}
