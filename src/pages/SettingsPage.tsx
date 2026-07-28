import { useState, useRef, useEffect } from 'react'
import {
  UserPlus, Shield, ShieldOff, ShieldAlert, Pencil, RotateCcw,
  X, Check, ChevronDown, Users, Lock, AlertTriangle,
  User, KeyRound, Save, Settings2, Sliders, Plug2,
  Calendar, MessageSquare, HardDrive, Layers, RefreshCw,
  CheckCircle2, XCircle, ExternalLink, Mail, Eye, EyeOff, Camera, Trash2,
  Search, Plus, UserCheck, Building2, ChevronUp, GripVertical, ToggleLeft, ToggleRight, FileSliders,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { uploadAvatar } from '../lib/supabase'
import { PERMISSION_MODULES, DEFAULT_PERMISSIONS, ALL_PERMISSIONS, perm } from '../data/permissions'
import { usePermissions } from '../hooks/usePermissions'
import type { ManagedUser, UserRole, RequestingTeam, UserStatus, Resource, DAPSubRole, DAPTeam, Approver, BookingDepartment, FormOption, ActivityType } from '../types'
import { DAP_MEMBER_ROLES, DAP_TEAM_LIST } from '../types'

// Services a DAP Team Approver can be responsible for (matches booking activity types)
const DAP_SERVICES: ActivityType[] = [
  'Photo Shoot', 'Video Shoot', 'Static Artwork Design', 'Digital Design',
  'Graphics', 'Printing', 'ASC', 'Video Editing', 'Audio Recording', 'Audio Editing', 'Audio Services', 'Content Writing',
]

const ROLES: UserRole[] = ['Super Admin', 'Admin', 'DAP Team', 'Brand Team', 'Leadership', 'End User']
const TEAMS: RequestingTeam[] = ['BMG', 'MOD', 'MTO', 'CBE']

type SettingsTab = 'profile' | 'users' | 'team' | 'capacity' | 'activity' | 'integrations' | 'permissions' | 'approvers' | 'dap-approvers' | 'departments' | 'booking-form'


const SUB_ROLES: DAPSubRole[] = [...DAP_MEMBER_ROLES]
const DAP_TEAMS: DAPTeam[] = [...DAP_TEAM_LIST]

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
  'Super Admin': 'bg-brand-900 text-white dark:bg-brand-300 dark:text-brand-900',
  'Admin':      'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
  'DAP Team':   'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
  'Brand Team': 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  'Leadership': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  'End User':   'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
}

function genId() { return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

interface EditForm { name: string; email: string; password: string; role: UserRole; team?: RequestingTeam }
type ModalMode = 'add' | 'edit' | null
type ConfirmAction = { type: 'terminate' | 'limit' | 'reinstate' | 'remove'; userId: string; userName: string } | null

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
  { name: 'Audio Recording',       color: '#8B9FE8', icon: '🎙️' },
  { name: 'Audio Editing',         color: '#EC4899', icon: '🎧' },
]

// ── Booking Form Configuration Tab ───────────────────────────────────────────

const GRAPHICS_PROJECT_TO_PROCESS: Record<string, string> = {
  'Banners': 'Large Format Printing', 'Flag Type': 'Large Format Printing',
  'Billboards': 'Large Format Printing', 'Vehicle wraps': 'Large Format Printing',
  'Wall murals': 'Large Format Printing', 'Window graphics': 'Large Format Printing',
  'Boundary Signages': 'Large Format Printing', 'Lighted Signage': 'Large Format Printing',
  'Wallsigns': 'Large Format Printing', 'Signages': 'Large Format Printing',
  'Backdrops': 'Large Format Printing', 'Roll-up banners': 'Large Format Printing',
  'Floor graphics': 'Large Format Printing', 'Event displays': 'Large Format Printing',
  'Trade show booths': 'Large Format Printing',
  'Brochures': 'Offset Lithography', 'Flyers': 'Offset Lithography',
  'Leaflets': 'Offset Lithography', 'Catalogs': 'Offset Lithography',
  'Magazines': 'Offset Lithography', 'Books': 'Offset Lithography',
  'Calendars': 'Offset Lithography', 'Packaging boxes': 'Offset Lithography',
  'Paper bags': 'Offset Lithography', 'Corporate stationery': 'Offset Lithography',
  'Envelopes': 'Offset Lithography', 'Notebooks': 'Offset Lithography',
  'Bundling Sticker': 'Offset Lithography', 'Wobbler': 'Offset Lithography',
  'Shelftalker': 'Offset Lithography', 'Product Sticker': 'Offset Lithography',
  'PR Box': 'Offset Lithography', 'Price Tag': 'Offset Lithography',
  'Neck tag': 'Offset Lithography',
  'Customized T-shirts and sportswear': 'Sublimation Printing',
  'Coffee mugs and drinkware': 'Sublimation Printing',
  'Lanyards': 'Sublimation Printing', 'Cap and Arm Sleeves': 'Sublimation Printing',
  'Umbrella': 'Sublimation Printing', 'Folded Round Fan': 'Sublimation Printing',
  'Eco Bag': 'Sublimation Printing', 'Loot Bag': 'Sublimation Printing',
}

const PROCESS_BADGE: Record<string, string> = {
  'Large Format Printing': 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
  'Offset Lithography':    'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'Sublimation Printing':  'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
}

