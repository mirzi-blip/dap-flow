import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import type { JobOrder, JOStatus } from '../types'

export function generateId(): string {
  return crypto.randomUUID()
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

export function getNextStatus(current: JOStatus): JOStatus | null {
  const flow: JOStatus[] = [
    'Pending',
    'Approved',
    'Scheduled',
    'In Progress',
    'For Review',
    'Completed',
  ]
  const idx = flow.indexOf(current)
  if (idx === -1 || idx === flow.length - 1) return null
  return flow[idx + 1]
}

export function getPrevStatus(current: JOStatus): JOStatus | null {
  const flow: JOStatus[] = [
    'Pending',
    'Approved',
    'Scheduled',
    'In Progress',
    'For Review',
    'Completed',
  ]
  const idx = flow.indexOf(current)
  if (idx <= 0) return null
  return flow[idx - 1]
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
