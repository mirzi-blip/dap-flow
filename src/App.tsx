import { useEffect } from 'react'
import { useAppStore, useDataStore } from './store/useAppStore'
import { db } from './db/database'
import { supabase, rowToRequest, rowToJobOrder, probeEstimatedHoursColumn } from './lib/supabase'
import { generateId, getServiceApprovers } from './utils/helpers'
import {
  SEED_JOB_ORDERS,
  SEED_CALENDAR_EVENTS,
  SEED_NOTIFICATIONS,
  SEED_STATUS_LOGS,
} from './data/seed'
import { Layout } from './components/Layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { JobOrdersPage } from './pages/JobOrdersPage'
import { KanbanPage } from './pages/KanbanPage'
import { ReportsPage } from './pages/ReportsPage'
import { WorkloadPage } from './pages/WorkloadPage'
import { SettingsPage } from './pages/SettingsPage'
import { BookingRequestForm } from './pages/BookingRequestForm'
import { UpdateBanner } from './components/UpdateBanner'

let _initStarted = false

export default function App() {
  // Public route: show booking form without login
  if (window.location.pathname === '/request') {
    return <><BookingRequestForm /><UpdateBanner /></>
  }

  const { currentUser, view, setOnline, setPendingSyncCount, theme, requestAlert, setRequestAlert, setView, showPasswordExpiry, setShowPasswordExpiry, setPasswordLastChanged } = useAppStore()

  // Load users and resources from Supabase on startup (cross-browser sync)
  useEffect(() => {
    useAppStore.getState().initUsers()
    useAppStore.getState().initResources()
    useAppStore.getState().initFormOptions()
    useAppStore.getState().initApprovers()
    probeEstimatedHoursColumn()
  }, [])

  // Deep-link from coordinator emails: "/?view=requests" lands on Job Orders →
  // Requests (the Requests tab is selected by JobOrdersPage from the same param).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'requests') {
      setView('joborders')
    }
  }, [])

  // Sync theme class to <html> so Tailwind dark: variants work
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  const {
    setJobOrders, setCalendarEvents, setNotifications,
    setStatusLogs, seeded, setSeeded, setBookingRequests, addNotification,
  } = useDataStore()

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      flushSyncQueue()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Stub sync flush — in production this would push to an API
  async function flushSyncQueue() {
    const pending = await db.syncQueue.where('synced').equals(0 as any).toArray()
    if (!pending.length) return
    setPendingSyncCount(pending.length)
    // Simulate API calls
    await new Promise((r) => setTimeout(r, 1200))
    await db.syncQueue.where('synced').equals(0 as any).modify({ synced: true })
    setPendingSyncCount(0)
  }

  // ── Auto-flag overdue JOs ───────────────────────────────────────────────────
  // A JO is overdue when its deadline date is strictly before today (end of
  // business day still counts as on-time). Runs on load and every 30 minutes.
  async function autoFlagOverdueJOs() {
    // Start of today in local time → compare dates fairly, not datetimes
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: activeJOs } = await supabase
      .from('job_orders')
      .select('id, deadline, status')
      .not('status', 'in', '("Completed","Cancelled","Delayed")')

    const overdueIds = (activeJOs ?? [])
      .filter(j => j.deadline && new Date(j.deadline as string) < todayStart)
      .map(j => j.id as string)

    if (overdueIds.length === 0) return

    const now = new Date().toISOString()
    for (const id of overdueIds) {
      await supabase.from('job_orders').update({ status: 'Delayed', updated_at: now }).eq('id', id)
    }

    // Reload all JOs so the UI reflects the new statuses
    const { data: refreshed } = await supabase
      .from('job_orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (refreshed) setJobOrders(refreshed.map(rowToJobOrder))
  }

  // Initialize DB — seed if empty, then load into UI state
  useEffect(() => {
    if (_initStarted) return
    _initStarted = true

    async function init() {
      // Seed local-only data (calendar, notifications, status logs)
      const count = await db.jobOrders.count()
      if (count === 0) {
        await db.transaction('rw', [db.calendarEvents, db.notifications, db.statusLogs], async () => {
          await db.calendarEvents.bulkPut(SEED_CALENDAR_EVENTS)
          await db.notifications.bulkPut(SEED_NOTIFICATIONS)
          await db.statusLogs.bulkPut(SEED_STATUS_LOGS)
        })
      }

      const [evs, notifs, logs] = await Promise.all([
        db.calendarEvents.toArray(),
        db.notifications.orderBy('createdAt').reverse().toArray(),
        db.statusLogs.orderBy('changedAt').reverse().toArray(),
      ])
      setCalendarEvents(evs)
      setNotifications(notifs)
      setStatusLogs(logs)

      // Load job orders from Supabase; seed if empty
      const { data: joRows } = await supabase
        .from('job_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if ((joRows ?? []).length === 0) {
        const { data: inserted } = await supabase
          .from('job_orders')
          .insert(SEED_JOB_ORDERS.map(jo => ({
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
          })))
          .select()
        setJobOrders((inserted ?? []).map(rowToJobOrder))
      } else {
        setJobOrders((joRows ?? []).map(rowToJobOrder))
      }

      // Load booking requests from Supabase
      const { data: bookingRows } = await supabase
        .from('booking_requests')
        .select('*')
        .order('created_at', { ascending: false })
      setBookingRequests((bookingRows ?? []).map(rowToRequest))

      // Auto-flag overdue JOs (initial run)
      await autoFlagOverdueJOs()

      // 3-day unacted booking request notification
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: unacted } = await supabase.from('booking_requests').select('id').eq('status', 'Pending Approval').lt('created_at', threeDaysAgo)
      if (unacted && unacted.length > 0) {
        // Check if we already have a recent unacted notification (avoid duplicates)
        const existingAlerts = await db.notifications.where('type').equals('conflict_alert').and(n => n.message.includes('pending approval')).toArray()
        const recentAlert = existingAlerts.find(n => {
          const created = new Date(n.createdAt)
          const hoursSince = (Date.now() - created.getTime()) / 3600000
          return hoursSince < 24 // Only suppress if alert was sent in last 24h
        })
        if (!recentAlert) {
          const notif = {
            id: generateId(),
            type: 'conflict_alert' as const,
            title: `${unacted.length} Request${unacted.length > 1 ? 's' : ''} Need Action`,
            message: `${unacted.length} booking request${unacted.length > 1 ? 's have' : ' has'} been pending approval for more than 3 days. Please follow up with the approver.`,
            read: false,
            createdAt: new Date().toISOString(),
            targetUserId: 'u1',
          }
          await db.notifications.add(notif)
          addNotification(notif)
        }
      }

      setSeeded(true)
    }

    init().catch(console.error)
  }, [])

  // Real-time: new/updated booking requests and job orders appear instantly
  useEffect(() => {
    const { addBookingRequest, updateBookingRequest, addJobOrder, updateJobOrder } = useDataStore.getState()
    const channel = supabase
      .channel('realtime-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_requests' }, payload => {
        const req = rowToRequest(payload.new as Record<string, unknown>)
        addBookingRequest(req)
        useAppStore.getState().setRequestAlert(req)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_requests' }, payload => {
        const req = rowToRequest(payload.new as Record<string, unknown>)
        const prev = useDataStore.getState().bookingRequests.find(r => r.id === req.id)
        updateBookingRequest(req)
        // Approver just approved (Pending Approval → Pending Review): notify the
        // configured coordinator in-app. Each client reacts to the synced event,
        // so only the coordinator's own session creates their notification.
        if (req.status === 'Pending Review' && prev && prev.status !== 'Pending Review') {
          const st = useAppStore.getState()
          const cur = st.currentUser
          const svcApprovers = getServiceApprovers(st.approvers, req.activityType)
          if (cur && svcApprovers.some(a => a.email.toLowerCase() === cur.email.toLowerCase())) {
            const notif = {
              id: generateId(),
              type: 'approval_notification' as const,
              title: 'Request Approved — Ready to Assign',
              message: `${req.activityType} from ${req.preparedBy} (${req.department}) was approved and is ready to assign.`,
              read: false,
              createdAt: new Date().toISOString(),
              targetUserId: cur.id,
            }
            db.notifications.add(notif)
            useDataStore.getState().addNotification(notif)
          }
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_orders' }, payload => {
        addJobOrder(rowToJobOrder(payload.new as Record<string, unknown>))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_orders' }, payload => {
        updateJobOrder(rowToJobOrder(payload.new as Record<string, unknown>))
      })
      .subscribe()

    // Re-check for newly overdue JOs every 30 minutes while app is open
    const overdueInterval = setInterval(autoFlagOverdueJOs, 30 * 60 * 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(overdueInterval)
    }
  }, [])

  if (!currentUser) return <><LoginPage /><UpdateBanner /></>

  return (
    <>
    <UpdateBanner />
    {showPasswordExpiry && currentUser && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Password Update Recommended</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Your password is over 90 days old. For security, please update it. You can also waive this reminder for now.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setPasswordLastChanged(currentUser.id, new Date().toISOString())
                setShowPasswordExpiry(false)
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Waive for now
            </button>
            <button
              onClick={() => {
                setShowPasswordExpiry(false)
                setView('settings')
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              Change Password →
            </button>
          </div>
        </div>
      </div>
    )}
    {requestAlert && (
      <div className="fixed bottom-5 right-5 z-[9999] w-80 bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-700 rounded-2xl shadow-2xl overflow-hidden animate-slide-in">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p className="text-white text-xs font-bold uppercase tracking-wide">New Booking Request</p>
          </div>
          <button onClick={() => setRequestAlert(null)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-3 space-y-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{requestAlert.activityType}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">From <span className="font-semibold text-slate-700 dark:text-slate-300">{requestAlert.preparedBy}</span> · {requestAlert.department}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Needed by {requestAlert.neededDate}</p>
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => { setView('joborders'); setRequestAlert(null) }}
            className="flex-1 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Review Request →
          </button>
          <button onClick={() => setRequestAlert(null)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    )}
    <Layout>
      {view === 'dashboard' && <DashboardPage />}
      {view === 'calendar' && <CalendarPage />}
      {view === 'joborders' && <JobOrdersPage />}
      {view === 'kanban' && <KanbanPage />}
      {view === 'reports' && <ReportsPage />}
      {view === 'workload' && <WorkloadPage />}
      {view === 'settings' && <SettingsPage />}
    </Layout>
    </>
  )
}
