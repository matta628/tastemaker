import { installMockFetch } from './mockFetch.js'

export function maybeInstallMock() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return
  installMockFetch()
}
