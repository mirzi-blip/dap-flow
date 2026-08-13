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
  | 'Digital Design'
  | 'Graphics'
  | 'Printing'
  | 'ASC'
  | 'Video Editing'
  | 'Audio Recording'
  | 'Audio Editing'
  | 'Audio Services'
  | 'Content Writing'

/** Minor = partial crew, Major = full crew */
export type ShootType = 'Minor' | 'Major'

/** Project scope/scale for resource planning */
export type ProjectScale = 'Small Scale' | 'Medium Scale' | 'Large Scale' | 'Campaign Level'

/** Crew level derived from activity + shoot type */
export type CrewRequirement = 'Full Crew' | 'Partial Crew' | 'Minimal Crew'

/** Compute crew requirement from activity and shoot type */
export function getCrewRequirement(
  activityType: ActivityType | '',
  shootType?: ShootType | '',
): CrewRequirement {
  if (activityType === 'Photo Shoot' || activityType === 'Video Shoot') {
    return shootType === 'Major' ? 'Full Crew' : 'Partial Crew'
  }
  if (activityType === 'Audio Recording' || activityType === 'Audio Services') return 'Partial Crew'
  return 'Minimal Crew'
}

/** Estimated production hours per activity type (for capacity calc) */
export const ACTIVITY_HOURS: Record<ActivityType, number> = {
  'Photo Shoot':           8,
  'Video Shoot':           8,
  'Static Artwork Design': 4,
  'Digital Design':        4,
  'Graphics':              4,
  'Printing':              2,
  'ASC':                   3,
  'Video Editing':         6,
  'Audio Recording':       4,
  'Audio Editing':         3,
  'Audio Services':        4,
  'Content Writing':       6,
}

/** Capacity constants */
export const DAILY_CAPACITY_HRS  = 6.6
export const WEEKLY_CAPACITY_HRS = DAILY_CAPACITY_HRS * 5   // 33 hrs
export const TEAM_TOTAL_CAPACITY  = 150                       // hrs total team

/** Load thresholds */
export const LOAD_OPTIMAL  = 75   // %
export const LOAD_OVERLOAD = 75   // % — warn at / above this

/** Design specification details for Static / Digital artwork requests */
export interface DesignSpecs {
  paperSize:        string
  orientation:      string
  colorMode:        string
  dimensions:       string
  material:         string
  additionalNotes:  string
  platform?:        string   // Video Editing — output platform
  shootTypeDetail?: string   // Video Shoot — stream/BTS
  brand?:           string   // Brand this request is for (all services)
  attachmentUrls?:  string[]
  fileLinks?:       string[]
}

export type JOStatus =
  | 'To Do'
  | 'Ongoing'
  | 'For Review'
  | 'Needs Revision'
  | 'For Approval'
  | 'Completed'
  | 'Delayed'
  | 'Cancelled'

export type Priority = 'High' | 'Medium' | 'Low'

export type RequestingTeam = 'BMG' | 'MOD' | 'MTO' | 'CBE'

export type UserRole = 'Super Admin' | 'Admin' | 'DAP Team' | 'Brand Team' | 'Leadership' | 'End User'

// Team-member roles and teams shown in the Team Members add/edit form.
export const DAP_MEMBER_ROLES = [
  'Multimedia Designer',
  'Graphic Designer',
  'Video Editor',
  'Production Assistant',
  'Content Writer',
  'Videographer',
  'Photographer',
  'Drone Pilot',
  'Sound Engineer',
  'ASC Compliance',
  'Printing Operator',
  'Livestream Operator',
] as const

export const DAP_TEAM_LIST = [
  'Audio/Video',
  'Multimedia',
  'Graphics',
  'Content Writer',
  'ASC Compliance',
  'Printing',
] as const

// Stored as free strings so existing records (old roles/teams) and future
// additions both remain valid; the form constrains input to the lists above.
export type DAPSubRole = string
export type DAPTeam = string

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
  passwordChangedAt?: string
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
  // Completion tracking
  completedAt?: string
  completedBy?: string
  completionRemarks?: string
  completionFileUrl?: string
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

export type BookingRequestStatus = 'Pending Approval' | 'Pending Review' | 'Assigned' | 'Approved' | 'Rejected'

export type ApproverPosition = 'Head' | 'Director' | 'Manager' | 'Assistant Manager' | 'Supervisor'

export interface Approver {
  id: string
  name: string
  email: string
  position: string           // one of ApproverPosition or custom string
  isActive: boolean          // false = deactivated, hidden from booking form
  approverType?: 'booking' | 'dap'
  createdAt: string
}

export interface JOReview {
  id: string
  joId: string
  joNumber: string
  projectName: string
  outputFileUrl: string
  outputFileName?: string
  submittedBy: string
  submittedAt: string
  reqApproverName: string
  reqApproverEmail: string
  reqApproverStatus: 'pending' | 'approved' | 'disapproved'
  reqApproverComment?: string
  reqApproverActionAt?: string
  dapApproverName: string
  dapApproverEmail: string
  dapApproverStatus: 'pending' | 'approved' | 'disapproved'
  dapApproverComment?: string
  dapApproverActionAt?: string
  overallStatus: 'pending' | 'approved' | 'needs_revision'
  updatedAt: string
}

export interface BookingDepartment {
  id: string
  name: string
  isDefault: boolean         // default depts can't be deleted
  createdAt: string
}

export interface FormOption {
  id: string
  service: string      // '__services__', '__shoot__', 'Static Artwork Design', etc.
  fieldKey: string     // 'activityType', 'shootType', 'dsw_paperSize', etc.
  fieldLabel: string   // human-readable label for the field
  optionValue: string  // stored value in BookingRequest
  optionLabel: string  // displayed text in the dropdown
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface BookingRequest {
  id: string
  activityType: ActivityType
  shootType?: ShootType          // for Photo/Video Shoot only
  projectScale?: ProjectScale    // project scope indicator
  designSpecs?: DesignSpecs      // for Static Artwork / Digital Design
  department: string
  departmentLocal: string
  requestorName:  string
  requestorEmail: string
  preparedBy: string
  approverName: string
  approverEmail: string
  encodedAt: string
  neededDate: string
  endDate?: string
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
