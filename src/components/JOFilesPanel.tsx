import { useState } from 'react'
import { Paperclip, Link2, ExternalLink } from 'lucide-react'
import type { JOFile } from '../utils/joFiles'
import { FILE_SOURCE_STYLE } from '../utils/joFiles'
import { formatDateTime } from '../utils/helpers'

interface Props {
  files: JOFile[]
  loading?: boolean
  /** Attach a link. Saved as a comment so it persists and everyone sees it. */
  onAttach?: (input: { url: string; label: string }) => Promise<void>
  /** Hide the add controls (e.g. for a read-only viewer). */
  readOnly?: boolean
}

/**
 * Every file attached to a job order, from whichever stage it arrived at.
 * Shared by the Job Orders and Pipeline detail views so assigned members and
 * approvers see the same list in both places.
 */
export function JOFilesPanel({ files, loading = false, onAttach, readOnly = false }: Props) {
  const [link, setLink] = useState({ label: '', url: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function attachLink() {
    const url = link.url.trim()
    const label = link.label.trim()
    if (!label) { setError('Give the link a label so others know what it is.'); return }
    if (!url) { setError('Enter a link.'); return }
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`
    try {
      const u = new URL(withScheme)
      if (!u.hostname.includes('.')) throw new Error('bad host')
    } catch {
      setError('That does not look like a valid web address.')
      return
    }
    setBusy(true); setError('')
    try {
      await onAttach?.({ url: withScheme, label })
      setLink({ label: '', url: '' })
    } catch {
      setError('Could not attach that link. Please try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {!readOnly && onAttach && (
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Attach a link</p>
          <div className="grid grid-cols-5 gap-2">
            <input value={link.label} onChange={e => { setLink(l => ({ ...l, label: e.target.value })); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') attachLink() }}
              placeholder="Label *" className="form-input col-span-2 text-xs" />
            <input value={link.url} onChange={e => { setLink(l => ({ ...l, url: e.target.value })); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') attachLink() }}
              placeholder="Paste a link…" className="form-input col-span-2 text-xs" />
            <button type="button" onClick={attachLink} disabled={busy}
              className="flex items-center justify-center gap-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors">
              <Link2 size={13} /> Add
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Paste a link to the file (Google Drive, Dropbox, SharePoint…). Shared with everyone on this job order.
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">Loading files…</div>
      ) : files.length === 0 ? (
        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
          <Paperclip size={28} className="mx-auto mb-2 opacity-40" />No files or links attached to this job order yet.
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3">
              {f.isLink
                ? <Link2 size={14} className="text-brand-500 shrink-0" />
                : <Paperclip size={14} className="text-emerald-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline truncate block">
                  {f.label}
                </a>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {f.addedBy ? `${f.addedBy}` : 'Unknown'}{f.addedAt ? ` · ${formatDateTime(f.addedAt)}` : ''}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${FILE_SOURCE_STYLE[f.source]}`}>
                {f.source}
              </span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 shrink-0" aria-label={`Open ${f.label}`}>
                <ExternalLink size={13} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
