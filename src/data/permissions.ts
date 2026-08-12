import type { UserRole } from '../types'

// ── Module + action definitions ───────────────────────────────────────────────

export interface PermissionAction {
  key: string
  label: string
  description?: string
}

export interface PermissionModule {
  key: string
  label: string
  icon: string          // emoji used in the UI
  actions: PermissionAction[]
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    actions: [
      { key: 'view', label: 'View Dashboard & KPIs', description: 'Access the main dashboard overview' },
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: '📅',
    actions: [
      { key: 'view',   label: 'View Calendar',   description: 'See the production schedule' },
      { key: 'create', label: 'Create Events',   description: 'Add new calendar events' },
      { key: 'edit',   label: 'Edit Events',     description: 'Modify existing events' },
      { key: 'delete', label: 'Delete Events',   description: 'Remove calendar events' },
    ],
  },
  {
    key: 'job_orders',
    label: 'Job Orders',
    icon: '📋',
    actions: [
      { key: 'view',            label: 'View Job Orders',             description: 'Browse all job orders' },
      { key: 'create',          label: 'Create Job Orders',           description: 'Submit new job orders' },
      { key: 'edit',            label: 'Edit & Reassign',             description: 'Update details and assigned members' },
      { key: 'approve',         label: 'Approve Job Orders',          description: 'Grant approval on pending JOs' },
      { key: 'change_status',   label: 'Change Status / Progress',    description: 'Move JOs through the workflow' },
      { key: 'view_requests',   label: 'View Booking Requests',       description: 'See incoming booking requests' },
      { key: 'manage_requests', label: 'Approve / Reject / Convert',  description: 'Act on booking requests' },
    ],
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    icon: '🔄',
    actions: [
      { key: 'view',       label: 'View Pipeline / Kanban',     description: 'See the production board' },
      { key: 'move_cards', label: 'Move Cards / Change Status', description: 'Advance job orders on the board' },
    ],
  },
  {
    key: 'workload',
    label: 'Workload',
    icon: '📈',
    actions: [
      { key: 'view', label: 'View Workload & Capacity', description: 'See team utilization data' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: '📉',
    actions: [
      { key: 'view',   label: 'View Reports & Analytics', description: 'Access all charts and metrics' },
      { key: 'export', label: 'Export Reports',           description: 'Download data as CSV / PDF' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    actions: [
      { key: 'view_profile',        label: 'Edit Own Profile',           description: 'Change name, email, password, photo' },
      { key: 'view_users',          label: 'View User List',             description: 'See all users in the system' },
      { key: 'manage_users',        label: 'Add / Edit / Terminate',     description: 'Full user management' },
      { key: 'manage_team',         label: 'Manage Team Members',        description: 'Add or edit DAP team resources' },
      { key: 'manage_permissions',  label: 'Manage Role Permissions',    description: 'Configure RBAC for all roles' },
      { key: 'manage_integrations', label: 'Configure Integrations',     description: 'Connect external tools' },
    ],
  },
]

// ── Permission key format: "module.action" ────────────────────────────────────

export type PermissionKey = string
export type RolePermissions = Record<UserRole, PermissionKey[]>

// Helper to build a full key
export const perm = (module: string, action: string): PermissionKey => `${module}.${action}`

// All possible permissions (for Super Admin)
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_MODULES.flatMap(m =>
  m.actions.map(a => perm(m.key, a.key))
)

// Powers reserved for Super Admin — Admins do NOT get these
export const SUPER_ADMIN_ONLY: PermissionKey[] = [
  perm('settings', 'manage_permissions'), // configure RBAC for all roles
  perm('settings', 'manage_users'),        // add / edit / terminate users
]

// Admin gets everything except the Super-Admin-only powers
export const ADMIN_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter(
  p => !SUPER_ADMIN_ONLY.includes(p)
)

// ── Default permission matrix ─────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: RolePermissions = {
  'Super Admin': ALL_PERMISSIONS,

  Admin: ADMIN_PERMISSIONS,

  // DAP Team members only get: Dashboard, Calendar, Job Orders, Pipeline
  // (all scoped to the work assigned to them), plus their own profile.
  'DAP Team': [
    perm('dashboard', 'view'),
    perm('calendar',  'view'),
    perm('calendar',  'create'),
    perm('calendar',  'edit'),
    perm('job_orders','view'),
    perm('job_orders','edit'),
    perm('job_orders','change_status'),
    perm('job_orders','view_requests'),
    perm('job_orders','manage_requests'),
    perm('pipeline',  'view'),
    perm('pipeline',  'move_cards'),
    perm('settings',  'view_profile'),
  ],

  'Brand Team': [
    perm('dashboard', 'view'),
    perm('calendar',  'view'),
    perm('job_orders','view'),
    perm('job_orders','create'),
    perm('pipeline',  'view'),
    perm('reports',   'view'),
    perm('settings',  'view_profile'),
  ],

  Leadership: [
    perm('dashboard', 'view'),
    perm('calendar',  'view'),
    perm('job_orders','view'),
    perm('pipeline',  'view'),
    perm('workload',  'view'),
    perm('reports',   'view'),
    perm('reports',   'export'),
    perm('settings',  'view_profile'),
  ],

  'End User': [
    perm('dashboard',  'view'),
    perm('calendar',   'view'),
    perm('job_orders', 'view'),
    perm('job_orders', 'create'),
    perm('settings',   'view_profile'),
  ],
}