const CONFIGURABLE_SERVICES = [
  { id: '__services__', label: 'Services', subtitle: 'Which services appear on the booking form' },
  { id: 'Static Artwork Design', label: 'Static Artwork Design', subtitle: 'Size, Material, Orientation' },
  { id: 'Printing', label: 'Printing', subtitle: 'Paper Size, Color, Orientation, Material' },
  { id: 'Graphics', label: 'Graphics', subtitle: 'Project Category, Printing Process' },
  { id: 'Graphics-Large Format Printing', label: 'Graphics — Large Format', subtitle: 'Material types' },
  { id: 'Graphics-Offset Lithography',    label: 'Graphics — Offset Litho', subtitle: 'Material types' },
  { id: 'Graphics-Sublimation Printing',  label: 'Graphics — Sublimation',  subtitle: 'Material types' },
  { id: 'Digital Design', label: 'Digital Design', subtitle: 'Asset Type' },
  { id: 'ASC', label: 'ASC', subtitle: 'Ad Type' },
  { id: 'Video Editing', label: 'Video Editing', subtitle: 'Platform, Resolution, Orientation, Output Format, Style' },
  { id: 'Video Shoot',   label: 'Video Shoot',   subtitle: 'Type of Shoot' },
]

interface BookingFormConfigTabProps {
  formOptions: FormOption[]
  addFormOption: (o: FormOption) => void
  updateFormOption: (o: FormOption) => void
  removeFormOption: (id: string) => void
}

