import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser, JobOrder, CalendarEvent, Notification, StatusLog, Resource, ManagedUser, BookingRequest } from '../types'
import { USERS, RESOURCES } from '../data/seed'
import { supabase, rowToManagedUser, managedUserToRow } from '../lib/supabase'

export type View = 'dashboard' | 'calendar' | 'joborders' | 'kanban' | 'workload' | 'reports' | 'settings'

interface AppState {
  currentUser: AppUser | null
  isOnline: boolean
  view: View
  resources: Resource[]
  pendingSyncCount: number
  managedUsers: ManagedUser[]
  theme: 'light' | 'dark'
  globalSearch: string

  login: (email: string, password: string) => Promise<boolean>
  initUsers: () => Promise<void>
  logout: () => void
  setView: (v: View) => void
  setOnline: (v: boolean) => void
  setPendingSyncCount: (n: number) => void
  getResourceById: (id: string) => Resource | undefined
  getUserById: (id: string) => AppUser | undefined
  toggleTheme: () => void
  setGlobalSearch: (q: string) => void

  addManagedUser: (u: ManagedUser) => void
  updateManagedUser: (u: ManagedUser) => void
  terminateUser: (id: string) => void
  limitUser: (id: string) => void
  reinstateUser: (id: string) => void
  updateResource: (r: Resource) => void
  addResource: (r: Resource) => void
  requestAlert: BookingRequest | null
  setRequestAlert: (req: BookingRequest | null) => void
}

function seedManagedUsers(): ManagedUser[] {
  return USERS.map(u => ({
    ...u,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  }))
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isOnline: navigator.onLine,
      view: 'dashboard',
      resources: RESOURCES,
      pendingSyncCount: 0,
      managedUsers: seedManagedUsers(),
      theme: 'light',
      globalSearch: '',
      requestAlert: null,

      async login(email, password) {
        // Try Supabase first (cross-browser source of truth)
        try {
          const { data } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single()
          if (data) {
            if (data.password !== password) return false
            if (data.status === 'terminated') return false
            const mu = rowToManagedUser(data)
            // Sync to local store
            set(s => ({
              managedUsers: s.managedUsers.some(u => u.id === mu.id)
                ? s.managedUsers.map(u => u.id === mu.id ? mu : u)
                : [...s.managedUsers, mu],
            }))
            set({ currentUser: { id: mu.id, name: mu.name, email: mu.email, password: mu.password, role: mu.role, team: mu.team, avatar: mu.avatar, resourceId: mu.resourceId } })
            return true
          }
        } catch { /* offline — fall through to local */ }
        // Offline fallback: check local managedUsers
        const { managedUsers } = get()
        const managed = managedUsers.find(
          u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        )
        if (managed) {
          if (managed.status === 'terminated') return false
          set({ currentUser: { id: managed.id, name: managed.name, email: managed.email, password: managed.password, role: managed.role, team: managed.team, avatar: managed.avatar, resourceId: managed.resourceId } })
          return true
        }
        return false
      },

      logout() { set({ currentUser: null, view: 'dashboard' }) },
      async initUsers() {
        try {
          const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: true })
          if (!error && data && data.length > 0) {
            set({ managedUsers: data.map(rowToManagedUser) })
          }
        } catch { /* offline — keep local */ }
      },
      setView(v) { set({ view: v }) },
      setOnline(v) { set({ isOnline: v }) },
      setPendingSyncCount(n) { set({ pendingSyncCount: n }) },
      getResourceById(id) { return get().resources.find(r => r.id === id) },
      getUserById(id) { return USERS.find(u => u.id === id) },
      toggleTheme() {
        set(s => {
          const next = s.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        })
      },
      setGlobalSearch(q) { set({ globalSearch: q }) },

      addManagedUser(u) {
        set(s => ({ managedUsers: [...s.managedUsers, u] }))
        supabase.from('app_users').insert(managedUserToRow(u)).then(({ error }) => { if (error) console.error('User sync error:', error) })
      },
      updateManagedUser(u) {
        set(s => ({ managedUsers: s.managedUsers.map(m => m.id === u.id ? u : m) }))
        const cur = get().currentUser
        if (cur?.id === u.id) {
          set({ currentUser: { ...cur, name: u.name, role: u.role, email: u.email, avatar: u.avatar } })
        }
        supabase.from('app_users').update(managedUserToRow(u)).eq('id', u.id).then(({ error }) => { if (error) console.error('User sync error:', error) })
      },
      terminateUser(id) {
        set(s => ({ managedUsers: s.managedUsers.map(m => m.id === id ? { ...m, status: 'terminated' } : m) }))
        supabase.from('app_users').update({ status: 'terminated' }).eq('id', id).then(({ error }) => { if (error) console.error('User sync error:', error) })
      },
      limitUser(id) {
        set(s => ({ managedUsers: s.managedUsers.map(m => m.id === id ? { ...m, status: 'limited' } : m) }))
        supabase.from('app_users').update({ status: 'limited' }).eq('id', id).then(({ error }) => { if (error) console.error('User sync error:', error) })
      },
      reinstateUser(id) {
        set(s => ({ managedUsers: s.managedUsers.map(m => m.id === id ? { ...m, status: 'active' } : m) }))
        supabase.from('app_users').update({ status: 'active' }).eq('id', id).then(({ error }) => { if (error) console.error('User sync error:', error) })
      },
      updateResource(r) {
        set(s => ({ resources: s.resources.map(x => x.id === r.id ? r : x) }))
      },
      addResource(r) {
        set(s => ({ resources: [...s.resources, r] }))
      },
      setRequestAlert(req) { set({ requestAlert: req }) },
    }),
    {
      name: 'dap-flow-auth',
      partialize: s => ({ currentUser: s.currentUser, view: s.view, managedUsers: s.managedUsers, theme: s.theme, resources: s.resources }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.classList.toggle('dark', state.theme === 'dark')
        }
        // Migrate old letter-based avatars (e.g. "AR", "JL") to emoji
        const isLetters = (av: string) => /^[A-Z]{1,4}$/.test(av ?? '')
        if (state?.managedUsers) {
          state.managedUsers = state.managedUsers.map(u => {
            if (isLetters(u.avatar)) {
              const seed = USERS.find(s => s.id === u.id)
              return { ...u, avatar: seed?.avatar ?? '😊' }
            }
            return u
          })
        }
        // Keep currentUser avatar in sync with managedUsers
        if (state?.currentUser) {
          const managed = state.managedUsers?.find(u => u.id === state.currentUser!.id)
          if (managed) {
            state.currentUser = { ...state.currentUser, avatar: managed.avatar }
          } else if (isLetters(state.currentUser.avatar)) {
            const seed = USERS.find(u => u.id === state.currentUser!.id)
            state.currentUser = { ...state.currentUser, avatar: seed?.avatar ?? '😊' }
          }
        }
      },
    }
  )
)

