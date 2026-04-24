import { useState } from 'react'
import {
  UserPlus, Shield, ShieldOff, ShieldAlert, Pencil, RotateCcw,
  X, Check, ChevronDown, Users, Lock, AlertTriangle,
  User, KeyRound, Save, Settings2, Sliders, Plug2,
  Calendar, MessageSquare, HardDrive, Layers, RefreshCw,
  CheckCircle2, XCircle, ExternalLink, Mail,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ManagedUser, UserRole, RequestingTeam, UserStatus, Resource, DAPSubRole, DAPTeam } from '../types'

const ROLES: UserRole[] = ['Admin', 'DAP Team', 'Brand Team', 'Leadership']
const TEAMS: RequestingTeam[] = ['BMG', 'MOD', 'MTO', 'CBE']

type SettingsTab = 'profile' | 'users' | 'team' | 'capacity' | 'activity' | 'integrations'

const SUB_ROLES: DAPSubRole[] = ['Photographer', 'Videographer', 'Video Editor', 'Audio Editor', 'Graphic Designer']
const DAP_TEAMS: DAPTeam[] = ['Photo', 'Video', 'Audio', 'Design']

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ElementType
  iconColor: string
  connected: boolean
  syncLabel?: string
  configFields?: { label: string; placeholder: string; type?: string }[]
}

