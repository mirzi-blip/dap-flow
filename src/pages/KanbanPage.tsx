import { useState, useMemo, useEffect } from 'react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { usePermissions } from '../hooks/usePermissions'
import { ActivityBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { formatDate, formatDateTime, generateId, getNextStatus, isOverdue } from '../utils/helpers'
import type { JOStatus, JobOrder } from '../types'
import { db } from '../db/database'
import {
  Calendar, AlertTriangle, ChevronRight, Eye, Clock,
  LayoutList, MessageSquare, Paperclip, Send, Upload,
  CheckCircle2, XCircle, ClipboardCheck, ExternalLink,
} from 'lucide-react'
import { fetchJOComments, saveJOComment, uploadOutputFile, saveJOReviewRecord, fetchJOReview, updateJOReviewRecord } from '../lib/supabase'
import type { JOComment } from '../lib/supabase'
import type { JOReview } from '../types'

const COLUMNS: { status: JOStatus; label: string; hex: string }[] = [
  { status: 'Pending',         label: 'Backlog',        hex: '#EAB308' },
  { status: 'Approved',        label: 'Approved',       hex: '#3B82F6' },
  { status: 'Scheduled',       label: 'Scheduled',      hex: '#6366F1' },
  { status: 'For Review',      label: 'For Review',     hex: '#F97316' },
  { status: 'Needs Revision',  label: 'Needs Revision', hex: '#E11D48' },
  { status: 'Completed',       label: 'Completed',      hex: '#10B981' },
]

const STATUS_COLORS: Record<JOStatus, string> = {
  'Pending':        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'Approved':       'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Scheduled':      'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'For Review':     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Needs Revision': 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'Completed':      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Delayed':        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  'Cancelled':      'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function KanbanCard({
  jo, onAdvance, onView, canProgress, resources,
}: {
  jo: JobOrder
  onAdvance: (jo: JobOrder) => void
  onView: (jo: JobOrder) => void
  canProgress: boolean
  resources: import('../types').Resource[]
}) {
  const overdue = isOverdue(jo.deadline) && jo.status !== 'Completed'
  const next = getNextStatus(jo.status)
  const members = resources.filter((r) => jo.assignedMemberIds.includes(r.id))

  return (
    <div
      onClick={() => onView(jo)}
      className={`bg-white dark:bg-slate-800 rounded-xl p-3.5 shadow-sm border cursor-pointer ${
        overdue ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'
      } hover:shadow-md transition-all group`}
    >
      {overdue && (
        <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold mb-2">
          <AlertTriangle size={11} /> Overdue
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{jo.joNumber}</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-2">{jo.projectName}</p>
        </div>
        <PriorityBadge priority={jo.priority} />
      </div>
      <div className="mb-3"><ActivityBadge type={jo.activityType} /></div>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar size={11} />
          <span className={overdue ? 'text-red-500 dark:text-red-400 font-medium' : ''}>{formatDate(jo.deadline)}</span>
        </div>
        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold px-1.5 py-0.5 rounded">
          {jo.requestingTeam}
        </span>
      </div>
      {members.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          <div className="flex -space-x-1">
            {members.slice(0, 4).map((r) => (
              <span key={r.id} title={r.name}
                className={`w-5 h-5 rounded-full ${r.color} border-[1.5px] border-white dark:border-slate-800 flex items-center justify-center text-white text-[8px] font-bold`}>
                {r.initials}
              </span>
            ))}
          </div>
          {members.length > 4 && <span className="text-[10px] text-slate-400">+{members.length - 4}</span>}
        </div>
      )}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => onView(jo)}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-dashed border-slate-200 dark:border-slate-600 hover:border-blue-300">
          <Eye size={11} /> View
        </button>
        {canProgress && next && (
          <button onClick={() => onAdvance(jo)}
            className="flex-1 flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-dashed border-blue-200 dark:border-blue-800 hover:border-blue-400">
            → {next}
          </button>
        )}
      </div>
    </div>
  )
}

type DetailTab = 'overview' | 'activity' | 'comments' | 'review'

export function KanbanPage() {
  const { jobOrders, updateJobOrder, addStatusLog, addNotification, statusLogs, bookingRequests } = useDataStore()
  const { currentUser, resources, approvers } = useAppStore()
  const { can } = usePermissions()

  // Detail modal
  const [selectedJO, setSelectedJO]   = useState<JobOrder | null>(null)
  const [detailTab, setDetailTab]      = useState<DetailTab>('overview')

  // Move modal
  const [moveTarget, setMoveTarget]               = useState<JobOrder | null>(null)
  const [moveComment, setMoveComment]             = useState('')
  const [moveFile, setMoveFile]                   = useState<File | null>(null)
  const [moveReqApproverEmail, setMoveReqApproverEmail] = useState('')
  const [moveReqApproverName, setMoveReqApproverName]   = useState('')
  const [moveDapApproverEmail, setMoveDapApproverEmail] = useState('')
  const [moveDapApproverName, setMoveDapApproverName]   = useState('')
  const [showMoveConfirm, setShowMoveConfirm]     = useState(false)
  const [moveLoading, setMoveLoading]             = useState(false)
  const [moveError, setMoveError]                 = useState('')

  // Review approval modal
  const [joReview, setJoReview]                   = useState<JOReview | null>(null)
  const [reviewLoading, setReviewLoading]         = useState(false)
  const [approveSlot, setApproveSlot]             = useState<'req' | 'dap' | null>(null)
  const [approveAction, setApproveAction]         = useState<'approve' | 'disapprove'>('approve')
  const [approveComment, setApproveComment]       = useState('')
  const [approveSubmitting, setApproveSubmitting] = useState(false)

  // Reactivate modal
  const [reactivateJO, setReactivateJO]           = useState<JobOrder | null>(null)
  const [reactivateStatus, setReactivateStatus]   = useState<JOStatus | null>(null)
  const [reactivateComment, setReactivateComment] = useState('')

  // Comments
  const [comments, setComments]           = useState<JOComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentDraft, setCommentDraft]   = useState('')
  const [commentSending, setCommentSending] = useState(false)

  const canProgress = can('pipeline', 'move_cards')

  const columns = useMemo(
    () => COLUMNS.map((col) => ({ ...col, items: jobOrders.filter((j) => j.status === col.status) })),
    [jobOrders]
  )
  const delayed  = useMemo(() => jobOrders.filter((j) => j.status === 'Delayed'), [jobOrders])
  const joLogs   = selectedJO ? statusLogs.filter(l => l.joId === selectedJO.id) : []

  // Load comments when detail modal opens / switches JO
  useEffect(() => {
    if (!selectedJO) { setComments([]); return }
    setCommentsLoading(true)
    fetchJOComments(selectedJO.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false))
  }, [selectedJO?.id])

  function openDetail(jo: JobOrder) {
    setSelectedJO(jo)
    setDetailTab('overview')
    setCommentDraft('')
    setJoReview(null)
    if (jo.status === 'For Review' || jo.status === 'Needs Revision') {
      setReviewLoading(true)
      fetchJOReview(jo.id)
        .then(async r => {
          setJoReview(r)
          // Auto-sync: email approvals update Supabase but not Dexie — detect and apply here
          if (r && r.overallStatus !== 'pending' && jo.status === 'For Review') {
            const newStatus: JOStatus = r.overallStatus === 'approved' ? 'Completed' : 'Needs Revision'
            const now = new Date().toISOString()
            const synced: JobOrder = { ...jo, status: newStatus, updatedAt: now }
            await db.jobOrders.put(synced)
            updateJobOrder(synced)
            setSelectedJO(synced)
            const log = {
              id: generateId(), joId: jo.id, joNumber: jo.joNumber,
              fromStatus: jo.status, toStatus: newStatus,
              changedBy: 'Email Approval',
              changedAt: now, notes: 'Status auto-synced from email-based review action.',
            }
            await db.statusLogs.add(log)
            addStatusLog(log)
          }
        })
        .catch(() => {})
        .finally(() => setReviewLoading(false))
    }
  }

  async function handleApproveAction() {
    if (!joReview || !approveComment.trim() || !approveSlot || !selectedJO || approveSubmitting) return
    setApproveSubmitting(true)
    try {
      const now = new Date().toISOString()
      const isApprove = approveAction === 'approve'
      const updates: Parameters<typeof updateJOReviewRecord>[1] = {}

      if (approveSlot === 'req') {
        updates.reqApproverStatus = isApprove ? 'approved' : 'disapproved'
        updates.reqApproverComment = approveComment.trim()
        updates.reqApproverActionAt = now
      } else {
        updates.dapApproverStatus = isApprove ? 'approved' : 'disapproved'
        updates.dapApproverComment = approveComment.trim()
        updates.dapApproverActionAt = now
      }

      const updatedReview: JOReview = {
        ...joReview,
        ...(approveSlot === 'req'
          ? { reqApproverStatus: updates.reqApproverStatus as JOReview['reqApproverStatus'], reqApproverComment: updates.reqApproverComment, reqApproverActionAt: now }
          : { dapApproverStatus: updates.dapApproverStatus as JOReview['dapApproverStatus'], dapApproverComment: updates.dapApproverComment, dapApproverActionAt: now }
        ),
      }

      let newJOStatus: JOStatus | null = null
      if (!isApprove) {
        updates.overallStatus = 'needs_revision'
        updatedReview.overallStatus = 'needs_revision'
        newJOStatus = 'Needs Revision'
      } else if (updatedReview.reqApproverStatus === 'approved' && updatedReview.dapApproverStatus === 'approved') {
        updates.overallStatus = 'approved'
        updatedReview.overallStatus = 'approved'
        newJOStatus = 'Completed'
      }

      await updateJOReviewRecord(joReview.id, updates)
      setJoReview(updatedReview)

      if (newJOStatus) {
        const updatedJO: JobOrder = { ...selectedJO, status: newJOStatus, updatedAt: now }
        await db.jobOrders.put(updatedJO)
        updateJobOrder(updatedJO)
        setSelectedJO(updatedJO)

        const log = {
          id: generateId(), joId: selectedJO.id, joNumber: selectedJO.joNumber,
          fromStatus: selectedJO.status, toStatus: newJOStatus,
          changedBy: currentUser?.name ?? 'Unknown',
          changedAt: now, notes: approveComment.trim(),
        }
        await db.statusLogs.add(log)
        addStatusLog(log)

        await saveJOComment({
          joId: selectedJO.id,
          authorName: currentUser?.name ?? 'Unknown',
          authorEmail: currentUser?.email ?? '',
          body: approveComment.trim(),
          fromStatus: selectedJO.status,
          toStatus: newJOStatus,
        }).then(c => { if (c) setComments(prev => [...prev, c]) })

        // Send outcome email
        const emailBase = {
          joNumber: selectedJO.joNumber,
          projectName: selectedJO.projectName,
          activityType: selectedJO.activityType,
          approverName: currentUser?.name,
          approverComment: approveComment.trim(),
        }
        if (newJOStatus === 'Completed') {
          // Notify assigned members + requestor
          const assignedEmails = resources
            .filter(r => selectedJO.assignedMemberIds.includes(r.id) && r.email)
            .map(r => r.email)
          fetch('https://dap-flow-tau.vercel.app/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewApprovedNotification: true, recipientEmails: assignedEmails, outputFileUrl: joReview.outputFileUrl, ...emailBase }),
          }).catch(console.error)
        } else {
          // Needs Revision — notify assigned members
          const assignedEmails = resources
            .filter(r => selectedJO.assignedMemberIds.includes(r.id) && r.email)
            .map(r => r.email)
          fetch('https://dap-flow-tau.vercel.app/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewDisapprovedNotification: true, recipientEmails: assignedEmails, ...emailBase }),
          }).catch(console.error)
        }
      }

      setApproveSlot(null)
      setApproveComment('')
    } catch (err) {
      console.error('Approve action error:', err)
    } finally {
      setApproveSubmitting(false)
    }
  }

  function openMoveModal(jo: JobOrder) {
    setMoveTarget(jo)
    setMoveComment('')
    setMoveFile(null)
    // Auto-fill requestor from linked booking request
    const linkedReq = bookingRequests.find(r => r.joId === jo.id)
    setMoveReqApproverEmail(linkedReq?.requestorEmail ?? '')
    setMoveReqApproverName(linkedReq?.requestorName || linkedReq?.preparedBy || '')
    setMoveDapApproverEmail('')
    setMoveDapApproverName('')
    setShowMoveConfirm(false)
    setMoveError('')
  }

  const moveNext    = moveTarget ? getNextStatus(moveTarget.status) : null
  const isForReview = (moveTarget?.status === 'Scheduled' || moveTarget?.status === 'Needs Revision') && moveNext === 'For Review'
  const moveValid   = moveComment.trim() !== '' &&
    (!isForReview || (moveFile !== null && moveDapApproverEmail !== ''))

  async function handleConfirmMove() {
    if (!moveTarget || !moveNext || !moveValid || moveLoading) return
    setMoveLoading(true)
    setMoveError('')

    try {
      // Upload output file for Scheduled → For Review
      let attachmentUrl: string | undefined
      let attachmentName: string | undefined
      if (isForReview && moveFile) {
        const uploaded = await uploadOutputFile(moveTarget.id, moveFile)
        if (!uploaded) {
          setMoveError('File upload failed. Please try again.')
          setMoveLoading(false)
          return
        }
        attachmentUrl = uploaded.url
        attachmentName = uploaded.name
      }

      // Persist comment
      const savedComment = await saveJOComment({
        joId: moveTarget.id,
        authorName: currentUser?.name ?? 'Unknown',
        authorEmail: currentUser?.email ?? '',
        body: moveComment.trim(),
        attachmentUrl,
        attachmentName,
        fromStatus: moveTarget.status,
        toStatus: moveNext,
      })

      // Update JO status
      const updated: JobOrder = { ...moveTarget, status: moveNext, updatedAt: new Date().toISOString() }
      await db.jobOrders.put(updated)
      updateJobOrder(updated)

      // Status log
      const log = {
        id: generateId(), joId: moveTarget.id, joNumber: moveTarget.joNumber,
        fromStatus: moveTarget.status, toStatus: moveNext,
        changedBy: currentUser?.name ?? 'Unknown',
        changedAt: new Date().toISOString(), notes: moveComment.trim(),
      }
      await db.statusLogs.add(log)
      addStatusLog(log)

      // In-app notification
      const notif = {
        id: generateId(), type: 'status_changed' as const,
        title: 'JO Moved', message: `${moveTarget.joNumber} moved to "${moveNext}"`,
        read: false, createdAt: new Date().toISOString(),
        targetUserId: moveTarget.requesterId, joId: moveTarget.id,
      }
      await db.notifications.add(notif)
      addNotification(notif)

      // Create jo_reviews record and email both approvers
      if (isForReview && attachmentUrl) {
        const now = new Date().toISOString()
        const reviewRecord = await saveJOReviewRecord({
          joId: moveTarget.id,
          joNumber: moveTarget.joNumber,
          projectName: moveTarget.projectName,
          outputFileUrl: attachmentUrl,
          outputFileName: attachmentName,
          submittedBy: currentUser?.name ?? 'Unknown',
          submittedAt: now,
          reqApproverName: moveReqApproverName,
          reqApproverEmail: moveReqApproverEmail,
          reqApproverStatus: 'pending',
          dapApproverName: moveDapApproverName,
          dapApproverEmail: moveDapApproverEmail,
          dapApproverStatus: 'pending',
          overallStatus: 'pending',
          updatedAt: now,
        })
        if (reviewRecord) setJoReview(reviewRecord)

        const reviewId = reviewRecord?.id
        const emailPayload = {
          submittedBy: currentUser?.name,
          joNumber: moveTarget.joNumber,
          projectName: moveTarget.projectName,
          activityType: moveTarget.activityType,
          comment: moveComment.trim(),
          attachmentUrl,
          attachmentName,
        }
        // Send to Requestor Approver (email buttons only — no app access)
        fetch('https://dap-flow-tau.vercel.app/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewNotification: true, approverEmail: moveReqApproverEmail, approverName: moveReqApproverName, approverRole: 'Requestor Approver', reviewId, slot: 'req', ...emailPayload }),
        }).catch(console.error)
        // Send to DAP Team Approver (email buttons + in-app option)
        fetch('https://dap-flow-tau.vercel.app/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewNotification: true, approverEmail: moveDapApproverEmail, approverName: moveDapApproverName, approverRole: 'DAP Team Approver', reviewId, slot: 'dap', ...emailPayload }),
        }).catch(console.error)
      }

      // Sync detail modal if it was open for this JO
      if (selectedJO?.id === moveTarget.id) {
        setSelectedJO(updated)
        if (savedComment) setComments(prev => [...prev, savedComment])
      }

      setMoveTarget(null)
    } catch (err) {
      console.error('Move error:', err)
      setMoveError('Something went wrong. Please try again.')
    } finally {
      setMoveLoading(false)
    }
  }

  async function handleReactivate() {
    if (!reactivateJO || !reactivateStatus || !reactivateComment.trim()) return

    const updated: JobOrder = { ...reactivateJO, status: reactivateStatus, updatedAt: new Date().toISOString() }
    await db.jobOrders.put(updated)
    updateJobOrder(updated)

    const log = {
      id: generateId(), joId: reactivateJO.id, joNumber: reactivateJO.joNumber,
      fromStatus: reactivateJO.status, toStatus: reactivateStatus,
      changedBy: currentUser?.name ?? 'Unknown',
      changedAt: new Date().toISOString(), notes: reactivateComment.trim(),
    }
    await db.statusLogs.add(log)
    addStatusLog(log)

    await saveJOComment({
      joId: reactivateJO.id,
      authorName: currentUser?.name ?? 'Unknown',
      authorEmail: currentUser?.email ?? '',
      body: reactivateComment.trim(),
      fromStatus: reactivateJO.status,
      toStatus: reactivateStatus,
    })

    if (selectedJO?.id === reactivateJO.id) setSelectedJO(updated)
    setReactivateJO(null)
    setReactivateStatus(null)
    setReactivateComment('')
  }

  async function handleAddComment() {
    if (!selectedJO || !commentDraft.trim() || commentSending) return
    setCommentSending(true)
    try {
      const saved = await saveJOComment({
        joId: selectedJO.id,
        authorName: currentUser?.name ?? 'Unknown',
        authorEmail: currentUser?.email ?? '',
        body: commentDraft.trim(),
      })
      if (saved) { setComments(prev => [...prev, saved]); setCommentDraft('') }
    } finally {
      setCommentSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{jobOrders.length}</span> total job orders across pipeline
        </p>
        {delayed.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800">
            <AlertTriangle size={13} />
            {delayed.length} delayed JO{delayed.length > 1 ? 's' : ''} — needs attention
          </div>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {columns.map((col) => (
          <div key={col.status} className="flex-shrink-0 w-72">
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60" style={{ borderTopWidth: 3, borderTopColor: col.hex }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.hex }} />
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{col.label}</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: col.hex }}>
                  {col.items.length}
                </span>
              </div>
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {col.items.length === 0 ? (
                  <div className="text-center py-8 text-slate-300 dark:text-slate-600 text-xs">Empty</div>
                ) : col.items.map((jo) => (
                  <KanbanCard key={jo.id} jo={jo} onAdvance={openMoveModal} onView={openDetail} canProgress={canProgress} resources={resources} />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Delayed column */}
        {delayed.length > 0 && (
          <div className="flex-shrink-0 w-72">
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden h-full flex flex-col">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60" style={{ borderTopWidth: 3, borderTopColor: '#EF4444' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#EF4444' }} />
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Delayed</h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#EF4444' }}>{delayed.length}</span>
              </div>
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {delayed.map((jo) => (
                  <div key={jo.id} onClick={() => openDetail(jo)}
                    className="bg-white dark:bg-slate-800 rounded-xl p-3.5 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all group">
                    <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{jo.joNumber}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{jo.projectName}</p>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      <ActivityBadge type={jo.activityType} />
                      <PriorityBadge priority={jo.priority} />
                    </div>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-medium">Due: {formatDate(jo.deadline)}</p>
                    {canProgress && (
                      <button
                        onClick={e => { e.stopPropagation(); setReactivateJO(jo); setReactivateStatus(null); setReactivateComment('') }}
                        className="w-full mt-2.5 text-xs font-semibold py-1.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        Move to… ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Move Modal ── */}
      <Modal
        open={!!moveTarget}
        onClose={() => { if (!moveLoading) setMoveTarget(null) }}
        title={moveTarget ? `Move ${moveTarget.joNumber} → ${moveNext}` : ''}
        maxWidth="max-w-lg"
      >
        {moveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Moving <span className="font-semibold text-slate-800 dark:text-slate-200">{moveTarget.projectName}</span> from{' '}
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[moveTarget.status]}`}>{moveTarget.status}</span>
              {' '}to{' '}
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${moveNext ? STATUS_COLORS[moveNext] : ''}`}>{moveNext}</span>
            </p>

            {/* Required comment */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Comment <span className="text-red-500">*</span>
              </label>
              <textarea
                value={moveComment}
                onChange={e => setMoveComment(e.target.value)}
                placeholder="Describe what was completed, any blockers, or notes for the team…"
                rows={3}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-slate-400"
              />
            </div>

            {/* Scheduled → For Review: output file (required) */}
            {isForReview && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Attach Output / Artwork <span className="text-red-500">*</span>
                </label>
                {moveFile ? (
                  <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2.5">
                    <Paperclip size={14} className="text-blue-500 shrink-0" />
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{moveFile.name}</span>
                    <button type="button" onClick={() => setMoveFile(null)} className="text-slate-400 hover:text-red-500 text-xs font-semibold transition-colors shrink-0">Remove</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 border-2 border-dashed border-blue-200 dark:border-blue-700 rounded-xl py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all">
                    <Upload size={22} className="text-blue-400" />
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Click to upload output file</span>
                    <span className="text-xs text-slate-400">Image, PDF, video link, or any format</span>
                    <input type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setMoveFile(f) }} />
                  </label>
                )}
              </div>
            )}

            {/* Scheduled / Needs Revision → For Review: both approvers required */}
            {isForReview && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                    Requestor Approver
                  </label>
                  {moveReqApproverEmail ? (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {moveReqApproverName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{moveReqApproverName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{moveReqApproverEmail}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={12} className="shrink-0" />
                      No booking request linked — requestor email unknown.
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                    DAP Team Approver <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={moveDapApproverEmail}
                    onChange={e => {
                      const found = approvers.find(a => a.email === e.target.value)
                      setMoveDapApproverEmail(e.target.value)
                      setMoveDapApproverName(found?.name ?? '')
                    }}
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select DAP team approver…</option>
                    {approvers.filter(a => a.isActive !== false && a.approverType === 'dap').map(a => (
                      <option key={a.id} value={a.email}>{a.name}{a.position ? ` · ${a.position}` : ''}</option>
                    ))}
                  </select>
                  {approvers.filter(a => a.isActive !== false && a.approverType === 'dap').length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={11} /> No DAP Team Approvers configured. Add them in Settings → DAP Team Approvers.
                    </p>
                  )}
                </div>
              </>
            )}

            {moveError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle size={12} className="shrink-0" /> {moveError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setMoveTarget(null)} disabled={moveLoading}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button"
                onClick={() => { if (isForReview) { setShowMoveConfirm(true) } else { handleConfirmMove() } }}
                disabled={!moveValid || moveLoading}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2">
                {moveLoading
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Moving…</>
                  : isForReview ? 'Submit for Review →' : `Move to ${moveNext} →`}
              </button>
            </div>

            {/* Confirmation dialog */}
            {showMoveConfirm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                      <ClipboardCheck size={18} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Submit for Review?</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Are you sure you want to submit this Job Order for review? Both approvers will be notified by email.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowMoveConfirm(false)}
                      className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                      Go Back
                    </button>
                    <button onClick={() => { setShowMoveConfirm(false); handleConfirmMove() }}
                      className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors">
                      Yes, Submit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Reactivate Modal ── */}
      <Modal
        open={!!reactivateJO}
        onClose={() => { setReactivateJO(null); setReactivateStatus(null); setReactivateComment('') }}
        title={reactivateJO ? `Move ${reactivateJO.joNumber} to…` : ''}
        maxWidth="max-w-sm"
      >
        {reactivateJO && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Select the stage to move this job order to:</p>
            <div className="space-y-2">
              {(['Pending', 'Approved', 'Scheduled', 'For Review', 'Needs Revision', 'Completed'] as JOStatus[]).map(status => {
                const col = COLUMNS.find(c => c.status === status)
                const selected = reactivateStatus === status
                return (
                  <button key={status} onClick={() => setReactivateStatus(status)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      selected
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                    }`}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col?.hex ?? '#94a3b8' }} />
                    <span className={`text-sm font-semibold ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>{status}</span>
                    {selected && <span className="ml-auto text-blue-600 dark:text-blue-400 text-[10px] font-bold">Selected ✓</span>}
                  </button>
                )
              })}
            </div>

            {reactivateStatus && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                  Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reactivateComment}
                  onChange={e => setReactivateComment(e.target.value)}
                  placeholder="Reason for moving this job order…"
                  rows={2}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-slate-400"
                />
                <button onClick={handleReactivate} disabled={!reactivateComment.trim()}
                  className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors">
                  Move to {reactivateStatus} →
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── JO Detail Modal ── */}
      <Modal
        open={!!selectedJO}
        onClose={() => setSelectedJO(null)}
        title={selectedJO ? `${selectedJO.joNumber} · ${selectedJO.projectName}` : ''}
        maxWidth="max-w-2xl"
      >
        {selectedJO && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActivityBadge type={selectedJO.activityType} />
              <StatusBadge status={selectedJO.status} />
              <PriorityBadge priority={selectedJO.priority} />
              {isOverdue(selectedJO.deadline) && selectedJO.status !== 'Completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">⚠ Overdue</span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-100 dark:border-slate-700 flex-wrap">
              {([
                ['overview',  'Overview',                                                  LayoutList],
                ['activity',  `Activity${joLogs.length ? ` (${joLogs.length})` : ''}`,   Clock],
                ['comments',  `Comments${comments.length ? ` (${comments.length})` : ''}`, MessageSquare],
                ...((selectedJO.status === 'For Review' || selectedJO.status === 'Needs Revision')
                  ? [['review', 'Review Status', ClipboardCheck] as [DetailTab, string, React.ElementType]]
                  : []),
              ] as [DetailTab, string, React.ElementType][]).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setDetailTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                    detailTab === id
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <InfoBox label="Requesting Team" value={selectedJO.requestingTeam} />
                  <InfoBox label="Campaign" value={selectedJO.campaign || '—'} />
                  <InfoBox label="Deadline" value={formatDate(selectedJO.deadline)} highlight={isOverdue(selectedJO.deadline) && selectedJO.status !== 'Completed'} />
                  <InfoBox label="Launch Date" value={selectedJO.launchDate ? formatDate(selectedJO.launchDate) : '—'} />
                </div>
                {selectedJO.deliverables && (
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Deliverables</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 leading-relaxed">{selectedJO.deliverables}</p>
                  </div>
                )}
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
                {canProgress && selectedJO.status !== 'Completed' && selectedJO.status !== 'Cancelled' && getNextStatus(selectedJO.status) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <Button onClick={() => openMoveModal(selectedJO)}>
                      Move to {getNextStatus(selectedJO.status)} <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Activity tab */}
            {detailTab === 'activity' && (
              <div className="space-y-3">
                {joLogs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <Clock size={28} className="mx-auto mb-2 opacity-40" />No status changes yet.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-700" />
                    <div className="space-y-3">
                      {joLogs.map(log => (
                        <div key={log.id} className="flex gap-3 relative">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 z-10 ring-2 ring-white dark:ring-slate-800 ${STATUS_COLORS[log.toStatus as JOStatus]}`}>
                            {log.toStatus.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-3 mt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                <span className="text-blue-600 dark:text-blue-400">{log.toStatus}</span>
                                <span className="text-slate-400 font-normal"> · from {log.fromStatus} · by {log.changedBy}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatDateTime(log.changedAt)}</p>
                            </div>
                            {log.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">"{log.notes}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review Status tab */}
            {detailTab === 'review' && (
              <div className="space-y-4">
                {reviewLoading ? (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">Loading review status…</div>
                ) : !joReview ? (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <ClipboardCheck size={28} className="mx-auto mb-2 opacity-40" />No review record found.
                  </div>
                ) : (
                  <>
                    {/* Output file */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Paperclip size={15} className="text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Output File</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{joReview.outputFileName || 'Attachment'}</p>
                      </div>
                      <a href={joReview.outputFileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 shrink-0">
                        <ExternalLink size={12} /> Open
                      </a>
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Submitted by <strong className="text-slate-700 dark:text-slate-300">{joReview.submittedBy}</strong> on {formatDateTime(joReview.submittedAt)}
                    </p>

                    {/* Approver cards */}
                    {[
                      { slot: 'req' as const, label: 'Requestor Approver', name: joReview.reqApproverName, email: joReview.reqApproverEmail, status: joReview.reqApproverStatus, comment: joReview.reqApproverComment, actionAt: joReview.reqApproverActionAt },
                      { slot: 'dap' as const, label: 'DAP Team Approver',  name: joReview.dapApproverName, email: joReview.dapApproverEmail, status: joReview.dapApproverStatus, comment: joReview.dapApproverComment, actionAt: joReview.dapApproverActionAt },
                    ].map(ap => {
                      const canAct = (currentUser?.email === ap.email || can('pipeline', 'move_cards')) && ap.status === 'pending'
                      return (
                        <div key={ap.slot} className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{ap.label}</p>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ap.name}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">{ap.email}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                              ap.status === 'approved'    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                              ap.status === 'disapproved' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}>
                              {ap.status === 'approved' ? <><CheckCircle2 size={10} /> Approved</> :
                               ap.status === 'disapproved' ? <><XCircle size={10} /> Disapproved</> :
                               '⏳ Pending Review'}
                            </span>
                          </div>
                          {ap.comment && (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
                              <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{ap.comment}"</p>
                              {ap.actionAt && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(ap.actionAt)}</p>}
                            </div>
                          )}
                          {canAct && selectedJO.status === 'For Review' && (
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => { setApproveSlot(ap.slot); setApproveAction('approve'); setApproveComment('') }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button onClick={() => { setApproveSlot(ap.slot); setApproveAction('disapprove'); setApproveComment('') }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">
                                <XCircle size={12} /> Disapprove
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Overall status banner */}
                    {joReview.overallStatus === 'approved' && (
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={15} /> Both approvers have approved — Job Order moved to Completed.
                      </div>
                    )}
                    {joReview.overallStatus === 'needs_revision' && (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-400">
                        <XCircle size={15} /> Revision requested — Job Order moved to Needs Revision.
                      </div>
                    )}
                  </>
                )}

                {/* Approve / Disapprove modal */}
                {approveSlot !== null && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${approveAction === 'approve' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                          {approveAction === 'approve'
                            ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                            : <XCircle size={18} className="text-red-600 dark:text-red-400" />}
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {approveAction === 'approve' ? 'Approve Output' : 'Request Revision'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {approveAction === 'approve'
                          ? 'Please leave a comment confirming your approval.'
                          : 'Please describe what needs to be revised.'}
                      </p>
                      <textarea
                        value={approveComment}
                        onChange={e => setApproveComment(e.target.value)}
                        placeholder={approveAction === 'approve' ? 'e.g. Output looks good, approved.' : 'e.g. Please adjust the color palette and resize for print.'}
                        rows={3}
                        autoFocus
                        className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-slate-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setApproveSlot(null); setApproveComment('') }}
                          className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleApproveAction}
                          disabled={!approveComment.trim() || approveSubmitting}
                          className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50 ${approveAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                          {approveSubmitting ? 'Submitting…' : approveAction === 'approve' ? 'Approve' : 'Submit Revision Request'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comments tab */}
            {detailTab === 'comments' && (
              <div className="space-y-4">
                {commentsLoading ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">Loading comments…</div>
                ) : comments.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                    No comments yet. Be the first to add one.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-700" />
                    <div className="space-y-3">
                      {comments.map(c => (
                        <div key={c.id} className="flex gap-3 relative">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 z-10 ring-2 ring-white dark:ring-slate-800">
                            {initials(c.authorName)}
                          </div>
                          <div className="flex-1 bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.authorName}</span>
                                {c.fromStatus && c.toStatus && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                    {c.fromStatus} → {c.toStatus}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                                {formatDateTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{c.body}</p>
                            {c.attachmentUrl && (
                              <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                                <Paperclip size={11} />
                                {c.attachmentName || 'View Attachment'}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add comment */}
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {initials(currentUser?.name ?? 'U')}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={commentDraft}
                        onChange={e => setCommentDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment() }}
                        placeholder="Add a comment… (Ctrl+Enter to send)"
                        rows={2}
                        className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-slate-400"
                      />
                      <div className="flex justify-end">
                        <button onClick={handleAddComment} disabled={!commentDraft.trim() || commentSending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                          <Send size={11} />
                          {commentSending ? 'Sending…' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
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
