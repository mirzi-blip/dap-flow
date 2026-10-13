import { Paperclip, Link2 } from 'lucide-react'
import type { BookingRequest } from '../types'
import { formatDate } from '../utils/helpers'
import { designSpecRows } from '../utils/designSpecs'

// Everything the requestor submitted, shown read-only. Used by the request
// review modal, the Job Orders detail view and the Pipeline detail view so all
// three show the same information for a given request.

export function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  )
}

export function RequestorDetails({ req }: { req: BookingRequest }) {
  const specs = designSpecRows(req.activityType, req.designSpecs)
  const specNotes = req.designSpecs?.additionalNotes?.trim()
  const atts = req.designSpecs?.attachmentUrls ?? []
  const links = req.designSpecs?.fileLinks ?? []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <InfoBox label="Service Type" value={req.activityType} />
        <InfoBox label="Status" value={req.status} />
        <InfoBox label="Requestor" value={req.requestorName || '—'} />
        <InfoBox label="Requestor Email" value={req.requestorEmail || '—'} />
        <InfoBox label="Prepared By" value={req.preparedBy || '—'} />
        <InfoBox label="Department" value={`${req.department || '—'}${req.departmentLocal ? ` · ${req.departmentLocal}` : ''}`} />
        {req.projectName && <div className="col-span-2"><InfoBox label="Project Name" value={req.projectName} /></div>}
        {req.designSpecs?.brand && <InfoBox label="Brand" value={req.designSpecs.brand} />}
        {req.shootType && <InfoBox label="Shoot Type" value={req.shootType} />}
        {req.projectScale && <InfoBox label="Project Scale" value={req.projectScale} />}
        <InfoBox label="Date Encoded" value={formatDate(req.encodedAt)} />
        <InfoBox label="Date Needed" value={`${formatDate(req.neededDate)}${req.endDate && req.endDate !== req.neededDate ? ` – ${formatDate(req.endDate)}` : ''}`} />
        {(req.startTime || req.endTime) && <InfoBox label="Time" value={`${req.startTime || '?'} – ${req.endTime || '?'}`} />}
        {req.approverName && <div className="col-span-2"><InfoBox label="Approver" value={`${req.approverName}${req.approverEmail ? ` (${req.approverEmail})` : ''}`} /></div>}
        {req.venue && <div className="col-span-2"><InfoBox label="Venue / Location" value={req.venue} /></div>}
      </div>

      {specs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Design Specifications</p>
          <div className="grid grid-cols-2 gap-2.5">
            {specs.map(r => <InfoBox key={r.label} label={r.label} value={r.value} />)}
          </div>
        </div>
      )}

      {specNotes && (
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-0.5">Specifications / Brief</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{specNotes}</p>
        </div>
      )}

      {req.notes?.trim() && (
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-0.5">Additional Notes</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{req.notes}</p>
        </div>
      )}

      {(atts.length > 0 || links.length > 0) && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Attachments &amp; Links</p>
          <div className="space-y-1.5">
            {atts.map((url, i) => (
              <a key={`a${i}`} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-lg px-3 py-2">
                <Paperclip size={12} className="shrink-0" /><span className="truncate">Attachment {i + 1}</span>
              </a>
            ))}
            {links.map((url, i) => (
              <a key={`l${i}`} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline bg-white dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
                <Link2 size={12} className="shrink-0" /><span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
