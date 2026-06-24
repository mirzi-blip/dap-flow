import { createClient } from '@supabase/supabase-js'
import type { BookingRequest, JobOrder, ActivityType, JOStatus, Priority, RequestingTeam, ManagedUser, Approver, BookingDepartment, ShootType, ProjectScale, DesignSpecs, JOReview } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

export function rowToRequest(row: Record<string, unknown>): BookingRequest {
  // design_specs may be stored as a JSON string or object
  let designSpecs: DesignSpecs | undefined
  if (row.design_specs) {
    try {
      designSpecs = typeof row.design_specs === 'string'
        ? JSON.parse(row.design_specs)
        : (row.design_specs as DesignSpecs)
    } catch { /* ignore malformed */ }
  }
  return {
    id: row.id as string,
    activityType: row.activity_type as BookingRequest['activityType'],
    shootType: (row.shoot_type as ShootType) || undefined,
    projectScale: (row.project_scale as ProjectScale) || undefined,
    designSpecs,
    department: row.department as string,
    departmentLocal: row.department_local as string,
    requestorName:  (row.requestor_name as string) || '',
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
    shoot_type: req.shootType || null,
    project_scale: req.projectScale || null,
    design_specs: req.designSpecs ? JSON.stringify(req.designSpecs) : null,
    department: req.department,
    department_local: req.departmentLocal,
    requestor_name:  req.requestorName || null,
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
    email: (row.email as string) || '',
    position: (row.position as string) || '',
    isActive: row.is_active === false ? false : true,
    approverType: ((row.approver_type as string) === 'dap' ? 'dap' : 'booking'),
    createdAt: (row.created_at as string) || new Date().toISOString(),
  }
}

