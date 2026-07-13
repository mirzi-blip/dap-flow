import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Plus, Search, X, Paperclip, Link2, MessageSquare,
  Clock, LayoutList, ChevronRight, Send, Trash2, Pencil, Check,
  ClipboardList, Copy, CheckCircle2, Users, AlertTriangle, ChevronUp, ChevronDown, Upload,
  CheckCheck,
} from 'lucide-react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { usePermissions } from '../hooks/usePermissions'
import { ActivityBadge, StatusBadge, PriorityBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { formatDate, formatDateTime, generateId, generateJONumber, isOverdue, getNextStatus } from '../utils/helpers'
import type { ActivityType, JobOrder, JOStatus, Priority, RequestingTeam, BookingRequest, BookingRequestStatus } from '../types'
import { db } from '../db/database'
import { supabase, requestToRow, jobOrderToRow, saveJOComment } from '../lib/supabase'

type PageTab = 'list' | 'requests'

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot', 'Video Shoot', 'Static Artwork Design',
  'Video Editing', 'Audio Recording', 'Audio Editing',
]
const STATUSES: JOStatus[] = ['Pending', 'Approved', 'Scheduled', 'For Review', 'Completed', 'Delayed', 'Cancelled']
const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
const TEAMS: RequestingTeam[] = ['BMG', 'MOD', 'MTO', 'CBE']

const emptyForm = {
  requestingTeam: 'BMG' as RequestingTeam,
  projectName: '',
  campaign: '',
  activityType: 'Photo Shoot' as ActivityType,
  deliverables: '',
  priority: 'Medium' as Priority,
  deadline: '',
  launchDate: '',
  assignedMemberIds: [] as string[],
  notes: '',
}

type DetailTab = 'overview' | 'activity' | 'files' | 'comments'

interface FileRef { id: string; label: string; url: string; addedAt: string; addedBy: string; isFile?: boolean }
interface Comment { id: string; text: string; author: string; createdAt: string }

