import { createClient } from '@supabase/supabase-js'
import type { BookingRequest, JobOrder, ActivityType, JOStatus, Priority, RequestingTeam } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

export function rowToRequest(row: Record<string, unknown>): BookingRequest {
  return {
    id: row.id as string,
    activityType: row.activity_type as BookingRequest['activityType'],
    department: row.department as string,
    departmentLocal: row.department_local as string,
    requestorEmail: row.requestor_email as string,
    preparedBy: row.prepared_by as string,
    encodedAt: row.encoded_at as string,
    neededDate: row.needed_date as string,
    startTime: (row.start_time as string) || '',
    endTime: (row.end_time as string) || '',
    projectName: (row.project_name as string) || '',
    venue: row.venue as string,
    notes: (row.notes as string) || '',
    status: row.status as BookingRequest['status'],
    assignedMemberIds: (row.assigned_member_ids as string[]) || [],
    joId: (row.jo_id as string) || undefined,
    createdAt: row.created_at as string,
  }
}

export function rowToJobOrder(row: Record<string, unknown>): JobOrder {
  return {
    id: row.id as string,
    joNumber: row.jo_number as string,
    requestingTeam: row.requesting_team as RequestingTeam,
    requesterId: (row.requester_id as string) || '',
    projectName: row.project_name as string,
    campaign: (row.campaign as string) || '',
    activityType: row.activity_type as ActivityType,
    deliverables: (row.deliverables as string) || '',
    priority: row.priority as Priority,
    deadline: row.deadline as string,
    launchDate: (row.launch_date as string) || '',
    assignedMemberIds: (row.assigned_member_ids as string[]) || [],
    status: row.status as JOStatus,
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: (row.created_by as string) || '',
  }
}

export function jobOrderToRow(jo: JobOrder) {
  return {
    id: jo.id,
    jo_number: jo.joNumber,
    requesting_team: jo.requestingTeam,
    requester_id: jo.requesterId,
    project_name: jo.projectName,
    campaign: jo.campaign,
    activity_type: jo.activityType,
    deliverables: jo.deliverables,
    priority: jo.priority,
    deadline: jo.deadline,
    launch_date: jo.launchDate || null,
    assigned_member_ids: jo.assignedMemberIds,
    status: jo.status,
    notes: jo.notes || null,
    created_at: jo.createdAt,
    updated_at: jo.updatedAt,
    created_by: jo.createdBy,
  }
}

export function requestToRow(req: BookingRequest) {
  return {
    id: req.id,
    activity_type: req.activityType,
    department: req.department,
    department_local: req.departmentLocal,
    requestor_email: req.requestorEmail,
    prepared_by: req.preparedBy,
    encoded_at: req.encodedAt,
    needed_date: req.neededDate,
    start_time: req.startTime || null,
    end_time: req.endTime || null,
    project_name: req.projectName || null,
    venue: req.venue,
    notes: req.notes,
    status: req.status,
    assigned_member_ids: req.assignedMemberIds,
    jo_id: req.joId ?? null,
    created_at: req.createdAt,
  }
}