function BookingFormConfigTab({ formOptions, addFormOption, updateFormOption, removeFormOption }: BookingFormConfigTabProps) {
  const [selectedService, setSelectedService] = useState(CONFIGURABLE_SERVICES[0].id)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)   // fieldKey being added to
  const [newLabel, setNewLabel] = useState('')
  const [newProcess, setNewProcess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const serviceOpts = formOptions.filter(o => o.service === selectedService).sort((a, b) => a.sortOrder - b.sortOrder)

  // Group by fieldKey, preserving first-seen order; hide internal/removed fields for Graphics
  const fieldKeys = Array.from(new Set(serviceOpts.map(o => o.fieldKey)))
    .filter(fk => !(selectedService === 'Graphics' && (fk === 'dsw_orientation' || fk === 'dsw_projectProcess')))
  const fieldGroups = fieldKeys.map(fk => ({
    fieldKey: fk,
    fieldLabel: serviceOpts.find(o => o.fieldKey === fk)?.fieldLabel ?? fk,
    options: serviceOpts.filter(o => o.fieldKey === fk),
  }))

  const isGraphicsCategory = selectedService === 'Graphics' && addingTo === 'dsw_paperSize'

  function handleAddOption(fieldKey: string, fieldLabel: string) {
    const label = newLabel.trim()
    if (!label) return
    if (isGraphicsCategory && !newProcess) return
    const existing = formOptions.filter(o => o.service === selectedService && o.fieldKey === fieldKey)
    const maxOrder = existing.reduce((m, o) => Math.max(m, o.sortOrder), -1)
    addFormOption({
      id: `fopt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      service: selectedService,
      fieldKey,
      fieldLabel,
      optionValue: label,
      optionLabel: label,
      isActive: true,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
    })
    // Store process mapping as a companion entry so BookingRequestForm can auto-select
    if (isGraphicsCategory && newProcess) {
      addFormOption({
        id: `fopt_${Date.now()}_proc_${Math.random().toString(36).slice(2, 6)}`,
        service: 'Graphics',
        fieldKey: 'dsw_projectProcess',
        fieldLabel: 'Project Process Map',
        optionValue: label,
        optionLabel: newProcess,
        isActive: true,
        sortOrder: maxOrder + 1,
        createdAt: new Date().toISOString(),
      })
    }
    setNewLabel('')
    setNewProcess('')
    setAddingTo(null)
  }

  function handleSaveEdit(id: string) {
    const label = editLabel.trim()
    if (!label) return
    const opt = formOptions.find(o => o.id === id)
    if (!opt) return
    updateFormOption({ ...opt, optionValue: label, optionLabel: label })
    setEditingId(null)
  }

  function moveUp(opts: FormOption[], idx: number) {
    if (idx === 0) return
    const prev = opts[idx - 1]
    const cur  = opts[idx]
    updateFormOption({ ...cur, sortOrder: prev.sortOrder })
    updateFormOption({ ...prev, sortOrder: cur.sortOrder })
  }

  function moveDown(opts: FormOption[], idx: number) {
    if (idx === opts.length - 1) return
    const next = opts[idx + 1]
    const cur  = opts[idx]
    updateFormOption({ ...cur, sortOrder: next.sortOrder })
    updateFormOption({ ...next, sortOrder: cur.sortOrder })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Booking Form Configuration</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
          Manage the dropdown options that appear in the Booking Form. Changes take effect immediately — no redeployment needed.
        </p>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        {/* ── Service sidebar ── */}
        <div className="sm:w-52 shrink-0 space-y-1">
          {CONFIGURABLE_SERVICES.map(svc => (
            <button
              key={svc.id}
              onClick={() => { setSelectedService(svc.id); setExpandedField(null); setAddingTo(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                selectedService === svc.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <p className={`text-sm font-bold leading-tight ${selectedService === svc.id ? 'text-white' : ''}`}>{svc.label}</p>
              <p className={`text-[10px] mt-0.5 leading-tight ${selectedService === svc.id ? 'text-brand-100' : 'text-slate-400 dark:text-slate-500'}`}>{svc.subtitle}</p>
            </button>
          ))}
        </div>

        {/* ── Field groups ── */}
        <div className="flex-1 space-y-3 min-w-0">
          {fieldGroups.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">No options configured for this service yet.</p>
            </div>
          )}

          {fieldGroups.map(({ fieldKey, fieldLabel, options }) => {
            const isOpen = expandedField === fieldKey
            const activeCount = options.filter(o => o.isActive).length

            return (
              <div key={fieldKey} className="card overflow-hidden">
                {/* Field header */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  onClick={() => setExpandedField(isOpen ? null : fieldKey)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{fieldLabel}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {activeCount} active · {options.length - activeCount} hidden · field key: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{fieldKey}</code>
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={15} className="text-slate-400 shrink-0" /> : <ChevronDown size={15} className="text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    {/* Option rows */}
                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {options.map((opt, idx) => (
                        <div key={opt.id} className={`flex items-center gap-2 px-4 py-2.5 ${!opt.isActive ? 'opacity-50' : ''}`}>
                          <GripVertical size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />

                          {editingId === opt.id ? (
                            <input
                              autoFocus
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(opt.id); if (e.key === 'Escape') setEditingId(null) }}
                              className="flex-1 text-sm border border-brand-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:bg-slate-700 dark:text-slate-100 dark:border-brand-500"
                            />
                          ) : (
                            <span className="flex-1 flex items-center gap-2 min-w-0">
                              <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{opt.optionLabel}</span>
                              {selectedService === 'Graphics' && fieldKey === 'dsw_paperSize' && GRAPHICS_PROJECT_TO_PROCESS[opt.optionValue] && (
                                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PROCESS_BADGE[GRAPHICS_PROJECT_TO_PROCESS[opt.optionValue]]}`}>
                                  {GRAPHICS_PROJECT_TO_PROCESS[opt.optionValue]}
                                </span>
                              )}
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Up/Down */}
                            <button type="button" onClick={() => moveUp(options, idx)} disabled={idx === 0}
                              className="p-1 rounded text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronUp size={13} />
                            </button>
                            <button type="button" onClick={() => moveDown(options, idx)} disabled={idx === options.length - 1}
                              className="p-1 rounded text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronDown size={13} />
                            </button>

                            {/* Edit */}
                            {editingId === opt.id ? (
                              <>
                                <button type="button" onClick={() => handleSaveEdit(opt.id)}
                                  className="p-1 rounded text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                                  <Check size={13} />
                                </button>
                                <button type="button" onClick={() => setEditingId(null)}
                                  className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => { setEditingId(opt.id); setEditLabel(opt.optionLabel) }}
                                className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                                <Pencil size={12} />
                              </button>
                            )}

                            {/* Toggle active */}
                            <button type="button" onClick={() => updateFormOption({ ...opt, isActive: !opt.isActive })}
                              className={`p-1 rounded transition-colors ${opt.isActive ? 'text-brand-500 hover:text-slate-400' : 'text-slate-300 hover:text-brand-500'}`}
                              title={opt.isActive ? 'Hide from form' : 'Show in form'}>
                              {opt.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                            </button>

                            {/* Delete */}
                            <button type="button" onClick={() => setDeleteConfirm(opt.id)}
                              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add option row */}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                      {addingTo === fieldKey ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={newLabel}
                              onChange={e => setNewLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddOption(fieldKey, fieldLabel); if (e.key === 'Escape') { setAddingTo(null); setNewLabel(''); setNewProcess('') } }}
                              placeholder="Project category name…"
                              className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:bg-slate-700 dark:text-slate-100"
                            />
                            <button type="button" onClick={() => handleAddOption(fieldKey, fieldLabel)}
                              disabled={isGraphicsCategory && !newProcess}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors">
                              Add
                            </button>
                            <button type="button" onClick={() => { setAddingTo(null); setNewLabel(''); setNewProcess('') }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                          {isGraphicsCategory && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">Printing Process <span className="text-red-500">*</span></span>
                              <select
                                value={newProcess}
                                onChange={e => setNewProcess(e.target.value)}
                                className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:bg-slate-700 dark:text-slate-100">
                                <option value="">Select printing process…</option>
                                <option>Large Format Printing</option>
                                <option>Offset Lithography</option>
                                <option>Sublimation Printing</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setAddingTo(fieldKey); setNewLabel('') }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                          <Plus size={13} /> Add option
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="modal-card w-full max-w-sm p-6 z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
              <Trash2 size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Delete Option?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              This option will be permanently removed. Existing records that used this value are not affected.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { removeFormOption(deleteConfirm); setDeleteConfirm(null) }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const { currentUser, managedUsers, addManagedUser, updateManagedUser, terminateUser, limitUser, reinstateUser, removeManagedUser, resources, updateResource, addResource, rolePermissions, updateRolePermissions, resetRolePermissions, approvers, addApprover, updateApprover, removeApprover, deactivateApprover, reactivateApprover, initApprovers, departments, addDepartment, removeDepartment, formOptions, addFormOption, updateFormOption, removeFormOption } = useAppStore()
  const { can } = usePermissions()

  const EMOJI_OPTIONS = [
    '😀','😊','😎','🤓','😄','🥸','🤩','😇','🧐','😏',
    '🤠','🥳','🤗','😍','🤑','🤖','👻','🎅','🧙','🕵️',
    '👮','👷','🧑‍💼','👨‍🎨','👩‍🎨','👨‍💻','👩‍💻','🧑‍🎤','👨‍🚀','👩‍🚀',
    '📸','🎬','🎨','🎧','✏️','🎤','🎥','🖼️','🎭','⭐',
  ]

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // Sync approvers from Supabase whenever an approvers tab is opened
  useEffect(() => {
    if (activeTab === 'approvers' || activeTab === 'dap-approvers') initApprovers()
  }, [activeTab])

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
  const [showProfileConfirm, setShowProfileConfirm] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())
  const [photoError, setPhotoError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // For the edit-user modal photo
  const [formPhotoUploading, setFormPhotoUploading] = useState(false)
  const formPhotoInputRef = useRef<HTMLInputElement>(null)

  const isPhoto = (av: string) => av.startsWith('data:') || av.startsWith('http')

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Photo must be under 2 MB.')
      e.target.value = ''
      return
    }
    setPhotoUploading(true)
    // Try Supabase Storage first
    const url = await uploadAvatar(currentUser!.id, file)
    if (url) {
      setProfileEmoji(url)
    } else {
      // Fallback: store as base64 directly in the DB avatar column
      const reader = new FileReader()
      reader.onload = () => setProfileEmoji(reader.result as string)
      reader.readAsDataURL(file)
    }
    setShowProfileEmojiPicker(false)
    setPhotoUploading(false)
    e.target.value = ''
  }

  async function handleFormPhotoUpload(e: React.ChangeEvent<HTMLInputElement>, targetId: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { e.target.value = ''; return }
    setFormPhotoUploading(true)
    const url = await uploadAvatar(targetId, file)
    if (url) {
      setFormEmoji(url)
    } else {
      const reader = new FileReader()
      reader.onload = () => setFormEmoji(reader.result as string)
      reader.readAsDataURL(file)
    }
    setFormPhotoUploading(false)
    e.target.value = ''
  }

  // Team member editing state
  const [editingMember, setEditingMember] = useState<Resource | null>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [memberForm, setMemberForm] = useState<{ name: string; email: string; role: DAPSubRole; team: DAPTeam }>({ name: '', email: '', role: DAP_MEMBER_ROLES[0], team: DAP_TEAM_LIST[0] })
  const [memberSaved, setMemberSaved] = useState('')

  const MEMBER_COLORS = ['bg-brand-500','bg-cyan-500','bg-purple-500','bg-red-500','bg-emerald-500','bg-teal-500','bg-amber-500','bg-pink-500','bg-brand-500','bg-orange-500']

  function openEditMember(r: Resource) {
    setAddingMember(false)
    setEditingMember(r)
    setMemberForm({ name: r.name, email: r.email, role: r.role, team: r.team })
  }

  function openAddMember() {
    setEditingMember(null)
    setAddingMember(true)
    setMemberForm({ name: '', email: '', role: DAP_MEMBER_ROLES[0], team: DAP_TEAM_LIST[0] })
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

  const displayed = managedUsers.filter(u => filterStatus === 'all' || u.status === filterStatus)

  // Profile save
  function handleProfileSave() {
    if (!profileForm.name.trim()) return
    const emailChanged = profileForm.email.trim().toLowerCase() !== currentUser?.email?.toLowerCase()
    const passwordChanged = profileForm.password.trim() !== ''
    if (emailChanged || passwordChanged) {
      setShowProfileConfirm(true)
      return
    }
    commitProfileSave()
  }

  function commitProfileSave() {
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
    setShowProfileConfirm(false)
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
    else if (confirm.type === 'remove') removeManagedUser(confirm.userId)
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
      iconColor: 'text-brand-500',
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
      iconColor: 'text-brand-500',
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

  // RBAC: which role is being edited in the Permissions tab
  // Super Admins can also configure the Admin role; Super Admin itself is never editable
  const EDITABLE_ROLES: UserRole[] = currentUser?.role === 'Super Admin'
    ? ['Admin', 'DAP Team', 'Brand Team', 'Leadership', 'End User']
    : ['DAP Team', 'Brand Team', 'Leadership', 'End User']
  const [permRole, setPermRole] = useState<UserRole>('DAP Team')
  const [permSaved, setPermSaved] = useState(false)

  // ── Approvers state ──────────────────────────────────────────────────────────
  const [approverSearch, setApproverSearch] = useState('')
  const [approverStatusFilter, setApproverStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [approverModal, setApproverModal] = useState<'add' | 'edit' | null>(null)
  const [editingApprover, setEditingApprover] = useState<Approver | null>(null)
  const [approverForm, setApproverForm] = useState({ name: '', email: '', position: '' })
  const [approverFormError, setApproverFormError] = useState('')
  const [approverDeleteConfirm, setApproverDeleteConfirm] = useState<Approver | null>(null)
  const [approverSaved, setApproverSaved] = useState('')

  const currentApproverType = activeTab === 'dap-approvers' ? 'dap' : 'booking'
  const typeApprovers = approvers.filter(a => (a.approverType ?? 'booking') === currentApproverType)
  const activeCount   = typeApprovers.filter(a => a.isActive !== false).length
  const inactiveCount = typeApprovers.filter(a => a.isActive === false).length

  function openAddApprover() {
    setApproverForm({ name: '', email: '', position: '' })
    setApproverFormError('')
    setEditingApprover(null)
    setApproverModal('add')
  }

  function openEditApprover(a: Approver) {
    setApproverForm({ name: a.name, email: a.email, position: a.position || '' })
    setApproverFormError('')
    setEditingApprover(a)
    setApproverModal('edit')
  }

  function handleSaveApprover() {
    const name = approverForm.name.trim()
    const email = approverForm.email.trim().toLowerCase()
    const position = approverForm.position.trim()
    if (!name) { setApproverFormError('Name is required'); return }
    if (currentApproverType === 'dap' && !position) { setApproverFormError('Please select the service this approver handles'); return }
    if (currentApproverType === 'dap' && !email) { setApproverFormError('Email is required so they can be notified'); return }
    if (email) {
      const duplicate = approvers.find(a =>
        a.email.toLowerCase() === email && (!editingApprover || a.id !== editingApprover.id)
      )
      if (duplicate) { setApproverFormError('An approver with this email already exists'); return }
    }
    if (approverModal === 'add') {
      addApprover({ id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, email, position, isActive: true, approverType: currentApproverType, createdAt: new Date().toISOString() })
      setApproverSaved('added')
    } else if (editingApprover) {
      updateApprover({ ...editingApprover, name, email, position })
      setApproverSaved('updated')
    }
    setApproverModal(null)
    setTimeout(() => setApproverSaved(''), 2500)
  }

  const filteredApprovers = typeApprovers.filter(a => {
    if (approverStatusFilter === 'active'   && a.isActive === false) return false
    if (approverStatusFilter === 'inactive' && a.isActive !== false) return false
    if (!approverSearch) return true
    const q = approverSearch.toLowerCase()
    return a.name.toLowerCase().includes(q) ||
           a.email.toLowerCase().includes(q) ||
           a.position.toLowerCase().includes(q)
  })

  // ── Departments state ────────────────────────────────────────────────────────
  const [deptInput, setDeptInput] = useState('')
  const [deptError, setDeptError] = useState('')
  const [deptSaved, setDeptSaved] = useState('')
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<BookingDepartment | null>(null)

  function handleAddDepartment() {
    const name = deptInput.trim()
    if (!name) { setDeptError('Department name is required'); return }
    if (departments.find(d => d.name.toLowerCase() === name.toLowerCase())) {
      setDeptError('This department already exists')
      return
    }
    addDepartment({ id: `dept_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, isDefault: false, createdAt: new Date().toISOString() })
    setDeptInput('')
    setDeptError('')
    setDeptSaved(name)
    setTimeout(() => setDeptSaved(''), 2500)
  }

  function togglePerm(module: string, action: string) {
    const key = perm(module, action)
    const current = rolePermissions[permRole] ?? []
    const next = current.includes(key)
      ? current.filter(p => p !== key)
      : [...current, key]
    updateRolePermissions(permRole, next)
  }

  function toggleModuleAll(module: string) {
    const modPerms = PERMISSION_MODULES.find(m => m.key === module)?.actions.map(a => perm(module, a.key)) ?? []
    const current = rolePermissions[permRole] ?? []
    const allChecked = modPerms.every(p => current.includes(p))
    const next = allChecked
      ? current.filter(p => !modPerms.includes(p))
      : [...new Set([...current, ...modPerms])]
    updateRolePermissions(permRole, next)
  }

  function handlePermSave() {
    setPermSaved(true)
    setTimeout(() => setPermSaved(false), 2000)
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    ...(can('settings', 'view_profile')        ? [{ id: 'profile'      as SettingsTab, label: 'My Profile',     icon: User       }] : []),
    ...(can('settings', 'view_users')          ? [{ id: 'users'        as SettingsTab, label: 'User Management', icon: Users      }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'team'         as SettingsTab, label: 'Team Members',    icon: Mail       }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'capacity'     as SettingsTab, label: 'Capacity',        icon: Sliders    }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'activity'     as SettingsTab, label: 'Activity Types',  icon: Settings2  }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'approvers'      as SettingsTab, label: 'Approvers',          icon: UserCheck  }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'dap-approvers' as SettingsTab, label: 'DAP Team Approvers', icon: Shield     }] : []),
    ...(can('settings', 'manage_team')         ? [{ id: 'departments'   as SettingsTab, label: 'Departments',        icon: Building2    }] : []),
    ...(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin' ? [{ id: 'booking-form'  as SettingsTab, label: 'Booking Form',       icon: FileSliders  }] : []),
    ...(can('settings', 'manage_integrations') ? [{ id: 'integrations' as SettingsTab, label: 'Integrations',    icon: Plug2        }] : []),
    ...(can('settings', 'manage_permissions')  ? [{ id: 'permissions'  as SettingsTab, label: 'Permissions',     icon: Shield       }] : []),
  ]

  function toggleRevealPassword(id: string) {
    setRevealedPasswords(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
                  ? 'bg-brand-600 text-white shadow-sm'
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
            {can('settings', 'manage_team') && !addingMember && (
              <button onClick={openAddMember} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <UserPlus size={13} /> Add Member
              </button>
            )}
          </div>

          {/* Add member form */}
          {addingMember && (
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wide">New Team Member</p>
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
                <button onClick={saveMember} disabled={!memberForm.name.trim() || !memberForm.email.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-colors">
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
                      <button onClick={saveMember} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors">
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
                        {can('settings', 'manage_team') && (
                          <button onClick={() => openEditMember(r)} className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 px-2 py-1 rounded-lg transition-colors shrink-0">
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
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-4xl shadow-md border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0">
              {isPhoto(profileEmoji)
                ? <img src={profileEmoji} alt="Profile" className="w-full h-full object-cover" />
                : profileEmoji}
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">{currentUser?.name}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">{currentUser?.role} · {currentUser?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">Profile Picture</label>

              {/* Preview + actions row */}
              <div className="flex items-center gap-4">
                {/* Avatar preview */}
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-5xl overflow-hidden shrink-0 shadow-sm">
                  {isPhoto(profileEmoji)
                    ? <img src={profileEmoji} alt="Profile" className="w-full h-full object-cover" />
                    : profileEmoji}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  {/* Upload photo */}
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white transition-colors"
                  >
                    <Camera size={13} /> {photoUploading ? 'Uploading…' : 'Upload Photo'}
                  </button>

                  {/* Emoji fallback */}
                  <button
                    type="button"
                    onClick={() => { setShowProfileEmojiPicker(v => !v) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    😊 Use Emoji Instead
                  </button>

                  {/* Remove photo */}
                  {isPhoto(profileEmoji) && (
                    <button
                      type="button"
                      onClick={() => setProfileEmoji('😊')}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={12} /> Remove Photo
                    </button>
                  )}
                </div>
              </div>

              {photoError && <p className="mt-2 text-xs text-red-500">{photoError}</p>}
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">JPG, PNG or GIF · Max 2 MB</p>

              {/* Emoji picker (shown when "Use Emoji" clicked) */}
              {showProfileEmojiPicker && (
                <div className="mt-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} type="button" onClick={() => { setProfileEmoji(e); setShowProfileEmojiPicker(false) }}
                        className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${profileEmoji === e ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-400' : ''}`}>
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
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
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
            {can('settings', 'manage_users') && (
              <button onClick={openAdd} className="btn-primary text-xs px-3 py-2">
                <UserPlus size={14} /> Add User
              </button>
            )}
          </div>

          {!can('settings', 'manage_users') && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="shrink-0" /> Read-only. Only Super Admins can add, edit, or terminate users.
            </div>
          )}

          {/* Filter stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([['all', 'All Users', 'text-slate-700 dark:text-slate-300'], ['active', 'Active', 'text-emerald-700 dark:text-emerald-400'], ['limited', 'Limited', 'text-amber-700 dark:text-amber-400'], ['terminated', 'Terminated', 'text-red-600 dark:text-red-400']] as const).map(([key, label, cls]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === key ? 'ring-2 ring-brand-400 dark:ring-brand-500' : ''}`}
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
                // Super Admin accounts can only be managed by another Super Admin
                const isProtected = u.role === 'Super Admin' && currentUser?.role !== 'Super Admin'
                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl shrink-0 border border-slate-200 dark:border-slate-600 overflow-hidden">
                      {isPhoto(u.avatar)
                        ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                        : u.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{u.name}</p>
                        {isSelf && <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 font-bold px-1.5 py-0.5 rounded-full">You</span>}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{u.email}</p>
                      {can('settings', 'manage_users') && !isProtected && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {revealedPasswords.has(u.id) ? u.password : '••••••••'}
                          </p>
                          <button type="button" onClick={() => toggleRevealPassword(u.id)} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors">
                            {revealedPasswords.has(u.id) ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg hidden sm:block ${roleBadge[u.role]}`}>{u.role}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${sm.className}`}>
                      <StatusIcon size={10} />{sm.label}
                    </span>
                    {can('settings', 'manage_users') && !isSelf && !isProtected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors">
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
                        {currentUser?.role === 'Super Admin' && (
                          <button onClick={() => setConfirm({ type: 'remove', userId: u.id, userName: u.name })} title="Remove permanently" className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                            <Trash2 size={13} />
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
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.current > 90 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'}`}>
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
                    background: t.current > 90 ? '#EF4444' : 'linear-gradient(90deg, #3C4C9C, #8B9FE8)',
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

      {/* ── APPROVERS ─────────────────────────────────────────── */}
      {activeTab === 'approvers' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Approver Management</h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                Master list · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCount} active</span>
                {inactiveCount > 0 && <span className="text-slate-400"> · {inactiveCount} inactive</span>}
                {' '}· auto-synced to the Booking App
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const header = 'id,name,position,email,is_active'
                  const rows = approvers.map(a =>
                    [a.id, `"${a.name.replace(/"/g, '""')}"`, `"${(a.position || '').replace(/"/g, '""')}"`, a.email || '', a.isActive !== false ? 'true' : 'false'].join(',')
                  )
                  const csv = [header, ...rows].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `approvers_${new Date().toISOString().split('T')[0]}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Mail size={13} /> Export CSV
              </button>
              <button onClick={openAddApprover} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors">
                <Plus size={13} /> Add Approver
              </button>
            </div>
          </div>

          {approverSaved && (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              <Check size={13} /> Approver {approverSaved} successfully.
            </div>
          )}

          {/* Search + status filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={approverSearch}
                onChange={e => setApproverSearch(e.target.value)}
                placeholder="Search by name, email, or designation…"
                className="form-input pl-9 text-sm w-full"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setApproverStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    approverStatusFilter === f
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}>
                  {f === 'all' ? `All (${approvers.length})` : f === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Approver list */}
          <div className="card overflow-hidden">
            {filteredApprovers.length === 0 ? (
              <div className="py-14 text-center">
                <UserCheck size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {approvers.length === 0 ? 'No approvers yet. Add one to get started.' : 'No approvers match your search.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {filteredApprovers.map(a => {
                  const isInactive = a.isActive === false
                  const initials = a.name.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('')
                  return (
                    <div key={a.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${isInactive ? 'bg-slate-50/60 dark:bg-slate-800/40 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${isInactive ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${isInactive ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{a.name}</p>
                          {isInactive
                            ? <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">INACTIVE</span>
                            : <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">ACTIVE</span>
                          }
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {a.email && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{a.email}</p>}
                          {a.position && (
                            <span className="text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full shrink-0">
                              {a.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditApprover(a)} title="Edit"
                          className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                        {isInactive ? (
                          <button onClick={() => reactivateApprover(a.id)} title="Reactivate"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors text-[10px] font-bold px-2">
                            Activate
                          </button>
                        ) : (
                          <button onClick={() => deactivateApprover(a.id)} title="Deactivate"
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors text-[10px] font-bold px-2">
                            Deactivate
                          </button>
                        )}
                        <button onClick={() => setApproverDeleteConfirm(a)} title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Only <strong>active</strong> approvers appear in the Booking App. Deactivate to hide without deleting.
          </p>
        </div>
      )}

      {/* ── DAP TEAM APPROVERS ────────────────────────────────── */}
      {activeTab === 'dap-approvers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">DAP Team Approvers</h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                Approvers from the DAP Team · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCount} active</span>
                {inactiveCount > 0 && <span className="text-slate-400"> · {inactiveCount} inactive</span>}
                {' '}· used in the Output Review workflow
              </p>
            </div>
            <button onClick={openAddApprover} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors">
              <Plus size={13} /> Add DAP Approver
            </button>
          </div>

          {approverSaved && (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              <Check size={13} /> Approver {approverSaved} successfully.
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={approverSearch}
                onChange={e => setApproverSearch(e.target.value)}
                placeholder="Search by name, email, or designation…"
                className="form-input pl-9 text-sm w-full"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setApproverStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    approverStatusFilter === f
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}>
                  {f === 'all' ? `All (${typeApprovers.length})` : f === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {filteredApprovers.length === 0 ? (
              <div className="py-14 text-center">
                <Shield size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {typeApprovers.length === 0 ? 'No DAP Team Approvers yet. Add one to get started.' : 'No approvers match your search.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {filteredApprovers.map(a => {
                  const isInactive = a.isActive === false
                  const initials = a.name.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('')
                  return (
                    <div key={a.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${isInactive ? 'bg-slate-50/60 dark:bg-slate-800/40 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${isInactive ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${isInactive ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{a.name}</p>
                          {isInactive
                            ? <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">INACTIVE</span>
                            : <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">ACTIVE</span>
                          }
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {a.email && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{a.email}</p>}
                          {a.position && (
                            <span className="text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full shrink-0">
                              {a.position}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditApprover(a)} title="Edit"
                          className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                        {isInactive ? (
                          <button onClick={() => reactivateApprover(a.id)} title="Reactivate"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors text-[10px] font-bold px-2">
                            Activate
                          </button>
                        ) : (
                          <button onClick={() => deactivateApprover(a.id)} title="Deactivate"
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors text-[10px] font-bold px-2">
                            Deactivate
                          </button>
                        )}
                        <button onClick={() => setApproverDeleteConfirm(a)} title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Only <strong>active</strong> DAP Team Approvers appear in the Output Review workflow.
          </p>
        </div>
      )}

      {/* ── DEPARTMENTS ───────────────────────────────────────── */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Department Management</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Manage the departments available in the booking request form. Default departments cannot be deleted.</p>
          </div>

          {/* Add new department */}
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Add Department</p>
            <div className="flex gap-2">
              <input
                value={deptInput}
                onChange={e => { setDeptInput(e.target.value); setDeptError('') }}
                placeholder="e.g. Marketing, Finance, Operations…"
                className="form-input flex-1 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddDepartment()}
              />
              <button
                onClick={handleAddDepartment}
                disabled={!deptInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
              >
                <Plus size={13} /> Add
              </button>
            </div>
            {deptError && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> {deptError}</p>}
            {deptSaved && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={12} /> "{deptSaved}" added successfully.
              </p>
            )}
          </div>

          {/* Department list */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50 dark:border-slate-700 flex items-center gap-2">
              <Building2 size={14} className="text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {departments.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${d.isDefault ? 'bg-brand-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <p className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{d.name}</p>
                  {d.isDefault ? (
                    <span className="text-[10px] font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full shrink-0">
                      Default
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeptDeleteConfirm(d)}
                      title="Remove department"
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Departments shown in blue are system defaults (BMG, MOD, MTO, CBE, Sales, HR) and cannot be removed.
          </p>
        </div>
      )}

      {/* ── BOOKING FORM ──────────────────────────────────────── */}
      {activeTab === 'booking-form' && (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && (
        <BookingFormConfigTab
          formOptions={formOptions}
          addFormOption={addFormOption}
          updateFormOption={updateFormOption}
          removeFormOption={removeFormOption}
        />
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
                          intg.connected ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-600'
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
                          className="ml-auto flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
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

      {/* ── PERMISSIONS ────────────────────────────────────────── */}
      {activeTab === 'permissions' && can('settings', 'manage_permissions') && (
        <div className="space-y-5 max-w-3xl">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Role Permissions</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              Control which modules and actions each role can access. Admin always has full access.
            </p>
          </div>

          {/* Role selector */}
          <div className="flex gap-2 flex-wrap">
            {/* Admin — always locked */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm font-semibold cursor-not-allowed select-none">
              <Shield size={14} className="text-brand-400" />
              Admin
              <span className="text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full font-bold">FULL</span>
            </div>
            {EDITABLE_ROLES.map(role => (
              <button
                key={role}
                onClick={() => setPermRole(role)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  permRole === role
                    ? 'border-brand-500 bg-brand-600 text-white shadow-sm shadow-brand-200 dark:shadow-brand-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Permission checklist for selected role */}
          <div className="space-y-3">
            {PERMISSION_MODULES.map(mod => {
              const current = rolePermissions[permRole] ?? []
              const modPerms = mod.actions.map(a => perm(mod.key, a.key))
              const checkedCount = modPerms.filter(p => current.includes(p)).length
              const allChecked = checkedCount === modPerms.length
              const someChecked = checkedCount > 0 && !allChecked

              return (
                <div key={mod.key} className="card overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
                    <span className="text-lg">{mod.icon}</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm flex-1">{mod.label}</p>
                    {/* Select-all toggle */}
                    <button
                      onClick={() => toggleModuleAll(mod.key)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        allChecked
                          ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 hover:bg-brand-200'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {allChecked ? 'Deselect All' : someChecked ? `${checkedCount}/${modPerms.length} selected` : 'Select All'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="divide-y divide-slate-50 dark:divide-slate-700/60">
                    {mod.actions.map(action => {
                      const key = perm(mod.key, action.key)
                      const checked = current.includes(key)
                      return (
                        <label
                          key={action.key}
                          className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors group"
                        >
                          {/* Custom checkbox */}
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            checked
                              ? 'bg-brand-600 border-brand-600'
                              : 'border-slate-300 dark:border-slate-600 group-hover:border-brand-400'
                          }`}>
                            {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(mod.key, action.key)}
                            className="sr-only"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${checked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                              {action.label}
                            </p>
                            {action.description && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{action.description}</p>
                            )}
                          </div>
                          {checked && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full shrink-0">
                              Allowed
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handlePermSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                permSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
              }`}
            >
              {permSaved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Permissions</>}
            </button>
            <button
              onClick={() => { resetRolePermissions(permRole); setPermSaved(false) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <RotateCcw size={13} /> Reset to Default
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
              Changes apply immediately for all active sessions.
            </p>
          </div>
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
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Profile Picture</label>
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                    {isPhoto(formEmoji)
                      ? <img src={formEmoji} alt="avatar" className="w-full h-full object-cover" />
                      : formEmoji}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {/* Upload photo */}
                    <input
                      ref={formPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleFormPhotoUpload(e, editTarget?.id ?? `new_${Date.now()}`)}
                    />
                    <button type="button" onClick={() => formPhotoInputRef.current?.click()}
                      disabled={formPhotoUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white transition-colors">
                      <Camera size={12} /> {formPhotoUploading ? 'Uploading…' : 'Upload Photo'}
                    </button>
                    {/* Emoji fallback */}
                    <button type="button" onClick={() => setShowFormEmojiPicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                      😊 Use Emoji
                    </button>
                    {isPhoto(formEmoji) && (
                      <button type="button" onClick={() => setFormEmoji('😊')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>
                </div>
                {showFormEmojiPicker && (
                  <div className="mt-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_OPTIONS.map(e => (
                        <button key={e} type="button" onClick={() => { setFormEmoji(e); setShowFormEmojiPicker(false) }}
                          className={`text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${formEmoji === e ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-400' : ''}`}>
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

      {/* Profile change confirmation modal */}
      {showProfileConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Confirm credential change</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {profileForm.email.trim().toLowerCase() !== currentUser?.email?.toLowerCase() && <span>Email will change to <strong>{profileForm.email}</strong>. </span>}
                  {profileForm.password.trim() !== '' && <span>Password will be updated. </span>}
                  You'll need to use your new credentials on your next login.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowProfileConfirm(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                Cancel
              </button>
              <button onClick={commitProfileSave} className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors">
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approver Add / Edit Modal ─────────────────────────── */}
      {approverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setApproverModal(null)} />
          <div className="modal-card w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                  {approverModal === 'add' ? 'Add Approver' : 'Edit Approver'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {approverModal === 'add' ? 'Add someone who can approve booking requests' : 'Update approver details'}
                </p>
              </div>
              <button onClick={() => setApproverModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={approverForm.name}
                    onChange={e => setApproverForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Maria Santos"
                    className="form-input pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={approverForm.email}
                  onChange={e => setApproverForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="approver@company.com"
                  className="form-input"
                />
              </div>
              {currentApproverType === 'dap' ? (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Service <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={approverForm.position}
                      onChange={e => setApproverForm(f => ({ ...f, position: e.target.value }))}
                      className="form-input appearance-none pr-8"
                    >
                      <option value="">Select the service they handle…</option>
                      {DAP_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">They'll be notified (email + in-app) when a request for this service is approved.</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Position / Title</label>
                  <input
                    type="text"
                    value={approverForm.position}
                    onChange={e => setApproverForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="e.g. AUDIT SUPERVISOR"
                    className="form-input"
                  />
                </div>
              )}
              {approverFormError && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {approverFormError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setApproverModal(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveApprover} className="flex-1 btn-primary justify-center">
                  {approverModal === 'add' ? 'Add Approver' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Approver delete confirm ────────────────────────────── */}
      {approverDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setApproverDeleteConfirm(null)} />
          <div className="modal-card w-full max-w-sm p-6 z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
              <Trash2 size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Remove Approver?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              <span className="font-semibold">{approverDeleteConfirm.name}</span> will be removed from the approver list. Existing booking requests are not affected.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setApproverDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { removeApprover(approverDeleteConfirm.id); setApproverSaved('removed'); setApproverDeleteConfirm(null); setTimeout(() => setApproverSaved(''), 2500) }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Department delete confirm ──────────────────────────── */}
      {deptDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeptDeleteConfirm(null)} />
          <div className="modal-card w-full max-w-sm p-6 z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
              <Building2 size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">Remove Department?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              <span className="font-semibold">"{deptDeleteConfirm.name}"</span> will be removed from the booking form department list.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeptDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => { removeDepartment(deptDeleteConfirm.id); setDeptDeleteConfirm(null) }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-card w-full max-w-sm p-6 z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirm.type === 'terminate' || confirm.type === 'remove' ? 'bg-red-100 dark:bg-red-900/30' : confirm.type === 'limit' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              {confirm.type === 'terminate' && <ShieldOff size={20} className="text-red-600 dark:text-red-400" />}
              {confirm.type === 'remove'    && <Trash2 size={20} className="text-red-600 dark:text-red-400" />}
              {confirm.type === 'limit'     && <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />}
              {confirm.type === 'reinstate' && <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />}
            </div>
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
              {confirm.type === 'terminate' ? 'Terminate User' : confirm.type === 'remove' ? 'Remove User Permanently' : confirm.type === 'limit' ? 'Limit Access' : 'Reinstate User'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {confirm.type === 'terminate' && `${confirm.userName} will no longer be able to log in.`}
              {confirm.type === 'remove'    && <><strong className="text-slate-700 dark:text-slate-200">{confirm.userName}</strong> will be permanently deleted from the system. This cannot be undone. Use <strong>Terminate</strong> instead if you only want to block access.</>}
              {confirm.type === 'limit'     && `${confirm.userName} will have limited system access.`}
              {confirm.type === 'reinstate' && `${confirm.userName} will be restored to active status.`}
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm ${confirm.type === 'terminate' || confirm.type === 'remove' ? 'bg-red-600 hover:bg-red-700' : confirm.type === 'limit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {confirm.type === 'remove' ? 'Delete Permanently' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

