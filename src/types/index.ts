export type UserStatus = 'active' | 'terminated' | 'limited'

export interface ManagedUser {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  team?: RequestingTeam
  avatar: string
  status: UserStatus
  resourceId?: string
  createdAt: string
}

export type ActivityType =
  | 'Photo Shoot'
  | 'Video Shoot'
  | 'Static Artwork Design'
  | 'Video Editing'
  | 'Audio Recording'
  | 'Audio Editing'

export type JOStatus =
  | 'Pending'
  | 'Approved'
  | 'Scheduled'
  | 'In Progress'
  | 'For Review'
  | 'Completed'
  | 'Delayed'
  | 'Cancelled'

export type Priority = 'High' | 'Medium' | 'Low'

export type RequestingTeam = 'BMG' | 'MOD' | 'MTO' | 'CBE'

export type UserRole = 'Admin' | 'DAP Team' | 'Brand Team' | 'Leadership'

export type DAPSubRole =
  | 'Photographer'
  | 'Videographer'
  | 'Video Editor'
  | 'Audio Editor'
  | 'Graphic Designer'

export type DAPTeam = 'Photo' | 'Video' | 'Audio' | 'Design'

export interface Resource {
  id: string
  name: string
  role: DAPSubRole
  team: DAPTeam
  email: string
  initials: string
  color: string
  maxWeeklyHours: number
}

export interface AppUser {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  resourceId?: string
  team?: RequestingTeam
  avatar: string
}

export interface JobOrder {
  id: string
  joNumber: string
  requestingTeam: RequestingTeam
  requesterId: string
  projectName: string
  campaign: string
  activityType: ActivityType
  deliverables: string
  priority: Priority
  deadline: string
  launchDate: string
  assignedMemberIds: string[]
  status: JOStatus
  notes: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CalendarEvent {
  id: string
  joId: string
  title: string
  activityType: ActivityType
  startDate: string
  endDate: string
  assignedMemberIds: string[]
  location: string
  notes: string
  createdAt: string
}

export interface Notification {
  id: string
  type:
    | 'booking_confirmed'
    | 'schedule_changed'
    | 'deadline_reminder'
    | 'conflict_alert'
    | 'approval_notification'
    | 'status_changed'
  title: string
  message: string
  read: boolean
  createdAt: string
  targetUserId: string
  joId?: string
}

export interface StatusLog {
  id: string
  joId: string
  joNumber: string
  fromStatus: JOStatus
  toStatus: JOStatus
  changedBy: string
  changedAt: string
  notes: string
}

export interface SyncQueueItem {
  id?: number
  action: 'create' | 'update' | 'delete'
  entityType: 'jobOrder' | 'calendarEvent' | 'notification'
  entityId: string
  payload: string
  timestamp: string
  synced: boolean
}

export type BookingRequestStatus = 'Pending Review' | 'Assigned' | 'Approved' | 'Rejected'

export interface BookingRequest {
  id: string
  activityType: ActivityType
  department: string
  departmentLocal: string
  requestorEmail: string
  preparedBy: string
  encodedAt: string
  neededDate: string
  startTime: string
  endTime: string
  projectName: string
  venue: string
  notes: string
  status: BookingRequestStatus
  assignedMemberIds: string[]
  joId?: string
  createdAt: string
}