// ── Data store (reactive in-memory, backed by Dexie) ─────────────────────────
interface DataState {
  jobOrders: JobOrder[]
  calendarEvents: CalendarEvent[]
  notifications: Notification[]
  statusLogs: StatusLog[]
  bookingRequests: BookingRequest[]
  seeded: boolean

  setJobOrders: (jos: JobOrder[]) => void
  addJobOrder: (jo: JobOrder) => void
  updateJobOrder: (jo: JobOrder) => void

  setCalendarEvents: (evs: CalendarEvent[]) => void
  addCalendarEvent: (ev: CalendarEvent) => void
  updateCalendarEvent: (ev: CalendarEvent) => void
  removeCalendarEvent: (id: string) => void

  setNotifications: (ns: Notification[]) => void
  addNotification: (n: Notification) => void
  markNotificationRead: (id: string) => void
  markAllRead: (userId: string) => void

  setStatusLogs: (logs: StatusLog[]) => void
  addStatusLog: (log: StatusLog) => void
  setSeeded: (v: boolean) => void

  setBookingRequests: (reqs: BookingRequest[]) => void
  addBookingRequest: (req: BookingRequest) => void
  updateBookingRequest: (req: BookingRequest) => void
}

export const useDataStore = create<DataState>()((set) => ({
  jobOrders: [],
  calendarEvents: [],
  notifications: [],
  statusLogs: [],
  bookingRequests: [],
  seeded: false,

  setJobOrders: jos => set({ jobOrders: jos }),
  addJobOrder: jo => set(s => ({ jobOrders: [jo, ...s.jobOrders] })),
  updateJobOrder: jo => set(s => ({ jobOrders: s.jobOrders.map(j => j.id === jo.id ? jo : j) })),

  setCalendarEvents: evs => set({ calendarEvents: evs }),
  addCalendarEvent: ev => set(s => ({ calendarEvents: [...s.calendarEvents, ev] })),
  updateCalendarEvent: ev => set(s => ({ calendarEvents: s.calendarEvents.map(e => e.id === ev.id ? ev : e) })),
  removeCalendarEvent: id => set(s => ({ calendarEvents: s.calendarEvents.filter(e => e.id !== id) })),

  setNotifications: ns => set({ notifications: ns }),
  addNotification: n => set(s => ({ notifications: [n, ...s.notifications] })),
  markNotificationRead: id => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  markAllRead: userId => set(s => ({ notifications: s.notifications.map(n => n.targetUserId === userId ? { ...n, read: true } : n) })),

  setStatusLogs: logs => set({ statusLogs: logs }),
  addStatusLog: log => set(s => ({ statusLogs: [log, ...s.statusLogs] })),
  setSeeded: v => set({ seeded: v }),

  setBookingRequests: reqs => set({ bookingRequests: reqs }),
  addBookingRequest: req => set(s => ({ bookingRequests: [req, ...s.bookingRequests] })),
  updateBookingRequest: req => set(s => ({ bookingRequests: s.bookingRequests.map(r => r.id === req.id ? req : r) })),
}))
