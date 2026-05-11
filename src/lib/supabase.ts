import { createClient } from '@supabase/supabase-js'
import type { BookingRequest, JobOrder, ActivityType, JOStatus, Priority, RequestingTeam, ManagedUser, Approver, BookingDepartment } from '../types'

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
    approverName: (row.approver_name as string) || '',
    approverEmail: (row.approver_email as string) || '',
    encodedAt: row.encoded_at as string,
    neededDate: row.needed_date as string,
    endDate: (row.end_date as string) || undefined,
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
    completedAt: (row.completed_at as string) || undefined,
    completedBy: (row.completed_by as string) || undefined,
    completionRemarks: (row.completion_remarks as string) || undefined,
    completionFileUrl: (row.completion_file_url as string) || undefined,
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
    completed_at: jo.completedAt || null,
    completed_by: jo.completedBy || null,
    completion_remarks: jo.completionRemarks || null,
    completion_file_url: jo.completionFileUrl || null,
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
    approver_name: req.approverName || null,
    approver_email: req.approverEmail || null,
    encoded_at: req.encodedAt,
    needed_date: req.neededDate,
    end_date: req.endDate || null,
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

export function rowToManagedUser(row: Record<string, unknown>): ManagedUser {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    password: row.password as string,
    role: row.role as ManagedUser['role'],
    team: (row.team as ManagedUser['team']) || undefined,
    avatar: (row.avatar as string) || '😊',
    resourceId: (row.resource_id as string) || undefined,
    status: (row.status as ManagedUser['status']) || 'active',
    createdAt: (row.created_at as string) || new Date().toISOString(),
  }
}

export function managedUserToRow(u: ManagedUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role,
    team: u.team || null,
    avatar: u.avatar || '😊',
    resource_id: u.resourceId || null,
    status: u.status,
    created_at: u.createdAt,
  }
}

export function rowToApprover(row: Record<string, unknown>): Approver {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    position: (row.position as string) || '',
    createdAt: (row.created_at as string) || new Date().toISOString(),
  }
}

export function approverToRow(a: Approver) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    position: a.position || null,
    created_at: a.createdAt,
  }
}

export function rowToDepartment(row: Record<string, unknown>): BookingDepartment {
  return {
    id: row.id as string,
    name: row.name as string,
    isDefault: (row.is_default as boolean) ?? false,
    createdAt: (row.created_at as string) || new Date().toISOString(),
  }
}

export function departmentToRow(d: BookingDepartment) {
  return {
    id: d.id,
    name: d.name,
    is_default: d.isDefault,
    created_at: d.createdAt,
  }
}

// Upload a profile photo to Supabase Storage and return its public URL
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (error) {
    console.error('Avatar upload error:', error.message)
    return null
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the browser always fetches the latest photo
  return `${data.publicUrl}?t=${Date.now()}`
}
