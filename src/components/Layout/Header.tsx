import { useState } from 'react'
import { Bell, Search, Menu, Moon, Sun } from 'lucide-react'
import { useAppStore, useDataStore, type View } from '../../store/useAppStore'
import { formatDateTime } from '../../utils/helpers'

const notifIcons: Record<string, string> = {
  booking_confirmed: '📅', schedule_changed: '🔄', deadline_reminder: '⏰',
  conflict_alert: '⚠️', approval_notification: '✅', status_changed: '🔀',
}

const viewMeta: Record<View, { title: string }> = {
  dashboard: { title: "Today's Operations Overview" },
  calendar:  { title: 'Booking Calendar' },
  joborders: { title: 'Job Orders' },
  kanban:    { title: 'Production Pipeline' },
  workload:  { title: 'Workload & Capacity' },
  reports:   { title: 'Reports & Analytics' },
  settings:  { title: 'Settings' },
}

interface HeaderProps { onMenuToggle: () => void }

export function Header({ onMenuToggle }: HeaderProps) {
  const { view, currentUser, theme, toggleTheme, globalSearch, setGlobalSearch } = useAppStore()
  const { notifications, markNotificationRead, markAllRead } = useDataStore()
  const [notifOpen, setNotifOpen] = useState(false)

  const myNotifs = notifications.filter(n => n.targetUserId === currentUser?.id)
  const unread = myNotifs.filter(n => !n.read).length
  const { title } = viewMeta[view]

  return (
    <header className="h-[64px] bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6 shrink-0 z-10 gap-3">

      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0"
        >
          <Menu size={18} />
        </button>
        <h1 className="hidden sm:block text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
          {title}
        </h1>
      </div>

      {/* Center: search */}
      <div className="search-bar flex-1 max-w-xs lg:max-w-sm">
        <Search size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          placeholder="Search job orders..."
          className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none flex-1 min-w-0"
        />
        <kbd className="hidden lg:flex items-center text-[10px] bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-md px-1.5 py-0.5 text-slate-400 dark:text-slate-400 font-mono shrink-0">
          ⌘F
        </kbd>
      </div>

      {/* Right: theme, bell, user */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden" style={{ width: 360 }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 dark:border-slate-700">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Notifications
                    {unread > 0 && <span className="ml-2 text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5">{unread}</span>}
                  </p>
                  {unread > 0 && (
                    <button onClick={() => currentUser && markAllRead(currentUser.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-semibold">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
                  {myNotifs.length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-400 text-sm">No notifications</div>
                  ) : myNotifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/20' : ''}`}
                    >
                      <span className="text-lg shrink-0 mt-0.5">{notifIcons[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${!n.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-100 dark:bg-slate-700 mx-0.5" />

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
            {currentUser?.avatar}
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">{currentUser?.name}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">{currentUser?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

