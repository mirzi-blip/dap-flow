import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import type { JobOrder, JOStatus, Approver } from '../types'
import { DAP_TEAM_LIST } from '../types'

// Teams to show in team views: the configured teams that have members, followed
// by any other (legacy) team still assigned to a member. Keeps views in sync
// with whatever teams actually exist, without hardcoding.
// Resolve a logged-in user to their Team Member (resource) id — matched by
// email (the shared key with the Team Members tab), falling back to an explicit
// resourceId link. Used to scope DAP-member views to their assigned work.
export function memberResourceId(
  currentUser: { email?: string; resourceId?: string } | null | undefined,
  resources: { id: string; email?: string }[]
): string | null {
  if (!currentUser) return null
  const email = currentUser.email?.toLowerCase()
  const byEmail = email ? resources.find(r => r.email && r.email.toLowerCase() === email) : undefined
  return byEmail?.id ?? currentUser.resourceId ?? null
}

export function orderedTeams(resources: { team: string }[]): string[] {
  const present = new Set(resources.map((r) => r.team).filter(Boolean))
  const configured = DAP_TEAM_LIST.filter((t) => present.has(t))
  const extras = [...present].filter((t) => !(DAP_TEAM_LIST as readonly string[]).includes(t)).sort()
  return [...configured, ...extras]
}

export function generateId(): string {
  return crypto.randomUUID()
}

// ── Per-service DAP routing ──────────────────────────────────────────────────
// When an approver approves a request, the DAP Team Approver(s) responsible for
// that service are notified. A DAP approver's service is stored in their
// `position` field (repurposed as a Service picker in the DAP Approvers tab).
export function getServiceApprovers(approvers: Approver[], activityType: string): Approver[] {
  return approvers.filter(
    (a) => a.approverType === 'dap' && a.isActive !== false && a.position === activityType && !!a.email
  )
}

export function generateJONumber(existingCount: number): string {
  const year = new Date().getFullYear()
  const num = String(existingCount + 1).padStart(3, '0')
  return `JO-${year}-${num}`
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return iso
  }
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

export function formatDateShort(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d')
  } catch {
    return iso
  }
}

export function isOverdue(deadline: string): boolean {
  try {
    return isBefore(parseISO(deadline), startOfDay(new Date()))
  } catch {
    return false
  }
}

export function isDueSoon(deadline: string, daysThreshold = 3): boolean {
  try {
    const d = parseISO(deadline)
    const now = new Date()
    const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000)
    return isAfter(d, now) && isBefore(d, endOfDay(threshold))
  } catch {
    return false
  }
}

// Work pipeline: To Do -> Ongoing -> For Review -> For Approval -> Completed.
// Needs Revision sends the job order back to For Review.
const WORK_FLOW: JOStatus[] = ['To Do', 'Ongoing', 'For Review', 'For Approval', 'Completed']

export function getNextStatus(current: JOStatus): JOStatus | null {
  if (current === 'Needs Revision') return 'For Review'
  const idx = WORK_FLOW.indexOf(current)
  if (idx === -1 || idx === WORK_FLOW.length - 1) return null
  return WORK_FLOW[idx + 1]
}

export function getPrevStatus(current: JOStatus): JOStatus | null {
  if (current === 'Needs Revision') return 'For Review'
  const idx = WORK_FLOW.indexOf(current)
  if (idx <= 0) return null
  return WORK_FLOW[idx - 1]
}

// Maps legacy statuses (and any stray value) onto the current work-stage set,
// so existing job orders keep working after the pipeline redesign.
export function normalizeJOStatus(raw: string | null | undefined): JOStatus {
  switch (raw) {
    case 'Pending':
    case 'Approved':
    case 'Scheduled':
    case 'To Do':        return 'To Do'
    case 'In Progress':
    case 'Ongoing':      return 'Ongoing'
    case 'For Review':   return 'For Review'
    case 'Needs Revision': return 'Needs Revision'
    case 'For Approval': return 'For Approval'
    case 'Completed':    return 'Completed'
    case 'Delayed':      return 'Delayed'
    case 'Cancelled':    return 'Cancelled'
    default:             return 'To Do'
  }
}

export function computeCompletionRate(jos: JobOrder[]): number {
  if (!jos.length) return 0
  const done = jos.filter((j) => j.status === 'Completed').length
  return Math.round((done / jos.length) * 100)
}

export function computeOnTimeRate(jos: JobOrder[]): number {
  const completed = jos.filter((j) => j.status === 'Completed')
  if (!completed.length) return 0
  const onTime = completed.filter((j) => !isOverdue(j.deadline)).length
  return Math.round((onTime / completed.length) * 100)
}

export function clsx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
