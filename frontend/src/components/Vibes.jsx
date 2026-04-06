// Debug tab: full-screen lyrics carousel to see the Genius integration in action.
import { TrackLoader } from './AgentChat'
import { useLyrics } from './useLyrics'

export function Vibes() {
  const tracks = useLyrics()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <p className="text-zinc-600 text-xs uppercase tracking-widest">your top tracks · last 30 months</p>
      <div className="w-full max-w-sm bg-zinc-800 rounded-2xl">
        <TrackLoader tracks={tracks} />
      </div>
      {tracks.length > 0 && (
        <p className="text-zinc-600 text-xs">{tracks.length} tracks loaded · {tracks.filter(t => t.snippet).length} with lyrics</p>
      )}
    </div>
  )
}