export function approverToRow(a: Approver) {
  return {
    id: a.id,
    name: a.name,
    email: a.email?.trim() || null,
    position: a.position || null,
    is_active: a.isActive ?? true,
    approver_type: a.approverType ?? 'booking',
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

// ── JO Comment type + helpers ──────────────────────────────────────────────
export interface JOComment {
  id: string
  joId: string
  authorName: string
  authorEmail: string
  body: string
  attachmentUrl?: string
  attachmentName?: string
  fromStatus?: string
  toStatus?: string
  createdAt: string
}

export async function fetchJOComments(joId: string): Promise<JOComment[]> {
  const { data, error } = await supabase
    .from('jo_comments')
    .select('*')
    .eq('jo_id', joId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(row => ({
    id: row.id as string,
    joId: row.jo_id as string,
    authorName: row.author_name as string,
    authorEmail: (row.author_email as string) || '',
    body: row.body as string,
    attachmentUrl: (row.attachment_url as string) || undefined,
    attachmentName: (row.attachment_name as string) || undefined,
    fromStatus: (row.from_status as string) || undefined,
    toStatus: (row.to_status as string) || undefined,
    createdAt: row.created_at as string,
  }))
}

export async function saveJOComment(
  comment: Omit<JOComment, 'id' | 'createdAt'>
): Promise<JOComment | null> {
  const { data, error } = await supabase
    .from('jo_comments')
    .insert({
      jo_id: comment.joId,
      author_name: comment.authorName,
      author_email: comment.authorEmail || null,
      body: comment.body,
      attachment_url: comment.attachmentUrl || null,
      attachment_name: comment.attachmentName || null,
      from_status: comment.fromStatus || null,
      to_status: comment.toStatus || null,
    })
    .select()
    .single()
  if (error || !data) { console.error('Save comment error:', error?.message); return null }
  return {
    id: data.id as string,
    joId: data.jo_id as string,
    authorName: data.author_name as string,
    authorEmail: (data.author_email as string) || '',
    body: data.body as string,
    attachmentUrl: (data.attachment_url as string) || undefined,
    attachmentName: (data.attachment_name as string) || undefined,
    fromStatus: (data.from_status as string) || undefined,
    toStatus: (data.to_status as string) || undefined,
    createdAt: data.created_at as string,
  }
}

export async function uploadOutputFile(
  joId: string,
  file: File
): Promise<{ url: string; name: string } | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `outputs/${joId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage
    .from('booking-files')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) { console.error('Output upload error:', error.message); return null }
  const { data } = supabase.storage.from('booking-files').getPublicUrl(path)
  return { url: data.publicUrl, name: file.name }
}

// Upload a booking attachment to Supabase Storage and return its public URL
export async function uploadBookingFile(bookingId: string, file: File, index: number): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${bookingId}/${index}_${safeName}`
  const { error } = await supabase.storage
    .from('booking-files')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) {
    console.error('File upload error:', error.message)
    return null
  }
  const { data } = supabase.storage.from('booking-files').getPublicUrl(path)
  return data.publicUrl
}

// ── JO Review CRUD ────────────────────────────────────────────────────────────

function rowToJOReview(row: Record<string, unknown>): JOReview {
  return {
    id: row.id as string,
    joId: row.jo_id as string,
    joNumber: row.jo_number as string,
    projectName: row.project_name as string,
    outputFileUrl: row.output_file_url as string,
    outputFileName: (row.output_file_name as string) || undefined,
    submittedBy: row.submitted_by as string,
    submittedAt: row.submitted_at as string,
    reqApproverName: row.req_approver_name as string,
    reqApproverEmail: row.req_approver_email as string,
    reqApproverStatus: (row.req_approver_status as JOReview['reqApproverStatus']) || 'pending',
    reqApproverComment: (row.req_approver_comment as string) || undefined,
    reqApproverActionAt: (row.req_approver_action_at as string) || undefined,
    dapApproverName: row.dap_approver_name as string,
    dapApproverEmail: row.dap_approver_email as string,
    dapApproverStatus: (row.dap_approver_status as JOReview['dapApproverStatus']) || 'pending',
    dapApproverComment: (row.dap_approver_comment as string) || undefined,
    dapApproverActionAt: (row.dap_approver_action_at as string) || undefined,
    overallStatus: (row.overall_status as JOReview['overallStatus']) || 'pending',
    updatedAt: row.updated_at as string,
  }
}

export async function fetchJOReview(joId: string): Promise<JOReview | null> {
  const { data, error } = await supabase
    .from('jo_reviews')
    .select('*')
    .eq('jo_id', joId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return rowToJOReview(data)
}

export async function saveJOReviewRecord(review: Omit<JOReview, 'id'>): Promise<JOReview | null> {
  const { data, error } = await supabase
    .from('jo_reviews')
    .insert({
      jo_id: review.joId,
      jo_number: review.joNumber,
      project_name: review.projectName,
      output_file_url: review.outputFileUrl,
      output_file_name: review.outputFileName || null,
      submitted_by: review.submittedBy,
      submitted_at: review.submittedAt,
      req_approver_name: review.reqApproverName,
      req_approver_email: review.reqApproverEmail,
      req_approver_status: 'pending',
      dap_approver_name: review.dapApproverName,
      dap_approver_email: review.dapApproverEmail,
      dap_approver_status: 'pending',
      overall_status: 'pending',
      updated_at: review.submittedAt,
    })
    .select()
    .single()
  if (error || !data) { console.error('Save review error:', error?.message); return null }
  return rowToJOReview(data)
}

export async function updateJOReviewRecord(
  id: string,
  updates: Partial<{
    reqApproverStatus: string
    reqApproverComment: string
    reqApproverActionAt: string
    dapApproverStatus: string
    dapApproverComment: string
    dapApproverActionAt: string
    overallStatus: string
  }>
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.reqApproverStatus !== undefined) row.req_approver_status = updates.reqApproverStatus
  if (updates.reqApproverComment !== undefined) row.req_approver_comment = updates.reqApproverComment
  if (updates.reqApproverActionAt !== undefined) row.req_approver_action_at = updates.reqApproverActionAt
  if (updates.dapApproverStatus !== undefined) row.dap_approver_status = updates.dapApproverStatus
  if (updates.dapApproverComment !== undefined) row.dap_approver_comment = updates.dapApproverComment
  if (updates.dapApproverActionAt !== undefined) row.dap_approver_action_at = updates.dapApproverActionAt
  if (updates.overallStatus !== undefined) row.overall_status = updates.overallStatus
  const { error } = await supabase.from('jo_reviews').update(row).eq('id', id)
  if (error) console.error('Update review error:', error.message)
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
