import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import type { JobOrder, JOStatus, Approver, ActivityType, JOWorkSegment } from '../types'
import {
  DAP_TEAM_LIST, ACTIVITY_HOURS, WEEKLY_CAPACITY_HRS,
  LOAD_OPTIMAL, LOAD_THRESHOLD, LOAD_PEAK,
} from '../types'

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

// All Team Member (resource) ids that belong to a user (a person may hold
// several roles = several resource rows, all sharing their email).
export function memberResourceIds(
  currentUser: { email?: string; resourceId?: string } | null | undefined,
  resources: { id: string; email?: string }[]
): string[] {
  if (!currentUser) return []
  const email = currentUser.email?.toLowerCase()
  const byEmail = email ? resources.filter(r => r.email && r.email.toLowerCase() === email).map(r => r.id) : []
  if (byEmail.length) return byEmail
  return currentUser.resourceId ? [currentUser.resourceId] : []
}

// The services a user handles, from their DAP Team Approver assignments (by email).
export function userDapServices(
  currentUser: { email?: string } | null | undefined,
  approvers: { approverType?: string; isActive?: boolean; email?: string; position: string }[]
): string[] {
  const email = currentUser?.email?.toLowerCase()
  if (!email) return []
  return approvers
    .filter(a => a.approverType === 'dap' && a.isActive !== false && a.email && a.email.toLowerCase() === email)
    .map(a => a.position)
}

