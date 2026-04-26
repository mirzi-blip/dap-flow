import { useEffect } from 'react'
import { useAppStore, useDataStore } from './store/useAppStore'
import { db } from './db/database'
import { supabase, rowToRequest, rowToJobOrder } from './lib/supabase'
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

let _initStarted = false

export default function App() {
  // Public route: show booking form without login
  if (window.location.pathname === '/request') {
    return <BookingRequestForm />
  }

  const { currentUser, view, setOnline, setPendingSyncCount, theme, requestAlert, setRequestAlert, setView } = useAppStore()

  // Load users from Supabase on startup (cross-browser sync)
  useEffect(() => {
    useAppStore.getState().initUsers()
  }, [])

  // Sync theme class to <html> so Tailwind dark: variants work
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  const {
    setJobOrders, setCalendarEvents, setNotifications,
    setStatusLogs, seeded, setSeeded, setBookingRequests,
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
        updateBookingRequest(rowToRequest(payload.new as Record<string, unknown>))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_orders' }, payload => {
        addJobOrder(rowToJobOrder(payload.new as Record<string, unknown>))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_orders' }, payload => {
        updateJobOrder(rowToJobOrder(payload.new as Record<string, unknown>))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!currentUser) return <LoginPage />

  return (
    <>
    {requestAlert && (
      <div className="fixed bottom-5 right-5 z-[9999] w-80 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-2xl shadow-2xl overflow-hidden animate-slide-in">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between">
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
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
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
