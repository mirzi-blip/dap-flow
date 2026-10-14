import type { BookingRequest, JobOrder } from '../types'
import type { Person } from './helpers'
import { assignedPeople, joEstimatedHours, revisionsUsed } from './helpers'
import { formatDate } from './helpers'

/** One CSV cell, escaped so commas, quotes and newlines survive. */
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function isoDate(v?: string): string {
  if (!v) return ''
  try { return formatDate(v) } catch { return v }
}

/**
 * The job-order list as a spreadsheet. Columns mirror what the table shows,
 * plus the date the requestor encoded the original request and the figures
 * that are otherwise only visible inside a job order.
 */
export function jobOrdersToCSV(
  jos: JobOrder[],
  bookingRequests: BookingRequest[],
  people: Person[]
): string {
  const headers = [
    'JO Number', 'Reference', 'Date Encoded', 'Date Created',
    'Project Name', 'Campaign', 'Service', 'Requesting Team', 'Brand',
    'Priority', 'Status', 'Launch Date', 'Deadline',
    'Assigned Members', 'Roles',
    'Estimated Hours', 'Actual Hours', 'Overtime Hours', 'Revisions',
    'Requestor', 'Requestor Email', 'Approver',
    'Completed At', 'Completed By',
  ]

  const rows = jos.map(jo => {
    const req = bookingRequests.find(r => r.joId === jo.id)
    const ap = assignedPeople(jo, people)
    const segs = (jo.workSegments ?? []).filter(s => typeof s.confirmedHours === 'number')
    const actual = segs.reduce((n, s) => n + (s.confirmedHours ?? 0), 0)
    const ot = segs.reduce((n, s) => n + (s.overtimeHours ?? 0), 0)

    return [
      jo.joNumber,
      req ? `REF#${req.id.slice(0, 8).toUpperCase()}` : '',
      // What the requestor filled in on the booking form
      isoDate(req?.encodedAt),
      isoDate(jo.createdAt),
      jo.projectName,
      jo.campaign,
      jo.activityType,
      jo.requestingTeam,
      req?.designSpecs?.brand ?? '',
      jo.priority,
      jo.status,
      isoDate(jo.launchDate),
      isoDate(jo.deadline),
      ap.map(x => x.person.name).join('; '),
      ap.map(x => `${x.person.name}: ${x.roles.map(r => r.role).join(' / ')}`).join('; '),
      joEstimatedHours(jo),
      actual > 0 ? actual.toFixed(1) : '',
      ot > 0 ? ot.toFixed(1) : '',
      revisionsUsed(jo),
      req?.requestorName || req?.preparedBy || '',
      req?.requestorEmail ?? '',
      req?.approverName ?? '',
      isoDate(jo.completedAt),
      jo.completedBy ?? '',
    ].map(cell).join(',')
  })

  return [headers.map(cell).join(','), ...rows].join('\r\n')
}

/** Save the CSV. The BOM makes Excel read UTF-8 correctly on open. */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFilename(prefix = 'DAP-Job-Orders'): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`
}
