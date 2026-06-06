import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnalyticsShell } from './AnalyticsShell'
import { useUIStore } from '../../store/uiStore'
import { analytics } from '../../api'

export function Explore() {
  const navigate = useNavigate()
  const lastEntity = useUIStore(s => s.lastViewedEntity)

  useEffect(() => {
    if (lastEntity) {
      navigate(`/explore/${lastEntity.type}/${encodeURIComponent(lastEntity.id)}`, { replace: true })
      return
    }
    analytics.entitiesArtists({ sort_by: 'total_plays', sort_dir: 'desc', limit: 1 })
      .then(data => {
        const top = data?.rows?.[0]
        if (top?.artist) navigate(`/explore/artist/${encodeURIComponent(top.artist)}`, { replace: true })
      })
      .catch(() => {})
  }, [])

  return (
    <AnalyticsShell>
      <div className="h-full flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading…</div>
      </div>
    </AnalyticsShell>
  )
}