const statusMeta: Record<UserStatus, { label: string; className: string; icon: React.ElementType }> = {
  active:     { label: 'Active',     className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800',  icon: Check },
  limited:    { label: 'Limited',    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800',              icon: Lock },
  terminated: { label: 'Terminated', className: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-800',                         icon: ShieldOff },
}

const roleBadge: Record<UserRole, string> = {
  'Admin':      'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'DAP Team':   'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'Brand Team': 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  'Leadership': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
}

function genId() { return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

interface EditForm { name: string; email: string; password: string; role: UserRole; team?: RequestingTeam }
type ModalMode = 'add' | 'edit' | null
type ConfirmAction = { type: 'terminate' | 'limit' | 'reinstate'; userId: string; userName: string } | null

// Default capacity limits per team
const DEFAULT_CAPACITY = [
  { team: 'Photo Team',  limit: 40, current: 80 },
  { team: 'Video Team',  limit: 40, current: 95 },
  { team: 'Audio Team',  limit: 40, current: 50 },
  { team: 'Design Team', limit: 40, current: 60 },
]

const ACTIVITY_TYPES = [
  { name: 'Photo Shoot',           color: '#3B82F6', icon: '📷' },
  { name: 'Video Shoot',           color: '#EF4444', icon: '🎬' },
  { name: 'Static Artwork Design', color: '#10B981', icon: '🎨' },
  { name: 'Video Editing',         color: '#F97316', icon: '✂️' },
  { name: 'Audio Recording',       color: '#8B5CF6', icon: '🎙️' },
  { name: 'Audio Editing',         color: '#EC4899', icon: '🎧' },
]

export function SettingsPage() {
  const { currentUser, managedUsers, addManagedUser, updateManagedUser, terminateUser, limitUser, reinstateUser, resources, updateResource, addResource } = useAppStore()

  const EMOJI_OPTIONS = [
    '😀','😊','😎','🤓','😄','🥸','🤩','😇','🧐','😏',
    '🤠','🥳','🤗','😍','🤑','🤖','👻','🎅','🧙','🕵️',
    '👮','👷','🧑‍💼','👨‍🎨','👩‍🎨','👨‍💻','👩‍💻','🧑‍🎤','👨‍🚀','👩‍🚀',
    '📸','🎬','🎨','🎧','✏️','🎤','🎥','🖼️','🎭','⭐',
  ]

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all')
  const [form, setForm] = useState<EditForm>({ name: '', email: '', password: '', role: 'DAP Team' })
  const [formError, setFormError] = useState('')
  const [formEmoji, setFormEmoji] = useState('😊')
  const [showFormEmojiPicker, setShowFormEmojiPicker] = useState(false)

  // My Profile state
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    password: '',
  })
  const [profileEmoji, setProfileEmoji] = useState(currentUser?.avatar ?? '😊')
  const [showProfileEmojiPicker, setShowProfileEmojiPicker] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Team member editing state
  const [editingMember, setEditingMember] = useState<Resource | null>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [memberForm, setMemberForm] = useState<{ name: string; email: string; role: DAPSubRole; team: DAPTeam }>({ name: '', email: '', role: 'Photographer', team: 'Photo' })
  const [memberSaved, setMemberSaved] = useState('')

  const MEMBER_COLORS = ['bg-blue-500','bg-cyan-500','bg-purple-500','bg-red-500','bg-emerald-500','bg-teal-500','bg-amber-500','bg-pink-500','bg-indigo-500','bg-orange-500']

  function openEditMember(r: Resource) {
    setAddingMember(false)
    setEditingMember(r)
    setMemberForm({ name: r.name, email: r.email, role: r.role, team: r.team })
  }

  function openAddMember() {
    setEditingMember(null)
    setAddingMember(true)
    setMemberForm({ name: '', email: '', role: 'Photographer', team: 'Photo' })
  }

  function saveMember() {
    if (!memberForm.name.trim() || !memberForm.email.trim()) return
    const inits = memberForm.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    if (addingMember) {
      const color = MEMBER_COLORS[resources.length % MEMBER_COLORS.length]
      addResource({ id: `r${Date.now()}`, name: memberForm.name.trim(), email: memberForm.email.trim(), role: memberForm.role, team: memberForm.team, initials: inits, color, maxWeeklyHours: 40 })
      setAddingMember(false)
      setMemberSaved('new')
    } else if (editingMember) {
      updateResource({ ...editingMember, name: memberForm.name.trim(), email: memberForm.email.trim(), role: memberForm.role, team: memberForm.team, initials: inits })
      setMemberSaved(editingMember.id)
      setEditingMember(null)
    }
    setTimeout(() => setMemberSaved(''), 2000)
  }

  const isAdmin = currentUser?.role === 'Admin'
  const displayed = managedUsers.filter(u => filterStatus === 'all' || u.status === filterStatus)

  // Profile save
  function handleProfileSave() {
    if (!profileForm.name.trim()) return
    const managed = managedUsers.find(u => u.id === currentUser?.id)
    if (managed) {
      updateManagedUser({
        ...managed,
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        password: profileForm.password || managed.password,
        avatar: profileEmoji,
      })
    }
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  function openAdd() {
    setForm({ name: '', email: '', password: '', role: 'DAP Team' })
    setFormEmoji('😊'); setShowFormEmojiPicker(false)
    setFormError(''); setEditTarget(null); setModalMode('add')
  }

  function openEdit(u: ManagedUser) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, team: u.team })
    setFormEmoji(u.avatar ?? '😊'); setShowFormEmojiPicker(false)
    setFormError(''); setEditTarget(u); setModalMode('edit')
  }

  function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.email.trim()) { setFormError('Email is required'); return }
    if (modalMode === 'add' && !form.password.trim()) { setFormError('Password is required'); return }

    if (modalMode === 'add') {
      if (managedUsers.find(u => u.email.toLowerCase() === form.email.toLowerCase())) {
        setFormError('A user with this email already exists'); return
      }
      addManagedUser({
        id: genId(), name: form.name.trim(), email: form.email.trim().toLowerCase(),
        password: form.password, role: form.role, team: form.team,
        avatar: formEmoji, status: 'active', createdAt: new Date().toISOString(),
      })
    } else if (editTarget) {
      updateManagedUser({
        ...editTarget, name: form.name.trim(), email: form.email.trim().toLowerCase(),
        password: form.password || editTarget.password, role: form.role,
        team: form.team, avatar: formEmoji,
      })
    }
    setModalMode(null)
  }

  function handleConfirm() {
    if (!confirm) return
    if (confirm.type === 'terminate') terminateUser(confirm.userId)
    else if (confirm.type === 'limit') limitUser(confirm.userId)
    else reinstateUser(confirm.userId)
    setConfirm(null)
  }

  const counts = {
    all: managedUsers.length,
    active: managedUsers.filter(u => u.status === 'active').length,
    limited: managedUsers.filter(u => u.status === 'limited').length,
    terminated: managedUsers.filter(u => u.status === 'terminated').length,
  }

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'gcal',
      name: 'Google Calendar',
      description: 'Sync JO deadlines and production schedules to Google Calendar. Keeps your team updated automatically.',
      icon: Calendar,
      iconColor: 'text-blue-500',
      connected: false,
      syncLabel: 'Syncs: Deadlines, Launch Dates, Scheduled Events',
      configFields: [{ label: 'Calendar ID', placeholder: 'your-calendar@gmail.com' }],
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Receive real-time notifications in Slack for status changes, new JOs, and deadline alerts.',
      icon: MessageSquare,
      iconColor: 'text-emerald-500',
      connected: false,
      syncLabel: 'Syncs: Status changes, New JOs, Overdue alerts',
      configFields: [{ label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...' }],
    },
    {
      id: 'onedrive',
      name: 'OneDrive / SharePoint',
      description: 'Link production files and deliverables directly from SharePoint into Job Orders.',
      icon: HardDrive,
      iconColor: 'text-sky-500',
      connected: false,
      syncLabel: 'Syncs: File references, Deliverable uploads',
      configFields: [
        { label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { label: 'Site URL', placeholder: 'https://company.sharepoint.com/sites/...' },
      ],
    },
    {
      id: 'adobe',
      name: 'Adobe Creative Cloud',
      description: 'Track Adobe project files linked to Job Orders. Opens files directly from the detail panel.',
      icon: Layers,
      iconColor: 'text-red-500',
      connected: false,
      syncLabel: 'Syncs: Project files, Asset references',
      configFields: [{ label: 'Organization ID', placeholder: 'Your Adobe Org ID' }],
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      description: 'Post JO status updates and approval notifications directly to Teams channels.',
      icon: Users,
      iconColor: 'text-blue-500',
      connected: false,
      syncLabel: 'Syncs: Status changes, Approval requests',
      configFields: [{ label: 'Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' }],
    },
    {
      id: 'gcalendar2',
      name: 'iCal / Outlook Calendar',
      description: 'Export production schedules as a subscribable .ics calendar feed for any calendar app.',
      icon: RefreshCw,
      iconColor: 'text-orange-500',
      connected: true,
      syncLabel: 'Syncs every 15 minutes',
    },
  ])
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null)

  function toggleIntegration(id: string) {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i))
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile',      label: 'My Profile',     icon: User },
    { id: 'users',        label: 'User Management', icon: Users },
    { id: 'team',         label: 'Team Members',    icon: Mail },
    { id: 'capacity',     label: 'Capacity',        icon: Sliders },
    { id: 'activity',     label: 'Activity Types',  icon: Settings2 },
    { id: 'integrations', label: 'Integrations',    icon: Plug2 },
  ]

  return (
    <div className="space-y-5 max-w-[1100px]">

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm w-fit flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TEAM MEMBERS ───────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">DAP Team Members</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Edit names and emails — members receive notifications when assigned to a Job Order.</p>
            </div>
            {isAdmin && !addingMember && (
              <button onClick={openAddMember} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <UserPlus size={13} /> Add Member
              </button>
            )}
          </div>

          {/* Add member form */}
          {addingMember && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">New Team Member</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Full Name *</label>
                  <input className="form-input text-sm" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Email *</label>
                  <input type="email" className="form-input text-sm" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} placeholder="member@company.com" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Role</label>
                  <select className="form-input text-sm" value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value as DAPSubRole }))}>
                    {SUB_ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Team</label>
                  <select className="form-input text-sm" value={memberForm.team} onChange={e => setMemberForm(f => ({ ...f, team: e.target.value as DAPTeam }))}>
                    {DAP_TEAMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveMember} disabled={!memberForm.name.trim() || !memberForm.email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-colors">
                  <Check size={12} /> Add Member
                </button>
                <button onClick={() => setAddingMember(false)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-semibold rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {memberSaved === 'new' && (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              <Check size={13} /> Member added successfully.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resources.map(r => (
              <div key={r.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                {editingMember?.id === r.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-9 h-9 rounded-full ${editingMember?.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{memberForm.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || editingMember?.initials}</span>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Editing</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Full Name</label>
                      <input className="form-input text-sm" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Email</label>
                      <input type="email" className="form-input text-sm" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} placeholder="member@company.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Role</label>
                        <select className="form-input text-sm" value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value as DAPSubRole }))}>
                          {SUB_ROLES.map(role => <option key={role}>{role}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Team</label>
                        <select className="form-input text-sm" value={memberForm.team} onChange={e => setMemberForm(f => ({ ...f, team: e.target.value as DAPTeam }))}>
                          {DAP_TEAMS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveMember} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingMember(null)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className={`w-10 h-10 rounded-full ${r.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>{r.initials}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                        {memberSaved === r.id && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Check size={10} /> Saved</span>}
                        {isAdmin && (
                          <button onClick={() => openEditMember(r)} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded-lg transition-colors shrink-0">
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.role} · {r.team} Team</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Mail size={11} className="text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{r.email || <span className="italic text-amber-500">No email set</span>}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MY PROFILE ─────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="card p-6 max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-4xl shadow-md border border-slate-200 dark:border-slate-600">
              {profileEmoji}
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">{currentUser?.name}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">{currentUser?.role} · {currentUser?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">Avatar</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowProfileEmojiPicker(v => !v)}
                  className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center text-4xl transition-all"
                >
                  {profileEmoji}
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500">Click to choose your avatar</p>
              </div>
              {showProfileEmojiPicker && (
                <div className="mt-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} type="button" onClick={() => { setProfileEmoji(e); setShowProfileEmojiPicker(false) }}
                        className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${profileEmoji === e ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">Display Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  className="form-input pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                placeholder="your@email.com"
                className="form-input"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">
                New Password <span className="font-normal text-slate-400">(leave blank to keep current)</span>
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={e => setProfileForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="form-input pl-9"
                />
              </div>
            </div>

            <button
              onClick={handleProfileSave}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                profileSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              {profileSaved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Profile</>}
            </button>
          </div>
        </div>
      )}

      {/* ── USER MANAGEMENT ───────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">User Management</h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Manage access, roles, and permissions</p>
            </div>
            {isAdmin && (
              <button onClick={openAdd} className="btn-primary text-xs px-3 py-2">
                <UserPlus size={14} /> Add User
              </button>
            )}
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="shrink-0" /> Read-only. Only Admins can manage users.
            </div>
          )}

          {/* Filter stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([['all', 'All Users', 'text-slate-700 dark:text-slate-300'], ['active', 'Active', 'text-emerald-700 dark:text-emerald-400'], ['limited', 'Limited', 'text-amber-700 dark:text-amber-400'], ['terminated', 'Terminated', 'text-red-600 dark:text-red-400']] as const).map(([key, label, cls]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === key ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}`}
              >
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{counts[key]}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${cls}`}>{label}</p>
              </button>
            ))}
          </div>

          {/* User table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{displayed.length} user{displayed.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {displayed.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">No users match this filter</div>
              ) : displayed.map(u => {
                const sm = statusMeta[u.status]
                const StatusIcon = sm.icon
                const isSelf = u.id === currentUser?.id
                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl shrink-0 border border-slate-200 dark:border-slate-600">
                      {u.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{u.name}</p>
                        {isSelf && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded-full">You</span>}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{u.email}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg hidden sm:block ${roleBadge[u.role]}`}>{u.role}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${sm.className}`}>
                      <StatusIcon size={10} />{sm.label}
                    </span>
                    {isAdmin && !isSelf && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                        {u.status !== 'terminated' && u.status !== 'limited' && (
                          <button onClick={() => setConfirm({ type: 'limit', userId: u.id, userName: u.name })} title="Limit" className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors">
                            <ShieldAlert size={13} />
                          </button>
                        )}
                        {u.status !== 'terminated' && (
                          <button onClick={() => setConfirm({ type: 'terminate', userId: u.id, userName: u.name })} title="Terminate" className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                            <ShieldOff size={13} />
                          </button>
                        )}
                        {(u.status === 'limited' || u.status === 'terminated') && (
                          <button onClick={() => setConfirm({ type: 'reinstate', userId: u.id, userName: u.name })} title="Reinstate" className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors">
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CAPACITY LIMITS ────────────────────────────────────── */}
      {activeTab === 'capacity' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Capacity Limits</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Set max weekly hours per team. Alerts trigger when utilization exceeds 90%.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DEFAULT_CAPACITY.map(t => (
              <div key={t.team} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.team}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.current > 90 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                    {t.current}% utilized
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">Max hours/week</p>
                  <input
                    type="number"
                    defaultValue={t.limit}
                    min={10} max={60}
                    className="form-input w-24 text-center font-bold"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">hrs</p>
                </div>
                <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${t.current}%`,
                    background: t.current > 90 ? '#EF4444' : 'linear-gradient(90deg, #7C3AED, #EC4899)',
                  }} />
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary text-xs px-4 py-2.5">
            <Save size={13} /> Save Capacity Settings
          </button>
        </div>
      )}

      {/* ── ACTIVITY TYPES ─────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Activity Types</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Defined production activity types used across Job Orders, Calendar, and Workload.</p>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {ACTIVITY_TYPES.map(a => (
                <div key={a.name} className="flex items-center gap-4 px-5 py-4">
                  <span className="text-xl">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.name}</p>
                  </div>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{a.color}</span>
                  <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">Active</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Activity types are system-defined. Contact your administrator to modify them.</p>
        </div>
      )}

      {/* ── INTEGRATIONS ──────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Integrations</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              Connect DAP Flow with your existing tools to sync schedules, files, and notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {integrations.map(intg => {
              const Icon = intg.icon
              const expanded = expandedIntegration === intg.id
              return (
                <div key={intg.id} className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 ${intg.iconColor}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{intg.name}</p>
                        {intg.connected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 size={9} /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            <XCircle size={9} /> Not connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{intg.syncLabel ?? intg.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {intg.configFields && (
                        <button
                          onClick={() => setExpandedIntegration(expanded ? null : intg.id)}
                          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          Configure
                        </button>
                      )}
                      <button
                        onClick={() => toggleIntegration(intg.id)}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          intg.connected ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          intg.connected ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Expand config */}
                  {expanded && intg.configFields && (
                    <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-700 pt-4 space-y-3 bg-slate-50/50 dark:bg-slate-700/20">
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{intg.description}</p>
                      {intg.configFields.map(field => (
                        <div key={field.label}>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">{field.label}</label>
                          <input
                            type={field.type ?? 'text'}
                            placeholder={field.placeholder}
                            className="form-input text-xs"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { toggleIntegration(intg.id); setExpandedIntegration(null) }}
                          className="btn-primary text-xs px-4 py-2"
                        >
                          <CheckCircle2 size={13} /> Save & Connect
                        </button>
                        <button
                          onClick={() => setExpandedIntegration(null)}
                          className="text-xs px-4 py-2 font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                        <a
                          href="#"
                          onClick={e => e.preventDefault()}
                          className="ml-auto flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          <ExternalLink size={11} /> View Docs
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Integration configs are stored locally. Contact your IT admin to set up shared credentials.
          </p>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalMode(null)} />
          <div className="modal-card w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                  {modalMode === 'add' ? 'Add New User' : 'Edit User'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {modalMode === 'add' ? 'Create account with role and team' : 'Update user details and access'}
                </p>
              </div>
              <button onClick={() => setModalMode(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Avatar</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowFormEmojiPicker(v => !v)}
                    className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center text-3xl transition-all">
                    {formEmoji}
                  </button>
                  <p className="text-xs text-slate-400">Click to choose an avatar</p>
                </div>
                {showFormEmojiPicker && (
                  <div className="mt-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_OPTIONS.map(e => (
                        <button key={e} type="button" onClick={() => { setFormEmoji(e); setShowFormEmojiPicker(false) }}
                          className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${formEmoji === e ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400' : ''}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Maria Santos" className="form-input" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@dapflow.com" className="form-input" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                  Password {modalMode === 'edit' && <span className="font-normal text-slate-400">(blank = keep current)</span>}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="form-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Role</label>
                  <div className="relative">
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className="form-input appearance-none pr-8">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Team <span className="font-normal text-slate-400">(opt.)</span></label>
                  <div className="relative">
                    <select value={form.team ?? ''} onChange={e => setForm(f => ({ ...f, team: (e.target.value || undefined) as RequestingTeam | undefined }))} className="form-input appearance-none pr-8">
                      <option value="">— none —</option>
                      {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              {formError && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {formError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalMode(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} className="flex-1 btn-primary justify-center">
                  {modalMode === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-card w-full max-w-sm p-6 z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirm.type === 'terminate' ? 'bg-red-100 dark:bg-red-900/30' : confirm.type === 'limit' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              {confirm.type === 'terminate' && <ShieldOff size={20} className="text-red-600 dark:text-red-400" />}
              {confirm.type === 'limit'     && <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />}
              {confirm.type === 'reinstate' && <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />}
            </div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
              {confirm.type === 'terminate' ? 'Terminate User' : confirm.type === 'limit' ? 'Limit Access' : 'Reinstate User'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {confirm.type === 'terminate' && `${confirm.userName} will no longer be able to log in.`}
              {confirm.type === 'limit'     && `${confirm.userName} will have limited system access.`}
              {confirm.type === 'reinstate' && `${confirm.userName} will be restored to active status.`}
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm ${confirm.type === 'terminate' ? 'bg-red-600 hover:bg-red-700' : confirm.type === 'limit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

