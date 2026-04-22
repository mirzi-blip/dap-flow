import { useEffect } from 'react'
import { useAppStore, useDataStore } from './store/useAppStore'
import { db } from './db/database'
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

  const { currentUser, view, setOnline, setPendingSyncCount, theme } = useAppStore()

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
      const count = await db.jobOrders.count()
      if (count === 0) {
        await db.transaction('rw', [db.jobOrders, db.calendarEvents, db.notifications, db.statusLogs], async () => {
          await db.jobOrders.bulkPut(SEED_JOB_ORDERS)
          await db.calendarEvents.bulkPut(SEED_CALENDAR_EVENTS)
          await db.notifications.bulkPut(SEED_NOTIFICATIONS)
          await db.statusLogs.bulkPut(SEED_STATUS_LOGS)
        })
      }

      const [jos, evs, notifs, logs] = await Promise.all([
        db.jobOrders.orderBy('createdAt').reverse().toArray(),
        db.calendarEvents.toArray(),
        db.notifications.orderBy('createdAt').reverse().toArray(),
        db.statusLogs.orderBy('changedAt').reverse().toArray(),
      ])
      setJobOrders(jos)
      setCalendarEvents(evs)
      setNotifications(notifs)
      setStatusLogs(logs)

      const bookingReqs = await db.bookingRequests.orderBy('createdAt').reverse().toArray()
      setBookingRequests(bookingReqs)

      setSeeded(true)
    }

    init().catch(console.error)
  }, [])

  if (!currentUser) return <LoginPage />

  return (
    <Layout>
      {view === 'dashboard' && <DashboardPage />}
      {view === 'calendar' && <CalendarPage />}
      {view === 'joborders' && <JobOrdersPage />}
      {view === 'kanban' && <KanbanPage />}
      {view === 'reports' && <ReportsPage />}
      {view === 'workload' && <WorkloadPage />}
      {view === 'settings' && <SettingsPage />}
    </Layout>
  )
}
