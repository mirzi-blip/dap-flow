import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import type { AppButton } from '../types'

/**
 * Opens an external tool inside the app rather than a separate tab, so people
 * stay in DAP Flow. Some sites refuse to be embedded; if nothing loads the
 * panel says so and offers to open it in a tab instead.
 */
export function AppButtonFrame({ button, onClose }: { button: AppButton; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [reloadKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-[88vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-col overflow-hidden">

        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
          {button.icon && <span className="text-xl leading-none">{button.icon}</span>}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{button.label}</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{button.url}</p>
          </div>
          <button type="button" onClick={() => { setLoaded(false); setSlow(false); setReloadKey(k => k + 1) }}
            title="Reload" aria-label="Reload"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={15} />
          </button>
          <a href={button.url} target="_blank" rel="noopener noreferrer"
            title="Open in a new tab"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <ExternalLink size={15} />
          </a>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="relative flex-1 bg-slate-50 dark:bg-slate-900">
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
              <RefreshCw size={22} className="animate-spin" />
              <p className="text-sm">Loading {button.label}…</p>
              {slow && (
                <div className="max-w-sm text-center space-y-2 px-6">
                  <p className="flex items-center justify-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={13} /> This is taking a while.
                  </p>
                  <p className="text-[12px]">
                    If nothing appears, the site may not allow being embedded.
                    <a href={button.url} target="_blank" rel="noopener noreferrer" className="ml-1 font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                      Open it in a new tab
                    </a>.
                  </p>
                </div>
              )}
            </div>
          )}
          <iframe
            key={reloadKey}
            src={button.url}
            title={button.label}
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
            // Let the embedded tool run normally while keeping it off this origin.
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
