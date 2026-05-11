import { useState, useMemo } from 'react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { usePermissions } from '../hooks/usePermissions'
import { ActivityBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { formatDate, formatDateTime, generateId, getNextStatus, isOverdue } from '../utils/helpers'
import type { JOStatus, JobOrder } from '../types'
import { db } from '../db/database'
import { Calendar, AlertTriangle, ChevronRight, Eye, Clock, LayoutList } from 'lucide-react'

const COLUMNS: { status: JOStatus; label: string; hex: string }[] = [
  { status: 'Pending',    label: 'Backlog',    hex: '#EAB308' },
  { status: 'Approved',   label: 'Approved',   hex: '#3B82F6' },
  { status: 'Scheduled',  label: 'Scheduled',  hex: '#6366F1' },
  { status: 'For Review', label: 'For Review', hex: '#F97316' },
  { status: 'Completed',  label: 'Completed',  hex: '#10B981' },
]

const STATUS_COLORS: Record<JOStatus, string> = {
  'Pending':    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  'Approved':   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Scheduled':  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'For Review': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Completed':  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Delayed':    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  'Cancelled':  'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

function KanbanCard({
  jo,
  onAdvance,
  onView,
  canProgress,
  resources,
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
        <button
          onClick={() => onView(jo)}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-dashed border-slate-200 dark:border-slate-600 hover:border-blue-300"
        >
          <Eye size={11} /> View
        </button>
        {canProgress && next && (
          <button
            onClick={() => onAdvance(jo)}
            className="flex-1 flex items-center justify-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400"
          >
            → {next}
          </button>
        )}
      </div>
    </div>
  )
}

type DetailTab = 'overview' | 'activity'

export function KanbanPage() {
  const { jobOrders, updateJobOrder, addStatusLog, addNotification, statusLogs } = useDataStore()
  const { currentUser, resources } = useAppStore()
  const { can } = usePermissions()
  const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [reactivateJO, setReactivateJO] = useState<JobOrder | null>(null)

  const canProgress = can('pipeline', 'move_cards')

  const columns = useMemo(
    () => COLUMNS.map((col) => ({ ...col, items: jobOrders.filter((j) => j.status === col.status) })),
    [jobOrders]
  )

  const delayed = useMemo(() => jobOrders.filter((j) => j.status === 'Delayed'), [jobOrders])
  const joLogs = selectedJO ? statusLogs.filter(l => l.joId === selectedJO.id) : []

  async function handleAdvance(jo: JobOrder) {
    const next = getNextStatus(jo.status)
    if (!next) return
    const updated: JobOrder = { ...jo, status: next, updatedAt: new Date().toISOString() }
    await db.jobOrders.put(updated)
    updateJobOrder(updated)

    const log = {
      id: generateId(), joId: jo.id, joNumber: jo.joNumber,
      fromStatus: jo.status, toStatus: next,
      changedBy: currentUser?.name ?? 'Unknown',
      changedAt: new Date().toISOString(), notes: '',
    }
    await db.statusLogs.add(log)
    addStatusLog(log)

    const notif = {
      id: generateId(), type: 'status_changed' as const,
      title: 'JO Moved', message: `${jo.joNumber} moved to "${next}"`,
      read: false, createdAt: new Date().toISOString(),
      targetUserId: jo.requesterId, joId: jo.id,
    }
    await db.notifications.add(notif)
    addNotification(notif)

    if (selectedJO?.id === jo.id) setSelectedJO(updated)
  }

  async function handleReactivate(jo: JobOrder, targetStatus: JOStatus) {
    const updated: JobOrder = { ...jo, status: targetStatus, updatedAt: new Date().toISOString() }
    await db.jobOrders.put(updated)
    updateJobOrder(updated)
    const log = {
      id: generateId(), joId: jo.id, joNumber: jo.joNumber,
      fromStatus: jo.status, toStatus: targetStatus,
      changedBy: currentUser?.name ?? 'Unknown',
      changedAt: new Date().toISOString(), notes: '',
    }
    await db.statusLogs.add(log)
    addStatusLog(log)
    setReactivateJO(null)
  }

  function openDetail(jo: JobOrder) { setSelectedJO(jo); setDetailTab('overview') }

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
                  <KanbanCard key={jo.id} jo={jo} onAdvance={handleAdvance} onView={openDetail} canProgress={canProgress} resources={resources} />
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
                        onClick={e => { e.stopPropagation(); setReactivateJO(jo) }}
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

      {/* ── Reactivate Modal ── */}
      <Modal
        open={!!reactivateJO}
        onClose={() => setReactivateJO(null)}
        title={reactivateJO ? `Move ${reactivateJO.joNumber} to…` : ''}
        maxWidth="max-w-sm"
      >
        {reactivateJO && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select the stage to move this job order to:</p>
            {(['Pending', 'Approved', 'Scheduled', 'For Review', 'Completed'] as JOStatus[]).map(status => {
              const col = COLUMNS.find(c => c.status === status)
              return (
                <button
                  key={status}
                  onClick={() => handleReactivate(reactivateJO, status)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col?.hex ?? '#94a3b8' }} />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">{status}</span>
                </button>
              )
            })}
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
            <div className="flex gap-1 border-b border-slate-100 dark:border-slate-700">
              {([['overview', 'Overview', LayoutList], ['activity', `Activity Log${joLogs.length ? ` (${joLogs.length})` : ''}`, Clock]] as [DetailTab, string, React.ElementType][]).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setDetailTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                    detailTab === id ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

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
                {canProgress && selectedJO.status !== 'Completed' && selectedJO.status !== 'Cancelled' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    {getNextStatus(selectedJO.status) && selectedJO.status !== 'Delayed' && (
                      <Button onClick={() => handleAdvance(selectedJO)}>
                        Move to {getNextStatus(selectedJO.status)} <ChevronRight size={14} />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

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
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