const STATUS_COLORS: Record<JOStatus, string> = {
  'Pending':     'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'Approved':    'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
  'Scheduled':   'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
  'For Review':     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Needs Revision': 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'Completed':      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Delayed':        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  'Cancelled':      'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

type SortCol = 'joNumber' | 'projectName' | 'activityType' | 'requestingTeam' | 'priority' | 'deadline' | 'status'

export function JobOrdersPage() {
  const { jobOrders, addJobOrder, updateJobOrder, statusLogs, addStatusLog, addNotification, bookingRequests, updateBookingRequest, deleteBookingRequest, addCalendarEvent } = useDataStore()
  const { currentUser, globalSearch, setGlobalSearch, resources } = useAppStore()
  const { can } = usePermissions()

  const canSeeRequests = can('job_orders', 'view_requests')

  const [pageTab, setPageTab] = useState<PageTab>('list')
  const [search, setSearch] = useState(globalSearch)
  const [filterStatus, setFilterStatus] = useState<JOStatus | 'All'>('All')
  const [filterActivity, setFilterActivity] = useState<ActivityType | 'All'>('All')
  const [filterPriority, setFilterPriority] = useState<Priority | 'All'>('All')
  const [filterTeam, setFilterTeam] = useState<RequestingTeam | 'All'>('All')
  const [showForm, setShowForm] = useState(false)
  const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  // Sorting state
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaved, setEditSaved] = useState(false)

  // Requests tab state
  const [reviewRequest, setReviewRequest] = useState<BookingRequest | null>(null)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [requestSuccess, setRequestSuccess] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<BookingRequest | null>(null)
  const [deleteNote, setDeleteNote] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Confirmation modals state
  const [confirmAction, setConfirmAction] = useState<{ type: 'schedule' | 'cancel' | 'forReview' | 'general'; jo: JobOrder; newStatus?: JOStatus } | null>(null)
  const [confirmComment, setConfirmComment] = useState('')
  const [deadlineChangeConfirm, setDeadlineChangeConfirm] = useState<string | null>(null)

  // Rejection modal state
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<BookingRequest | null>(null)

  // Per-JO local state
  const [fileRefs, setFileRefs] = useState<Record<string, FileRef[]>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newLink, setNewLink] = useState({ label: '', url: '' })
  const [linkError, setLinkError] = useState('')
  const [fileUploadError, setFileUploadError] = useState('')
  const [newComment, setNewComment] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Completion modal state
  const [completionTarget, setCompletionTarget] = useState<JobOrder | null>(null)
  const [completedByName, setCompletedByName] = useState('')
  const [completionRemarks, setCompletionRemarks] = useState('')
  const [completionFileUrl, setCompletionFileUrl] = useState<string | null>(null)
  const [completionFileName, setCompletionFileName] = useState('')
  const [completionError, setCompletionError] = useState('')
  const [completionSuccess, setCompletionSuccess] = useState('')
  const [completionLoading, setCompletionLoading] = useState(false)
  const completionFileRef = useRef<HTMLInputElement>(null)

  // Sync local search to global search store
  useEffect(() => { setSearch(globalSearch) }, [globalSearch])
  function handleSearchChange(val: string) { setSearch(val); setGlobalSearch(val) }

  const canCreate = can('job_orders', 'create')
  const canApprove = can('job_orders', 'approve')
  const canProgress = can('job_orders', 'change_status')
  const canEdit = can('job_orders', 'edit')

  const PRIORITY_ORDER: Record<Priority, number> = { 'High': 0, 'Medium': 1, 'Low': 2 }

  const filtered = useMemo(() => {
    const base = jobOrders.filter((j) => {
      if (search && !j.projectName.toLowerCase().includes(search.toLowerCase()) &&
          !j.joNumber.toLowerCase().includes(search.toLowerCase()) &&
          !j.campaign.toLowerCase().includes(search.toLowerCase())) return false
      if (filterStatus !== 'All' && j.status !== filterStatus) return false
      if (filterActivity !== 'All' && j.activityType !== filterActivity) return false
      if (filterPriority !== 'All' && j.priority !== filterPriority) return false
      if (filterTeam !== 'All' && j.requestingTeam !== filterTeam) return false
      return true
    })

    if (!sortCol) return base

    return [...base].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortCol) {
        case 'joNumber':        aVal = a.joNumber; bVal = b.joNumber; break
        case 'projectName':     aVal = a.projectName; bVal = b.projectName; break
        case 'activityType':    aVal = a.activityType; bVal = b.activityType; break
        case 'requestingTeam':  aVal = a.requestingTeam; bVal = b.requestingTeam; break
        case 'priority':        aVal = PRIORITY_ORDER[a.priority]; bVal = PRIORITY_ORDER[b.priority]; break
        case 'deadline':        aVal = a.deadline; bVal = b.deadline; break
        case 'status':          aVal = a.status; bVal = b.status; break
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [jobOrders, search, filterStatus, filterActivity, filterPriority, filterTeam, sortCol, sortDir])

  function handleSortCol(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  async function handleCreate() {
    if (!form.projectName || !form.deadline) {
      setFormError('Project name and deadline are required.')
      return
    }
    const jo: JobOrder = {
      id: generateId(),
      joNumber: generateJONumber(jobOrders.length),
      ...form,
      requesterId: currentUser!.id,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser!.id,
    }
    await db.jobOrders.add(jo)
    addJobOrder(jo)
    supabase.from('job_orders').insert(jobOrderToRow(jo)).then(({ error }) => { if (error) console.error('JO sync error:', error) })

    const adminNotif = {
      id: generateId(),
      type: 'approval_notification' as const,
      title: 'New Job Order Submitted',
      message: `${jo.joNumber} – "${jo.projectName}" submitted by ${currentUser?.name}. Awaiting approval.`,
      read: false,
      createdAt: new Date().toISOString(),
      targetUserId: 'u1',
      joId: jo.id,
    }
    await db.notifications.add(adminNotif)
    addNotification(adminNotif)

    setShowForm(false)
    setForm(emptyForm)
    setFormError('')
  }

  async function handleStatusChange(jo: JobOrder, newStatus: JOStatus, comment = '') {
    const updated: JobOrder = { ...jo, status: newStatus, updatedAt: new Date().toISOString() }
    await db.jobOrders.put(updated)
    updateJobOrder(updated)
    supabase.from('job_orders').update({ status: newStatus, updated_at: updated.updatedAt }).eq('id', jo.id).then(({ error }) => { if (error) console.error('JO sync error:', error) })

    const now = new Date().toISOString()
    const log = {
      id: generateId(),
      joId: jo.id,
      joNumber: jo.joNumber,
      fromStatus: jo.status,
      toStatus: newStatus,
      changedBy: currentUser?.name ?? 'Unknown',
      changedAt: now,
      notes: comment,
    }
    await db.statusLogs.add(log)
    addStatusLog(log)

    if (comment) {
      saveJOComment({
        joId: jo.id,
        authorName: currentUser?.name ?? 'Unknown',
        authorEmail: currentUser?.email ?? '',
        body: comment,
        fromStatus: jo.status,
        toStatus: newStatus,
      }).catch(console.error)
    }

    const notif = {
      id: generateId(),
      type: 'status_changed' as const,
      title: 'JO Status Updated',
      message: `${jo.joNumber} moved from "${jo.status}" to "${newStatus}"`,
      read: false,
      createdAt: new Date().toISOString(),
      targetUserId: jo.requesterId,
      joId: jo.id,
    }
    await db.notifications.add(notif)
    addNotification(notif)

    if (selectedJO?.id === jo.id) setSelectedJO(updated)

    // Auto-create calendar event when scheduled
    if (newStatus === 'Scheduled') {
      const ev = {
        id: generateId(),
        joId: jo.id,
        title: jo.projectName,
        activityType: jo.activityType,
        startDate: jo.launchDate || jo.deadline,
        endDate: jo.deadline,
        assignedMemberIds: jo.assignedMemberIds,
        location: '',
        notes: jo.notes ?? '',
        createdAt: new Date().toISOString(),
      }
      await db.calendarEvents.add(ev)
      addCalendarEvent(ev)
    }

    // Notify ALL assigned members of the status change
    const memberMode = newStatus === 'Scheduled' ? 'scheduled' : 'status_update'
    for (const memberId of jo.assignedMemberIds) {
      const member = resources.find(r => r.id === memberId)
      if (member?.email) {
        fetch('https://dap-flow-tau.vercel.app/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberNotification: true,
            mode: memberMode,
            memberEmail: member.email,
            memberName: member.name,
            joNumber: updated.joNumber,
            projectName: updated.projectName,
            activityType: updated.activityType,
            priority: updated.priority,
            deadline: updated.deadline,
            status: newStatus,
          }),
        }).catch(console.error)
      }
    }

    // Notify the requestor via joNotification for every status change
    const relatedReq = bookingRequests.find(r => r.joId === jo.id)
    if (relatedReq?.requestorEmail) {
      fetch('https://dap-flow-tau.vercel.app/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joNotification: true,
          requestorEmail: relatedReq.requestorEmail,
          preparedBy: relatedReq.preparedBy,
          joNumber: updated.joNumber,
          projectName: updated.projectName,
          activityType: updated.activityType,
          priority: updated.priority,
          deadline: updated.deadline,
          status: newStatus,
          refId: relatedReq.id.slice(0, 8).toUpperCase(),
        }),
      }).catch(console.error)
    }
  }

  // Intercept status changes — all require a comment
  function handleStatusChangeWithConfirm(jo: JobOrder, newStatus: JOStatus) {
    setConfirmComment('')
    if (newStatus === 'Scheduled') {
      setConfirmAction({ type: 'schedule', jo })
    } else if (newStatus === 'Cancelled') {
      setConfirmAction({ type: 'cancel', jo })
    } else if (newStatus === 'For Review') {
      setConfirmAction({ type: 'forReview', jo })
    } else {
      setConfirmAction({ type: 'general', jo, newStatus })
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || !confirmComment.trim()) return
    const { type, jo } = confirmAction
    const comment = confirmComment.trim()
    setConfirmAction(null)
    setConfirmComment('')
    if (type === 'schedule') await handleStatusChange(jo, 'Scheduled', comment)
    else if (type === 'cancel') await handleStatusChange(jo, 'Cancelled', comment)
    else if (type === 'forReview') await handleStatusChange(jo, 'For Review', comment)
    else if (type === 'general' && confirmAction.newStatus) await handleStatusChange(jo, confirmAction.newStatus, comment)
  }

  function openCompletionModal(jo: JobOrder) {
    setCompletionTarget(jo)
    setCompletedByName(currentUser?.name ?? '')
    setCompletionRemarks('')
    setCompletionFileUrl(null)
    setCompletionFileName('')
    setCompletionError('')
    setCompletionSuccess('')
  }

  function handleCompletionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setCompletionError('File too large. Maximum 5 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCompletionFileUrl(reader.result as string)
      setCompletionFileName(file.name)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleMarkComplete() {
    if (!completionTarget) return

    // ── Validation ──────────────────────────────────────────────────────────
    if (!completedByName.trim()) {
      setCompletionError('Completed By is required.')
      return
    }
    if (!completionRemarks.trim()) {
      setCompletionError('Completion Remarks are required.')
      return
    }

    setCompletionLoading(true)
    setCompletionError('')

    const now = new Date().toISOString()
    const updated: JobOrder = {
      ...completionTarget,
      status: 'Completed',
      updatedAt: now,
      completedAt: now,
      completedBy: completedByName.trim(),
      completionRemarks: completionRemarks.trim(),
      ...(completionFileUrl ? { completionFileUrl } : {}),
    }

    try {
      // ── 1. Persist locally ──────────────────────────────────────────────
      await db.jobOrders.put(updated)
      updateJobOrder(updated)

      // ── 2. Sync to Supabase — await so we confirm success before emailing ──
      const { error: syncError } = await supabase.from('job_orders').update({
        status: 'Completed',
        updated_at: now,
        completed_at: now,
        completed_by: updated.completedBy,
        completion_remarks: updated.completionRemarks,
        completion_file_url: updated.completionFileUrl ?? null,
      }).eq('id', updated.id)

      if (syncError) console.error('JO sync error:', syncError)

      // ── 3. Status log ───────────────────────────────────────────────────
      const log = {
        id: generateId(),
        joId: updated.id,
        joNumber: updated.joNumber,
        fromStatus: completionTarget.status,
        toStatus: 'Completed' as JOStatus,
        changedBy: updated.completedBy ?? completedByName.trim(),
        changedAt: now,
        notes: updated.completionRemarks ?? '',
      }
      await db.statusLogs.add(log)
      addStatusLog(log)

      // ── 4. In-app notification ──────────────────────────────────────────
      const notif = {
        id: generateId(),
        type: 'status_changed' as const,
        title: 'JO Completed',
        message: `${updated.joNumber} has been marked as Completed by ${updated.completedBy}`,
        read: false,
        createdAt: now,
        targetUserId: updated.requesterId,
        joId: updated.id,
      }
      await db.notifications.add(notif)
      addNotification(notif)

      // Sync detail panel
      if (selectedJO?.id === updated.id) setSelectedJO(updated)

      // ── 5. Send completion email — only after DB confirmed ──────────────
      //    Find the linked booking request for the requestor's email
      const relatedReq = bookingRequests.find(r => r.joId === completionTarget.id)
      let emailSent = false

      if (relatedReq?.requestorEmail) {
        try {
          const emailRes = await fetch('https://dap-flow-tau.vercel.app/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              completionNotification: true,
              requestorEmail: relatedReq.requestorEmail,
              preparedBy: relatedReq.preparedBy,
              joNumber: updated.joNumber,
              projectName: updated.projectName,
              activityType: updated.activityType,
              priority: updated.priority,
              deadline: updated.deadline,
              completedBy: updated.completedBy,
              completedAt: now,
              remarks: updated.completionRemarks,
              refId: relatedReq.id.slice(0, 8).toUpperCase(),
            }),
          })
          emailSent = emailRes.ok
          if (!emailRes.ok) {
            const errBody = await emailRes.json().catch(() => ({}))
            console.error('Completion email failed:', errBody)
          }
        } catch (emailErr) {
          // Email failure must not roll back the completion — log and continue
          console.error('Completion email error:', emailErr)
        }
      }

      // ── 6. Show success state in modal, auto-close after 2.5 s ─────────
      const emailNote = relatedReq?.requestorEmail
        ? (emailSent ? ' · Notification sent to requestor.' : ' · Email could not be sent — please notify manually.')
        : ''
      setCompletionSuccess(`${updated.joNumber} marked as Completed.${emailNote}`)

      setTimeout(() => {
        setCompletionTarget(null)
        setCompletionSuccess('')
      }, 2500)

    } catch (err) {
      console.error('Mark complete error:', err)
      setCompletionError('Something went wrong. Please try again.')
    } finally {
      setCompletionLoading(false)
    }
  }

  async function handleEditSave() {
    if (!selectedJO || !editForm.projectName || !editForm.deadline) return
    const updated: JobOrder = {
      ...selectedJO,
      ...editForm,
      updatedAt: new Date().toISOString(),
    }
    await db.jobOrders.put(updated)
    updateJobOrder(updated)
    supabase.from('job_orders').update(jobOrderToRow(updated)).eq('id', updated.id).then(({ error }) => { if (error) console.error('JO sync error:', error) })
    setSelectedJO(updated)
    setEditMode(false)
    setEditSaved(true)
    setTimeout(() => setEditSaved(false), 2000)

    // Detect member changes and send targeted emails
    const oldIds = new Set(selectedJO.assignedMemberIds)
    const newIds = new Set(editForm.assignedMemberIds)
    const added   = editForm.assignedMemberIds.filter(id => !oldIds.has(id))
    const removed = selectedJO.assignedMemberIds.filter(id => !newIds.has(id))

    const EMAIL_BASE = 'https://dap-flow-tau.vercel.app/api/send-email'
    const joPayload = {
      joNumber: updated.joNumber,
      projectName: updated.projectName,
      activityType: updated.activityType,
      priority: updated.priority,
      deadline: updated.deadline,
      status: updated.status,
    }

    for (const memberId of added) {
      const member = resources.find(r => r.id === memberId)
      if (member?.email) {
        fetch(EMAIL_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberNotification: true, mode: 'assigned', memberEmail: member.email, memberName: member.name, ...joPayload }),
        }).catch(console.error)
      }
    }

    for (const memberId of removed) {
      const member = resources.find(r => r.id === memberId)
      if (member?.email) {
        fetch(EMAIL_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberNotification: true, mode: 'removed', memberEmail: member.email, memberName: member.name, ...joPayload }),
        }).catch(console.error)
      }
    }

    // Notify continuing members if key details changed
    const detailsChanged =
      selectedJO.deadline !== editForm.deadline ||
      selectedJO.priority !== editForm.priority ||
      selectedJO.projectName !== editForm.projectName ||
      selectedJO.deliverables !== editForm.deliverables ||
      selectedJO.notes !== editForm.notes

    if (detailsChanged) {
      const continuingIds = editForm.assignedMemberIds.filter(id => oldIds.has(id))
      for (const memberId of continuingIds) {
        const member = resources.find(r => r.id === memberId)
        if (member?.email) {
          fetch(EMAIL_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberNotification: true, mode: 'status_update', memberEmail: member.email, memberName: member.name, ...joPayload }),
          }).catch(console.error)
        }
      }
    }

    // If the assignment or any key field changed, notify the requestor
    const keyChanged =
      added.length > 0 ||
      removed.length > 0 ||
      detailsChanged

    if (keyChanged) {
      const relatedReq = bookingRequests.find(r => r.joId === selectedJO.id)
      if (relatedReq?.requestorEmail) {
        fetch(EMAIL_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joNotification: true,
            requestorEmail: relatedReq.requestorEmail,
            preparedBy: relatedReq.preparedBy,
            refId: relatedReq.id.slice(0, 8).toUpperCase(),
            ...joPayload,
          }),
        }).catch(console.error)
      }
    }
  }

  function openDetail(jo: JobOrder) {
    setSelectedJO(jo)
    setDetailTab('overview')
    setEditMode(false)
    setEditForm({
      requestingTeam: jo.requestingTeam,
      projectName: jo.projectName,
      campaign: jo.campaign,
      activityType: jo.activityType,
      deliverables: jo.deliverables,
      priority: jo.priority,
      deadline: jo.deadline,
      launchDate: jo.launchDate ?? '',
      assignedMemberIds: [...jo.assignedMemberIds],
      notes: jo.notes ?? '',
    })
    setNewLink({ label: '', url: '' })
    setNewComment('')
    setLinkError('')
  }

  function addFileRef() {
    if (!newLink.url.trim()) { setLinkError('URL is required'); return }
    const ref: FileRef = {
      id: generateId(),
      label: newLink.label.trim() || newLink.url,
      url: newLink.url.trim(),
      addedAt: new Date().toISOString(),
      addedBy: currentUser?.name ?? 'Unknown',
    }
    setFileRefs(prev => ({ ...prev, [selectedJO!.id]: [...(prev[selectedJO!.id] ?? []), ref] }))
    setNewLink({ label: '', url: '' })
    setLinkError('')
  }

  function removeFileRef(joId: string, refId: string) {
    setFileRefs(prev => ({ ...prev, [joId]: (prev[joId] ?? []).filter(r => r.id !== refId) }))
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setFileUploadError('')
    const file = e.target.files?.[0]
    if (!file || !selectedJO) return
    if (file.size > 2 * 1024 * 1024) {
      setFileUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 2 MB.`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const ref: FileRef = {
        id: generateId(),
        label: file.name,
        url: reader.result as string,
        addedAt: new Date().toISOString(),
        addedBy: currentUser?.name ?? 'Unknown',
        isFile: true,
      }
      setFileRefs(prev => ({ ...prev, [selectedJO.id]: [...(prev[selectedJO.id] ?? []), ref] }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function addComment() {
    if (!newComment.trim() || !selectedJO) return
    const c: Comment = {
      id: generateId(),
      text: newComment.trim(),
      author: currentUser?.name ?? 'Unknown',
      createdAt: new Date().toISOString(),
    }
    setComments(prev => ({ ...prev, [selectedJO.id]: [...(prev[selectedJO.id] ?? []), c] }))
    setNewComment('')
  }

  const joLogs = selectedJO ? statusLogs.filter((l) => l.joId === selectedJO.id) : []
  const joFiles = selectedJO ? (fileRefs[selectedJO.id] ?? []) : []
  const joComments = selectedJO ? (comments[selectedJO.id] ?? []) : []

  // Requests tab helpers
  const pendingApprovalForUser = bookingRequests.filter(r =>
    r.status === 'Pending Approval' &&
    (canApprove || r.approverEmail?.toLowerCase() === currentUser?.email?.toLowerCase())
  )
  const pendingReviewRequests = bookingRequests.filter(r =>
    r.status === 'Pending Review'
  )
  const pendingCount = pendingApprovalForUser.length + bookingRequests.filter(r => r.status === 'Pending Review').length

  function openReview(req: BookingRequest) {
    setReviewRequest(req)
    setSelectedMemberIds(req.assignedMemberIds ?? [])
    setRequestSuccess('')
  }

  function toggleMember(id: string) {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function getConflicts(memberIds: string[], neededDate: string): string[] {
    return memberIds.filter(id =>
      jobOrders.some(jo =>
        jo.assignedMemberIds.includes(id) &&
        !['Completed', 'Cancelled'].includes(jo.status) &&
        jo.deadline === neededDate
      )
    )
  }

  // Count active JOs assigned to a member (for utilization bar)
  function memberActiveJOs(memberId: string): number {
    return jobOrders.filter(
      jo => jo.assignedMemberIds.includes(memberId) &&
        jo.status !== 'Completed' && jo.status !== 'Cancelled'
    ).length
  }

  async function handleDeleteRequest() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await supabase.from('booking_requests').delete().eq('id', deleteTarget.id)
    deleteBookingRequest(deleteTarget.id)
    setDeleteTarget(null)
    setDeleteNote('')
    setDeleteLoading(false)
  }

  function openRejectModal(req: BookingRequest) {
    setRejectTarget(req)
    setRejectReason('')
  }

  async function handleRejectRequest(req: BookingRequest) {
    const updated: BookingRequest = { ...req, status: 'Rejected' }
    await supabase.from('booking_requests').update({ status: 'Rejected' }).eq('id', updated.id)
    updateBookingRequest(updated)
    setReviewRequest(null)
    setRejectTarget(null)
    setRejectReason('')
  }

  async function handleApproveRequest(req: BookingRequest) {
    const updated: BookingRequest = { ...req, status: 'Pending Review' }
    await supabase.from('booking_requests').update({ status: 'Pending Review' }).eq('id', req.id)
    updateBookingRequest(updated)
  }

  async function handleConvertToJO(req: BookingRequest) {
    const newJO: JobOrder = {
      id: generateId(),
      joNumber: generateJONumber(jobOrders.length),
      requestingTeam: (req.department as RequestingTeam) ?? 'BMG',
      requesterId: 'admin',
      projectName: req.projectName || `${req.activityType} — ${req.department}`,
      campaign: '',
      activityType: req.activityType,
      deliverables: req.notes || '',
      priority: 'Medium',
      deadline: req.neededDate,
      launchDate: req.neededDate,
      assignedMemberIds: selectedMemberIds,
      status: 'Pending',
      notes: `Source Request: REF#${req.id.slice(0, 8).toUpperCase()} — submitted by ${req.preparedBy} (${req.requestorEmail}). Venue: ${req.venue}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'Admin',
    }
    await db.jobOrders.put(newJO)
    addJobOrder(newJO)
    supabase.from('job_orders').insert(jobOrderToRow(newJO)).then(({ error }) => { if (error) console.error('JO sync error:', error) })

    const updatedReq: BookingRequest = { ...req, status: 'Assigned', joId: newJO.id, assignedMemberIds: selectedMemberIds }
    await supabase.from('booking_requests').update({ status: 'Assigned', jo_id: newJO.id, assigned_member_ids: selectedMemberIds }).eq('id', req.id)
    updateBookingRequest(updatedReq)

    // Notify each assigned member by email
    for (const memberId of selectedMemberIds) {
      const member = resources.find(r => r.id === memberId)
      if (member?.email) {
        fetch('https://dap-flow-tau.vercel.app/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberNotification: true,
            mode: 'assigned',
            memberEmail: member.email,
            memberName: member.name,
            joNumber: newJO.joNumber,
            projectName: newJO.projectName,
            activityType: newJO.activityType,
            priority: newJO.priority,
            deadline: newJO.deadline,
          }),
        }).catch(console.error)
      }
    }

    setRequestSuccess(`Job Order ${newJO.joNumber} created successfully!`)
    setTimeout(() => {
      setReviewRequest(null)
      setRequestSuccess('')
    }, 2000)
  }

  const BOOKING_URL = 'https://dap-flow-tau.vercel.app/request'

  function handleCopyLink() {
    navigator.clipboard.writeText(BOOKING_URL)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Sort icon helper
  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronUp size={11} className="opacity-20 inline ml-0.5" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="inline ml-0.5 text-brand-500" />
      : <ChevronDown size={11} className="inline ml-0.5 text-brand-500" />
  }

  const sortableHeaders: { label: string; col: SortCol | null }[] = [
    { label: 'JO #', col: 'joNumber' },
    { label: 'Project / Campaign', col: 'projectName' },
    { label: 'Activity', col: 'activityType' },
    { label: 'Team', col: 'requestingTeam' },
    { label: 'Priority', col: 'priority' },
    { label: 'Deadline', col: 'deadline' },
    { label: 'Assigned', col: null },
    { label: 'Status', col: 'status' },
    { label: 'Actions', col: null },
  ]

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Page tab bar */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setPageTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
            pageTab === 'list'
              ? 'border-brand-600 text-brand-700 dark:text-brand-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <LayoutList size={15} />
          Job Orders
        </button>
        {(canSeeRequests || pendingApprovalForUser.length > 0) && (
          <button
            onClick={() => setPageTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
              pageTab === 'requests'
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <ClipboardList size={15} />
            Requests
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Requests Tab Panel ─────────────────────────────────── */}
      {pageTab === 'requests' && (
        <div className="space-y-5">
          {/* Public Booking Link card — Admin/DAP only */}
          {canSeeRequests && (
            <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl px-5 py-4">
              <ClipboardList size={18} className="text-brand-500 dark:text-brand-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wide mb-0.5">
                  Public Booking Link
                </p>
                <p className="text-sm font-mono text-brand-600 dark:text-brand-400 truncate">
                  {BOOKING_URL}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  linkCopied
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/60'
                }`}
              >
                {linkCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          )}

          {/* Summary bar — Admin/DAP only */}
          {canSeeRequests && (
            <div className="grid grid-cols-2 gap-3">
              {([
                ['Pending Approval', bookingRequests.filter(r => r.status === 'Pending Approval').length, 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'],
                ['Pending Review', bookingRequests.filter(r => r.status === 'Pending Review').length, 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'],
              ] as [string, number, string][]).map(([label, count, cls]) => (
                <div key={label} className={`rounded-2xl px-4 py-3 ${cls}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
                  <p className="text-2xl font-black">{count}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Section 1: Pending Your Approval ── */}
          {pendingApprovalForUser.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black">{pendingApprovalForUser.length}</span>
                Pending Your Approval
              </h3>
              {pendingApprovalForUser.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  canSeeRequests={canSeeRequests}
                  onReview={() => openReview(req)}
                  onDelete={() => { setDeleteTarget(req); setDeleteNote('') }}
                />
              ))}
            </div>
          )}

          {/* ── Section 2: Pending Review (Admin/DAP only) ── */}
          {canSeeRequests && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Pending Review
              </h3>
              {pendingReviewRequests.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 py-12 text-center">
                  <ClipboardList size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No requests pending review.</p>
                </div>
              ) : (
                pendingReviewRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    canSeeRequests={canSeeRequests}
                    onReview={() => openReview(req)}
                    onDelete={() => { setDeleteTarget(req); setDeleteNote('') }}
                  />
                ))
              )}
            </div>
          )}

          {/* Show empty state if no sections visible */}
          {pendingApprovalForUser.length === 0 && !canSeeRequests && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 py-16 text-center">
              <ClipboardList size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No requests require your approval.</p>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Remove Request?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      This will permanently delete request <span className="font-mono font-semibold">#{deleteTarget.id.slice(0, 8).toUpperCase()}</span> from <span className="font-semibold">{deleteTarget.preparedBy}</span>. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Reason / Note <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    placeholder="e.g. Duplicate request, submitted in error…"
                    value={deleteNote}
                    onChange={e => setDeleteNote(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteRequest}
                    disabled={deleteLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {deleteLoading ? 'Removing…' : 'Yes, Remove'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reject Reason Modal */}
          {rejectTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <X size={18} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reject Request</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Please provide a reason for rejecting this request.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    placeholder="e.g. Incomplete information, outside scope, already handled…"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setRejectTarget(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { if (rejectReason.trim()) handleRejectRequest(rejectTarget) }}
                    disabled={!rejectReason.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review Modal */}
          <Modal
            open={!!reviewRequest}
            onClose={() => { setReviewRequest(null); setRequestSuccess('') }}
            title={reviewRequest ? `Review Request · #${reviewRequest.id.slice(0, 8).toUpperCase()}` : ''}
            maxWidth="max-w-3xl"
          >
            {reviewRequest && (
              <div className="space-y-6">
                {/* Success toast */}
                {requestSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                    <CheckCircle2 size={16} /> {requestSuccess}
                  </div>
                )}

                {/* Request details (read-only) */}
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Request Details</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <InfoBox label="Service Type" value={reviewRequest.activityType} />
                    <InfoBox label="Status" value={reviewRequest.status} />
                    <InfoBox label="Department" value={reviewRequest.department || '—'} />
                    <InfoBox label="Department Local" value={reviewRequest.departmentLocal || '—'} />
                    <InfoBox label="Prepared By" value={reviewRequest.preparedBy} />
                    <InfoBox label="Requestor Email" value={reviewRequest.requestorEmail} />
                    {reviewRequest.projectName && <div className="col-span-2"><InfoBox label="Project Name" value={reviewRequest.projectName} /></div>}
                    <InfoBox label="Date Encoded" value={formatDate(reviewRequest.encodedAt)} />
                    <InfoBox label="Date Needed" value={`${formatDate(reviewRequest.neededDate)}${(reviewRequest as any).endDate ? ` – ${formatDate((reviewRequest as any).endDate)}` : ''}`} />
                    {(reviewRequest.startTime || reviewRequest.endTime) && (
                      <InfoBox label="Time" value={`${reviewRequest.startTime || '?'} – ${reviewRequest.endTime || '?'}`} />
                    )}
                    {(reviewRequest as any).approverName && (
                      <div className="col-span-2">
                        <InfoBox label="Approver" value={`${(reviewRequest as any).approverName} (${(reviewRequest as any).approverEmail})`} />
                      </div>
                    )}
                    <div className="col-span-2">
                      <InfoBox label="Venue / Location" value={reviewRequest.venue || '—'} />
                    </div>
                    {reviewRequest.designSpecs?.platform && (
                      <div className="col-span-2">
                        <InfoBox label="Platform" value={reviewRequest.designSpecs.platform} />
                      </div>
                    )}
                    {reviewRequest.designSpecs?.shootTypeDetail && (
                      <div className="col-span-2">
                        <InfoBox label="Type of Shoot" value={reviewRequest.designSpecs.shootTypeDetail} />
                      </div>
                    )}
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-0.5">Additional Notes</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{reviewRequest.notes || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Assign Team Members */}
                {(reviewRequest.status === 'Pending Review' || reviewRequest.status === 'Assigned') && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                      Assign Team Members
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                      {resources.map((r) => {
                        const activeJOs = memberActiveJOs(r.id)
                        const utilPct = Math.min(Math.round((activeJOs / 5) * 100), 100)
                        const overloaded = utilPct > 90
                        const selected = selectedMemberIds.includes(r.id)
                        return (
                          <label
                            key={r.id}
                            className={`flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl transition-colors border ${
                              selected
                                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700'
                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleMember(r.id)}
                              className="mt-0.5 accent-brand-600"
                            />
                            <span className={`w-8 h-8 rounded-full ${r.color} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                              {r.initials}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                                {overloaded && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 shrink-0">
                                    <AlertTriangle size={10} /> Overloaded
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.role} · {r.team}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      overloaded ? 'bg-red-500' : utilPct > 60 ? 'bg-amber-400' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${utilPct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{activeJOs} active JOs</span>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Conflict detection warning */}
                {reviewRequest.status === 'Pending Review' && selectedMemberIds.length > 0 && (() => {
                  const conflicts = getConflicts(selectedMemberIds, reviewRequest.neededDate)
                  if (conflicts.length === 0) return null
                  const names = conflicts.map(id => resources.find(r => r.id === id)?.name ?? id).join(', ')
                  return (
                    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                      <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Double-Booking Conflict Detected</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          {names} already assigned to another active JO on this date ({reviewRequest.neededDate}). Consider reassigning.
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Actions */}
                {reviewRequest.status === 'Pending Review' && !requestSuccess && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <Button
                      variant="danger"
                      onClick={() => { setReviewRequest(null); openRejectModal(reviewRequest) }}
                    >
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleConvertToJO(reviewRequest)}
                    >
                      <CheckCircle2 size={14} /> Convert to JO &amp; Assign
                    </Button>
                  </div>
                )}

                {reviewRequest.status !== 'Pending Review' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                      This request has been <span className="font-semibold">{reviewRequest.status.toLowerCase()}</span>.
                      {reviewRequest.joId && (
                        <span> Associated JO has been created.</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ── Job Orders List (existing) ─────────────────────────── */}
      {pageTab === 'list' && (
        <>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            placeholder="Search JOs, projects, campaigns…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {search && (
            <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>

        {([
          [filterStatus, setFilterStatus, ['All', ...STATUSES], 'All Statuses'],
          [filterActivity, setFilterActivity, ['All', ...ACTIVITY_TYPES], 'All Activities'],
          [filterPriority, setFilterPriority, ['All', ...PRIORITIES], 'All Priorities'],
          [filterTeam, setFilterTeam, ['All', ...TEAMS], 'All Teams'],
        ] as const).map(([val, setter, options, placeholder], i) => (
          <select
            key={i}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={val as string}
            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
          >
            <option value="All">{placeholder}</option>
            {(options as readonly string[]).filter(o => o !== 'All').map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}

        {canCreate && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={15} /> New JO
          </Button>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{filtered.length}</span> of {jobOrders.length} job orders
        {search && <span className="ml-1 text-brand-600 dark:text-brand-400">· filtered by "{search}"</span>}
      </p>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
              <tr>
                {sortableHeaders.map(({ label, col }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap ${col ? 'cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300 transition-colors' : ''}`}
                    onClick={col ? () => handleSortCol(col) : undefined}
                  >
                    {label}
                    {col && <SortIcon col={col} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    No job orders found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((jo) => {
                  const overdue = isOverdue(jo.deadline) && jo.status !== 'Completed' && jo.status !== 'Cancelled'
                  const next = getNextStatus(jo.status)
                  const isAssignedMember = currentUser?.resourceId ? jo.assignedMemberIds.includes(currentUser.resourceId) : false
                  return (
                    <tr
                      key={jo.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
                      onClick={() => openDetail(jo)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-brand-600 dark:text-brand-400 font-medium block">
                          {jo.joNumber}
                        </span>
                        {(() => {
                          const srcReq = bookingRequests.find(r => r.joId === jo.id)
                          return srcReq ? (
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                              REF#{srcReq.id.slice(0, 8).toUpperCase()}
                            </span>
                          ) : null
                        })()}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{jo.projectName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{jo.campaign}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><ActivityBadge type={jo.activityType} /></td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                          {jo.requestingTeam}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><PriorityBadge priority={jo.priority} /></td>
                      <td className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {overdue && '⚠ '}{formatDate(jo.deadline)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1">
                          {jo.assignedMemberIds.slice(0, 3).map((id) => {
                            const r = resources.find((r) => r.id === id)
                            return r ? (
                              <span key={id} title={r.name}
                                className={`w-6 h-6 rounded-full ${r.color} border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-[9px] font-bold`}>
                                {r.initials}
                              </span>
                            ) : null
                          })}
                          {jo.assignedMemberIds.length > 3 && (
                            <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                              +{jo.assignedMemberIds.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={jo.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Mark Complete — only for authorized users when status is For Review */}
                          {jo.status === 'For Review' && canProgress && (isAssignedMember || canApprove) && (
                            <Button size="sm" onClick={() => openCompletionModal(jo)} className="text-xs bg-emerald-600 hover:bg-emerald-700">
                              <CheckCheck size={11} /> Complete
                            </Button>
                          )}
                          {/* Regular advance button (skip For Review → Completed: handled by completion modal) */}
                          {canProgress && next && jo.status !== 'Delayed' && jo.status !== 'Cancelled' &&
                            !(jo.status === 'For Review' && next === 'Completed') && (
                            <Button size="sm" variant="secondary" onClick={() => handleStatusChangeWithConfirm(jo, next)} className="text-xs">
                              → {next}
                            </Button>
                          )}
                          {canApprove && jo.status !== 'Completed' && jo.status !== 'Cancelled' && (
                            <Button size="sm" variant="danger" onClick={() => handleStatusChangeWithConfirm(jo, 'Cancelled')} className="text-xs">Cancel</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Confirmation Modals ─────────────────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setConfirmAction(null); setConfirmComment('') }} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmAction.type === 'cancel'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-brand-100 dark:bg-brand-900/30'
              }`}>
                {confirmAction.type === 'cancel'
                  ? <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  : <CheckCircle2 size={18} className="text-brand-600 dark:text-brand-400" />
                }
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {confirmAction.type === 'schedule' && 'Schedule Job Order?'}
                  {confirmAction.type === 'cancel' && 'Cancel Job Order?'}
                  {confirmAction.type === 'forReview' && 'Move to For Review?'}
                  {confirmAction.type === 'general' && `Move to ${confirmAction.newStatus}?`}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {confirmAction.type === 'schedule' && `Scheduling ${confirmAction.jo.joNumber}.`}
                  {confirmAction.type === 'cancel' && `Cancelling ${confirmAction.jo.joNumber}. This cannot be undone.`}
                  {confirmAction.type === 'forReview' && `Moving ${confirmAction.jo.joNumber} to For Review.`}
                  {confirmAction.type === 'general' && `Moving ${confirmAction.jo.joNumber} to ${confirmAction.newStatus}.`}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Comment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={confirmComment}
                onChange={e => setConfirmComment(e.target.value)}
                placeholder="Add a note about this status change…"
                rows={3}
                autoFocus
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none placeholder-slate-400"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setConfirmAction(null); setConfirmComment('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={!confirmComment.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmAction.type === 'cancel'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {confirmAction.type === 'schedule' && 'Yes, Schedule'}
                {confirmAction.type === 'cancel' && 'Yes, Cancel'}
                {confirmAction.type === 'forReview' && 'Yes, Proceed'}
                {confirmAction.type === 'general' && 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deadline Change Confirmation */}
      {deadlineChangeConfirm !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeadlineChangeConfirm(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Change Deadline?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Please confirm alignment with the <strong>requestor</strong> before changing the deadline. Have you checked with them that the new date works?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeadlineChangeConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deadlineChangeConfirm !== null) {
                    setEditForm(prev => ({ ...prev, deadline: deadlineChangeConfirm }))
                  }
                  setDeadlineChangeConfirm(null)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                Yes, Change Deadline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── JO Detail Modal ─────────────────────────────────────── */}
      <Modal
        open={!!selectedJO}
        onClose={() => { setSelectedJO(null); setEditMode(false) }}
        title={selectedJO ? `${selectedJO.joNumber} · ${selectedJO.projectName}` : ''}
        maxWidth="max-w-3xl"
      >
        {selectedJO && (
          <div className="space-y-4">
            {/* Badges + edit toggle */}
            <div className="flex flex-wrap gap-2 items-center">
              <ActivityBadge type={selectedJO.activityType} />
              <StatusBadge status={selectedJO.status} />
              <PriorityBadge priority={selectedJO.priority} />
              {isOverdue(selectedJO.deadline) && selectedJO.status !== 'Completed' && selectedJO.status !== 'Cancelled' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  ⚠ Overdue
                </span>
              )}
              {editSaved && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  <Check size={11} /> Saved
                </span>
              )}
              {canEdit && !editMode && selectedJO.status !== 'Completed' && selectedJO.status !== 'Cancelled' && (
                <button
                  onClick={() => { setEditMode(true); setDetailTab('overview') }}
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 px-3 py-1.5 rounded-xl transition-colors border border-brand-200 dark:border-brand-800"
                >
                  <Pencil size={12} /> Edit JO
                </button>
              )}
              {editMode && (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setEditMode(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleEditSave} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-xl transition-colors">
                    <Check size={12} /> Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Inner tabs */}
            <div className="flex gap-1 border-b border-slate-100 dark:border-slate-700">
              {([
                ['overview', 'Overview', LayoutList],
                ['activity', `Activity Log${joLogs.length ? ` (${joLogs.length})` : ''}`, Clock],
                ['files', `Files${joFiles.length ? ` (${joFiles.length})` : ''}`, Paperclip],
                ['comments', `Comments${joComments.length ? ` (${joComments.length})` : ''}`, MessageSquare],
              ] as [DetailTab, string, React.ElementType][]).map(([id, label, Icon]) => {
                const active = detailTab === id
                return (
                  <button key={id} onClick={() => setDetailTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                      active ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <Icon size={13} />{label}
                  </button>
                )
              })}
            </div>

            {/* ── Overview / Edit ── */}
            {detailTab === 'overview' && (
              editMode ? (
                /* Edit form */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Requesting Team</label>
                      <select className="form-input" value={editForm.requestingTeam} onChange={e => setEditForm(f => ({ ...f, requestingTeam: e.target.value as RequestingTeam }))}>
                        {TEAMS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Activity Type</label>
                      <select className="form-input" value={editForm.activityType} onChange={e => setEditForm(f => ({ ...f, activityType: e.target.value as ActivityType }))}>
                        {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Project Name *</label>
                    <input className="form-input" value={editForm.projectName} onChange={e => setEditForm(f => ({ ...f, projectName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Campaign</label>
                    <input className="form-input" value={editForm.campaign} onChange={e => setEditForm(f => ({ ...f, campaign: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Deliverables</label>
                    <textarea rows={3} className="form-input resize-none" value={editForm.deliverables} onChange={e => setEditForm(f => ({ ...f, deliverables: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Priority</label>
                      <select className="form-input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Deadline *</label>
                      <input type="date" className="form-input" value={editForm.deadline} onChange={e => setDeadlineChangeConfirm(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Launch Date</label>
                      <input type="date" className="form-input" value={editForm.launchDate} onChange={e => setEditForm(f => ({ ...f, launchDate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-2">Assigned Members</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-700/40 rounded-xl p-2">
                      {resources.map(r => (
                        <label key={r.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                          <input type="checkbox" checked={editForm.assignedMemberIds.includes(r.id)}
                            onChange={e => setEditForm(f => ({
                              ...f,
                              assignedMemberIds: e.target.checked ? [...f.assignedMemberIds, r.id] : f.assignedMemberIds.filter(id => id !== r.id),
                            }))}
                          />
                          <span className={`w-6 h-6 rounded-full ${r.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>{r.initials}</span>
                          <div>
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{r.role}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Notes</label>
                    <textarea rows={2} className="form-input resize-none" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="space-y-4">
                  {/* Source Request linkage */}
                  {(() => {
                    const srcReq = bookingRequests.find(r => r.joId === selectedJO.id)
                    if (!srcReq) return null
                    return (
                      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-wide mb-2">Source Booking Request</p>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">REF#</span>
                            <span className="font-mono font-black text-sm text-brand-700 dark:text-brand-300 tracking-widest">
                              {srcReq.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">JO#</span>
                            <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                              {selectedJO.joNumber}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-brand-100 dark:border-brand-800 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <span className="text-slate-400 dark:text-slate-500">Requested by</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.preparedBy}</span>
                          <span className="text-slate-400 dark:text-slate-500">Department</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.department} {srcReq.departmentLocal ? `· ${srcReq.departmentLocal}` : ''}</span>
                          <span className="text-slate-400 dark:text-slate-500">Approver</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.approverName || '—'}</span>
                          <span className="text-slate-400 dark:text-slate-500">Venue</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.venue || '—'}</span>
                          {srcReq.designSpecs?.platform && (<>
                            <span className="text-slate-400 dark:text-slate-500">Platform</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.designSpecs.platform}</span>
                          </>)}
                          {srcReq.designSpecs?.shootTypeDetail && (<>
                            <span className="text-slate-400 dark:text-slate-500">Type of Shoot</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{srcReq.designSpecs.shootTypeDetail}</span>
                          </>)}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoBox label="Requesting Team" value={selectedJO.requestingTeam} />
                    <InfoBox label="Campaign" value={selectedJO.campaign || '—'} />
                    <InfoBox label="Deadline" value={formatDate(selectedJO.deadline)} highlight={isOverdue(selectedJO.deadline) && selectedJO.status !== 'Completed'} />
                    <InfoBox label="Launch Date" value={selectedJO.launchDate ? formatDate(selectedJO.launchDate) : '—'} />
                    <InfoBox label="Created" value={formatDateTime(selectedJO.createdAt)} />
                    <InfoBox label="Last Updated" value={formatDateTime(selectedJO.updatedAt)} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Deliverables</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 leading-relaxed">{selectedJO.deliverables || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-2">Assigned Members</p>
                    {selectedJO.assignedMemberIds.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 italic">No members assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedJO.assignedMemberIds.map(id => {
                          const r = resources.find(r => r.id === id)
                          return r ? (
                            <div key={id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
                              <span className={`w-6 h-6 rounded-full ${r.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>{r.initials}</span>
                              <div>
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.role}</p>
                              </div>
                            </div>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                  {selectedJO.notes && (
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Notes</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">{selectedJO.notes}</p>
                    </div>
                  )}
                  {canProgress && selectedJO.status !== 'Completed' && selectedJO.status !== 'Cancelled' && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      {/* Mark Complete modal trigger — For Review + authorized */}
                      {selectedJO.status === 'For Review' && (canApprove || (currentUser?.resourceId && selectedJO.assignedMemberIds.includes(currentUser.resourceId))) && (
                        <Button onClick={() => openCompletionModal(selectedJO)} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCheck size={14} /> Mark as Complete
                        </Button>
                      )}
                      {getNextStatus(selectedJO.status) && selectedJO.status !== 'Delayed' &&
                        !(selectedJO.status === 'For Review' && getNextStatus(selectedJO.status) === 'Completed') && (
                        <Button onClick={() => handleStatusChangeWithConfirm(selectedJO, getNextStatus(selectedJO.status)!)}>
                          Move to {getNextStatus(selectedJO.status)} <ChevronRight size={14} />
                        </Button>
                      )}
                      {canApprove && (
                        <Button variant="danger" onClick={() => handleStatusChangeWithConfirm(selectedJO, 'Cancelled')}>Cancel JO</Button>
                      )}
                    </div>
                  )}
                  {/* Completion summary for completed JOs */}
                  {selectedJO.status === 'Completed' && selectedJO.completedAt && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <CheckCheck size={13} /> Completed
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">By:</span> {selectedJO.completedBy} · <span className="font-semibold">On:</span> {formatDateTime(selectedJO.completedAt)}
                      </p>
                      {selectedJO.completionRemarks && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold">Remarks:</span> {selectedJO.completionRemarks}
                        </p>
                      )}
                      {selectedJO.completionFileUrl && (
                        <a href={selectedJO.completionFileUrl} target="_blank" rel="noreferrer" download
                          className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                          <Paperclip size={11} /> Download attachment
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            )}

            {/* ── Activity Log ── */}
            {detailTab === 'activity' && (
              <div className="space-y-3">
                {joLogs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <Clock size={28} className="mx-auto mb-2 opacity-40" />
                    No status changes recorded yet.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-700" />
                    <div className="space-y-3">
                      {joLogs.map(log => (
                        <div key={log.id} className="flex gap-3 relative">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 z-10 ring-2 ring-white dark:ring-slate-800 ${STATUS_COLORS[log.toStatus as JOStatus] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                            {log.toStatus.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-3 mt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  Status changed to <span className="text-brand-600 dark:text-brand-400">{log.toStatus}</span>
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  from <span className="font-medium">{log.fromStatus}</span> · by {log.changedBy}
                                </p>
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatDateTime(log.changedAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-3 relative">
                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black shrink-0 z-10 ring-2 ring-white dark:ring-slate-800 text-slate-500 dark:text-slate-400">JO</div>
                        <div className="flex-1 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-3 mt-0.5">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Job Order Created</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(selectedJO.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Files & References ── */}
            {detailTab === 'files' && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Add Reference Link</p>
                  <div className="grid grid-cols-5 gap-2">
                    <input value={newLink.label} onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))} placeholder="Label (optional)" className="form-input col-span-2 text-xs" />
                    <input value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="https://..." className="form-input col-span-2 text-xs" />
                    <button onClick={addFileRef} className="flex items-center justify-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors">
                      <Link2 size={13} /> Add
                    </button>
                  </div>
                  {linkError && <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>}
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Upload File</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Maximum file size: 2 MB</p>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <button
                    onClick={() => { setFileUploadError(''); fileInputRef.current?.click() }}
                    className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    <Upload size={13} className="text-brand-500" /> Choose File to Upload
                  </button>
                  {fileUploadError && <p className="text-xs text-red-600 dark:text-red-400">{fileUploadError}</p>}
                </div>
                {joFiles.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <Paperclip size={28} className="mx-auto mb-2 opacity-40" />No references added yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {joFiles.map(ref => (
                      <div key={ref.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 group">
                        {ref.isFile ? <Paperclip size={14} className="text-emerald-500 shrink-0" /> : <Link2 size={14} className="text-brand-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <a href={ref.url} target="_blank" rel="noopener noreferrer" download={ref.isFile ? ref.label : undefined}
                            className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline truncate block" onClick={e => e.stopPropagation()}>
                            {ref.label}
                          </a>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {ref.isFile ? 'File · ' : 'Link · '}Added by {ref.addedBy} · {formatDateTime(ref.addedAt)}
                          </p>
                        </div>
                        <button onClick={() => removeFileRef(selectedJO.id, ref.id)}
                          className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Comments ── */}
            {detailTab === 'comments' && (
              <div className="space-y-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {joComments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />No comments yet.
                    </div>
                  ) : joComments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-brand-500 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5">
                        {c.author.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.author}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(c.createdAt)}</p>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                    placeholder="Add a comment… (Enter to submit)" className="form-input flex-1 text-sm" />
                  <button onClick={addComment} disabled={!newComment.trim()}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 rounded-xl transition-colors">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── New JO Form Modal ──────────────────────────────────── */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="Create New Job Order" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Requesting Team *</label>
              <select className="form-input" value={form.requestingTeam} onChange={(e) => setForm((f) => ({ ...f, requestingTeam: e.target.value as RequestingTeam }))}>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Activity Type *</label>
              <select className="form-input" value={form.activityType} onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value as ActivityType }))}>
                {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Project Name *</label>
            <input className="form-input" value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} placeholder="e.g. Summer Campaign Launch" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Campaign</label>
            <input className="form-input" value={form.campaign} onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))} placeholder="e.g. Summer 2026" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Deliverables</label>
            <textarea rows={3} className="form-input resize-none" value={form.deliverables} onChange={(e) => setForm((f) => ({ ...f, deliverables: e.target.value }))} placeholder="List expected outputs, quantities, formats…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Priority</label>
              <select className="form-input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Deadline *</label>
              <input type="date" className="form-input" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Launch Date</label>
              <input type="date" className="form-input" value={form.launchDate} onChange={(e) => setForm((f) => ({ ...f, launchDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Assign Team Members</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto bg-slate-50 dark:bg-slate-700/40 rounded-xl p-2">
              {resources.map((r) => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" checked={form.assignedMemberIds.includes(r.id)}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      assignedMemberIds: e.target.checked ? [...f.assignedMemberIds, r.id] : f.assignedMemberIds.filter((id) => id !== r.id),
                    }))}
                  />
                  <span className={`w-6 h-6 rounded-full ${r.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>{r.initials}</span>
                  <div>
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea rows={2} className="form-input resize-none" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} className="flex-1">Submit Job Order</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setFormError('') }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── Completion Modal ──────────────────────────────────────── */}
      {completionTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !completionLoading && !completionSuccess && setCompletionTarget(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${completionSuccess ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <CheckCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Mark as Completed</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {completionTarget.joNumber} · {completionTarget.projectName}
                </p>
              </div>
            </div>

            {/* ── Success state ── */}
            {completionSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCheck size={26} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Job Order Completed!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{completionSuccess}</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Closing automatically…</p>
              </div>
            ) : (
              <>
                {/* ── Completed By — required, auto-filled but editable ── */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Completed By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Name of the person completing this JO"
                    value={completedByName}
                    onChange={e => { setCompletedByName(e.target.value); setCompletionError('') }}
                    disabled={completionLoading}
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Auto-filled from your account. Edit if completing on behalf of someone else.
                  </p>
                </div>

                {/* ── Completion Remarks — required ── */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Completion Remarks <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="form-input resize-none"
                    placeholder="Describe what was delivered, any notes, or final comments…"
                    value={completionRemarks}
                    onChange={e => { setCompletionRemarks(e.target.value); setCompletionError('') }}
                    disabled={completionLoading}
                  />
                </div>

                {/* ── Attachment — optional ── */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Proof / Attachment <span className="text-slate-400 font-normal">(optional · max 5 MB)</span>
                  </label>
                  <input ref={completionFileRef} type="file" className="hidden" onChange={handleCompletionFileChange} />
                  {completionFileUrl ? (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                      <Paperclip size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex-1 truncate">{completionFileName}</span>
                      <button onClick={() => { setCompletionFileUrl(null); setCompletionFileName('') }} className="text-red-400 hover:text-red-600 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => completionFileRef.current?.click()}
                      disabled={completionLoading}
                      className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl py-3 text-xs text-slate-400 dark:text-slate-500 hover:border-brand-300 dark:hover:border-brand-600 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:pointer-events-none"
                    >
                      <Upload size={14} /> Click to attach a file
                    </button>
                  )}
                </div>

                {/* ── Email notice ── */}
                <div className="flex items-start gap-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5">
                  <Send size={12} className="text-brand-500 dark:text-brand-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-brand-700 dark:text-brand-300 leading-relaxed">
                    A completion email will automatically be sent to the requestor after saving (if a linked booking request exists).
                  </p>
                </div>

                {/* ── Error message ── */}
                {completionError && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                    <AlertTriangle size={13} className="text-red-500 dark:text-red-400 shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{completionError}</p>
                  </div>
                )}

                {/* ── Loading status ── */}
                {completionLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full shrink-0" />
                    Saving completion record &amp; sending notification…
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setCompletionTarget(null)}
                    disabled={completionLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkComplete}
                    disabled={completionLoading || !completedByName.trim() || !completionRemarks.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {completionLoading
                      ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving…</>
                      : <><CheckCheck size={15} /> Confirm Completion</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

        </>
      )}
    </div>
  )
}

// ── Request Card Component ─────────────────────────────────────────────────
interface RequestCardProps {
  req: BookingRequest
  canSeeRequests: boolean
  onReview: () => void
  onDelete: () => void
}

function RequestCard({ req, canSeeRequests, onReview, onDelete }: RequestCardProps) {
  const statusStyles: Record<BookingRequestStatus, string> = {
    'Pending Approval': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'Pending Review': 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    'Assigned':       'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
    'Approved':       'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    'Rejected':       'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  }
  const reqAny = req as any
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg font-semibold shrink-0">
          #{req.id.slice(0, 8).toUpperCase()}
        </span>
        <ActivityBadge type={req.activityType} />
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[req.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {req.status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {canSeeRequests && (req.status === 'Pending Review' ? (
            <Button size="sm" onClick={onReview}>
              <Users size={13} /> Review &amp; Assign
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onReview}>
              View
            </Button>
          ))}
          {canSeeRequests && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors"
              title="Remove request"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span><span className="font-semibold text-slate-400 dark:text-slate-500">Department:</span> {req.department || '—'}</span>
        <span><span className="font-semibold text-slate-400 dark:text-slate-500">Dept. Local:</span> {req.departmentLocal || '—'}</span>
        <span><span className="font-semibold text-slate-400 dark:text-slate-500">Prepared By:</span> {req.preparedBy}</span>
        <span><span className="font-semibold text-slate-400 dark:text-slate-500">Requestor Email:</span> {req.requestorEmail}</span>
        {req.projectName && <span className="sm:col-span-2"><span className="font-semibold text-slate-400 dark:text-slate-500">Project Name:</span> {req.projectName}</span>}
        <span><span className="font-semibold text-slate-400 dark:text-slate-500">Date Encoded:</span> {formatDate(req.encodedAt)}</span>
        <span>
          <span className="font-semibold text-slate-400 dark:text-slate-500">Date Needed:</span>{' '}
          {formatDate(req.neededDate)}{reqAny.endDate ? ` – ${formatDate(reqAny.endDate)}` : ''}
        </span>
        {(req.startTime || req.endTime) && <span><span className="font-semibold text-slate-400 dark:text-slate-500">Time:</span> {req.startTime || '?'} – {req.endTime || '?'}</span>}
        <span className="sm:col-span-2"><span className="font-semibold text-slate-400 dark:text-slate-500">Venue / Location:</span> {req.venue || '—'}</span>
        {reqAny.approverName && (
          <span className="sm:col-span-3">
            <span className="font-semibold text-slate-400 dark:text-slate-500">Approver:</span>{' '}
            {reqAny.approverName} ({reqAny.approverEmail})
          </span>
        )}
        {req.notes && <span className="sm:col-span-3"><span className="font-semibold text-slate-400 dark:text-slate-500">Additional Notes:</span> {req.notes}</span>}
      </div>
    </div>
  )
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  )
}
