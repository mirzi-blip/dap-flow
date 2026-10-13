import type { BookingRequest, JobOrder, JOReview } from '../types'
import type { JOComment } from '../lib/supabase'

/** Every file or link attached to a job order, wherever it came from. */
export interface JOFile {
  id: string
  label: string
  url: string
  /** Where the file entered the job order, shown as a badge. */
  source: 'Requestor' | 'Comment' | 'Output' | 'Completion'
  addedBy?: string
  addedAt?: string
  /** A pasted link rather than an uploaded file. */
  isLink?: boolean
}

function labelFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname
    const name = decodeURIComponent(path.split('/').pop() || '')
    // Uploads are stored as "<timestamp>_<original name>"; show the original.
    const stripped = name.replace(/^\d{10,}_/, '')
    return stripped || fallback
  } catch {
    return fallback
  }
}

/**
 * Gather every file attached to a job order from the places they actually
 * persist: what the requestor submitted, anything attached to a comment, the
 * output sent for review, and the completion file. Each of these is stored
 * server-side, so every assigned member and approver sees the same list.
 */
export function collectJOFiles(
  jo: JobOrder | null | undefined,
  req: BookingRequest | null | undefined,
  comments: JOComment[] = [],
  review: JOReview | null | undefined = null
): JOFile[] {
  if (!jo) return []
  const files: JOFile[] = []

  // 1. What the requestor submitted with the booking request
  const specs = req?.designSpecs
  ;(specs?.attachmentUrls ?? []).forEach((url, i) => {
    if (!url) return
    files.push({
      id: `req-att-${i}`,
      label: labelFromUrl(url, `Attachment ${i + 1}`),
      url,
      source: 'Requestor',
      addedBy: req?.preparedBy,
      addedAt: req?.createdAt,
    })
  })
  ;(specs?.fileLinks ?? []).forEach((url, i) => {
    if (!url) return
    files.push({
      id: `req-link-${i}`,
      label: labelFromUrl(url, url),
      url,
      source: 'Requestor',
      addedBy: req?.preparedBy,
      addedAt: req?.createdAt,
      isLink: true,
    })
  })

  // 2. Anything attached to a comment — the shared thread everyone can see
  for (const c of comments) {
    if (!c.attachmentUrl) continue
    files.push({
      id: `comment-${c.id}`,
      label: c.attachmentName || labelFromUrl(c.attachmentUrl, 'Attachment'),
      url: c.attachmentUrl,
      source: 'Comment',
      addedBy: c.authorName,
      addedAt: c.createdAt,
      isLink: !c.attachmentName,
    })
  }

  // 3. The output submitted for review
  if (review?.outputFileUrl) {
    files.push({
      id: `review-${review.id}`,
      label: review.outputFileName || labelFromUrl(review.outputFileUrl, 'Output file'),
      url: review.outputFileUrl,
      source: 'Output',
      addedBy: review.submittedBy,
      addedAt: review.submittedAt,
    })
  }

  // 4. The completion file
  if (jo.completionFileUrl) {
    files.push({
      id: `completion-${jo.id}`,
      label: labelFromUrl(jo.completionFileUrl, 'Completion file'),
      url: jo.completionFileUrl,
      source: 'Completion',
      addedBy: jo.completedBy,
      addedAt: jo.completedAt,
    })
  }

  // Newest first, undated last
  return files.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
}

export const FILE_SOURCE_STYLE: Record<JOFile['source'], string> = {
  Requestor:  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  Comment:    'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
  Output:     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  Completion: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}