// Role-based job-order scope:
//  • Super Admin (or an Admin with no service assignment) → everything
//  • Admin (supervisor) → only job orders for the service(s) they handle
//  • DAP Team → only job orders assigned to them
export function scopeJobOrders<T extends { activityType: string; assignedMemberIds: string[] }>(
  jos: T[],
  currentUser: { role?: string; email?: string; resourceId?: string } | null | undefined,
  resources: { id: string; email?: string }[],
  approvers: { approverType?: string; isActive?: boolean; email?: string; position: string }[]
): T[] {
  const role = currentUser?.role
  if (role === 'DAP Team') {
    const ids = memberResourceIds(currentUser, resources)
    return jos.filter(j => ids.some(id => j.assignedMemberIds.includes(id)))
  }
  if (role === 'Admin') {
    const services = userDapServices(currentUser, approvers)
    if (services.length > 0) return jos.filter(j => services.includes(j.activityType))
  }
  return jos
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

// ── Individual load capacity ────────────────────────────────────────────────
// Single source of truth for workload, capacity monitoring, resource
// assignment and reports, per the DAP Manager's methodology (see the capacity
// constants in types/index.ts).

export type LoadStatus = 'Underload' | 'Optimal' | 'Threshold' | 'Peak'

/** A job order consumes capacity until it is finished or cancelled. */
export function isLoadBearing(status: JOStatus): boolean {
  return status !== 'Completed' && status !== 'Cancelled'
}

/** Estimated work hours for one job order: the per-JO value when set,
 *  otherwise the per-service default. */
export function joEstimatedHours(jo: { activityType: string; estimatedHours?: number }): number {
  if (typeof jo.estimatedHours === 'number' && Number.isFinite(jo.estimatedHours) && jo.estimatedHours >= 0) {
    return jo.estimatedHours
  }
  return ACTIVITY_HOURS[jo.activityType as ActivityType] ?? 4
}

/** Total assigned work hours = estimated hours of a member's active work. */
export function memberAssignedHours<T extends { assignedMemberIds: string[]; status: JOStatus; activityType: string; estimatedHours?: number }>(
  jos: T[],
  memberId: string
): number {
  return jos
    .filter(j => j.assignedMemberIds.includes(memberId) && isLoadBearing(j.status))
    .reduce((sum, j) => sum + joEstimatedHours(j), 0)
}

/** Load Ratio = (Total Assigned Work Hours ÷ Load Capacity) × 100.
 *  Left uncapped so genuine overload stays visible; cap bar widths, not this. */
export function loadRatio(assignedHours: number, capacity = WEEKLY_CAPACITY_HRS): number {
  if (capacity <= 0) return 0
  return Math.round((assignedHours / capacity) * 100)
}

export function loadStatus(pct: number): LoadStatus {
  if (pct >= LOAD_PEAK) return 'Peak'
  if (pct >= LOAD_THRESHOLD) return 'Threshold'
  if (pct >= LOAD_OPTIMAL) return 'Optimal'
  return 'Underload'
}

/** Everything the UI needs about one member's load, in one call. */
export function memberLoad<T extends { assignedMemberIds: string[]; status: JOStatus; activityType: string; estimatedHours?: number }>(
  jos: T[],
  memberId: string
): { hours: number; pct: number; status: LoadStatus; capacity: number; overloaded: boolean } {
  const hours = memberAssignedHours(jos, memberId)
  const pct = loadRatio(hours)
  const status = loadStatus(pct)
  return { hours, pct, status, capacity: WEEKLY_CAPACITY_HRS, overloaded: status === 'Peak' }
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

// ── Actual working hours ────────────────────────────────────────────────────
// Regular schedule: 7:30 AM – 5:30 PM, Monday to Friday. Saturdays and Sundays
// never count. Overnight time is never counted: the clock stops at 5:30 PM and
// resumes at 7:30 AM the next working day.

export const WORK_START_H = 7,  WORK_START_M = 30   // 07:30
export const WORK_END_H   = 17, WORK_END_M   = 30   // 17:30
/** Length of one regular working day, in hours. */
export const WORK_DAY_HOURS =
  (WORK_END_H * 60 + WORK_END_M - (WORK_START_H * 60 + WORK_START_M)) / 60   // 10

/** Monday–Friday only. Weekend work is not counted. */
export function isWorkingDay(d: Date): boolean {
  const day = d.getDay()
  return day >= 1 && day <= 5
}

function at(day: Date, h: number, m: number): Date {
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

/** Regular working hours between two instants, counting only the overlap with
 *  07:30–17:30 on Mon–Fri. Walks day by day rather than subtracting the two
 *  timestamps, so overnight and weekend gaps are excluded. */
export function workingHoursBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO)
  const end = new Date(endISO)
  if (!(end.getTime() > start.getTime())) return 0

  let total = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const lastDay = new Date(end)
  lastDay.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= lastDay.getTime()) {
    if (isWorkingDay(cursor)) {
      const open = at(cursor, WORK_START_H, WORK_START_M)
      const close = at(cursor, WORK_END_H, WORK_END_M)
      const from = start > open ? start : open
      const to = end < close ? end : close
      if (to.getTime() > from.getTime()) total += (to.getTime() - from.getTime()) / 3_600_000
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return Math.round(total * 100) / 100
}

/** Overtime implied by finishing after 5:30 PM on a working day. Only ever a
 *  suggestion — overtime is confirmed by the member, never inferred silently
 *  from an overnight gap. */
export function overtimeSuggestion(endISO: string): number {
  const end = new Date(endISO)
  if (!isWorkingDay(end)) return 0
  const close = at(end, WORK_END_H, WORK_END_M)
  if (end.getTime() <= close.getTime()) return 0
  return Math.round(((end.getTime() - close.getTime()) / 3_600_000) * 100) / 100
}

/** The hours a member actually worked on a job order: the sum of their
 *  confirmed work segments (regular + overtime). Falls back to the estimate
 *  when no segment has been confirmed yet. */
export function actualHoursForMember(
  jo: { workSegments?: JOWorkSegment[]; activityType: string; estimatedHours?: number },
  memberId: string
): { hours: number; confirmed: boolean } {
  const mine = (jo.workSegments ?? []).filter(s => s.memberId === memberId)
  const done = mine.filter(s => typeof s.confirmedHours === 'number')
  if (done.length === 0) return { hours: 0, confirmed: false }
  const hours = done.reduce((sum, s) => sum + (s.confirmedHours ?? 0) + (s.overtimeHours ?? 0), 0)
  return { hours: Math.round(hours * 100) / 100, confirmed: true }
}
