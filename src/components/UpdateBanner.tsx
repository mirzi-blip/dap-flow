import { useEffect, useRef, useState } from 'react'

/**
 * Detects when a newer build has been deployed and prompts the user to refresh.
 *
 * The app has no service worker, so a browser can keep serving a stale bundle
 * from cache. This polls the HTML entry (served with must-revalidate) for the
 * current asset hash and compares it to the hash this session booted with.
 * If they differ, a new version is live — we surface a small refresh banner
 * instead of force-reloading, so nobody loses a half-filled booking form.
 */
function currentBundleHash(): string | null {
  const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[]
  const app = scripts.find(s => /\/assets\/index-.*\.js/.test(s.src))
  return app?.src.match(/index-([A-Za-z0-9_-]+)\.js/)?.[1] ?? null
}

export function UpdateBanner() {
  const [show, setShow] = useState(false)
  const bootHash = useRef<string | null>(null)

  useEffect(() => {
    bootHash.current = currentBundleHash()
    // Only meaningful in production builds (dev uses /src/main.tsx, no hash)
    if (!bootHash.current) return

    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const html = await res.text()
        const latest = html.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1]
        if (!cancelled && latest && latest !== bootHash.current) setShow(true)
      } catch {
        /* offline or blocked — ignore, try again next tick */
      }
    }

    const first = setTimeout(check, 15_000)          // shortly after load
    const timer = setInterval(check, 5 * 60_000)     // then every 5 minutes
    return () => { cancelled = true; clearTimeout(first); clearInterval(timer) }
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(92vw,420px)]">
      <div className="flex items-center gap-3 rounded-2xl bg-brand-900 text-white shadow-2xl border border-white/10 px-4 py-3">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">A new version is available</p>
          <p className="text-[11px] text-brand-200">Refresh to get the latest updates.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 text-xs font-bold bg-white text-brand-900 hover:bg-brand-50 px-3 py-2 rounded-xl transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
