import {
  LayoutDashboard, CalendarRange, FileText, Workflow, GanttChartSquare,
  TrendingUp, SlidersHorizontal, LogOut, Wifi, WifiOff,
  Camera, Aperture, X,
} from 'lucide-react'
import { useAppStore, type View } from '../../store/useAppStore'

const NAV_GROUPS = [
  {
    label: 'MAIN',
    items: [
      { id: 'dashboard' as View, label: 'Dashboard',  icon: LayoutDashboard },
      { id: 'calendar'  as View, label: 'Calendar',   icon: CalendarRange },
    ],
  },
  {
    label: 'WORK',
    items: [
      { id: 'joborders' as View, label: 'Job Orders', icon: FileText },
      { id: 'kanban'    as View, label: 'Pipeline',   icon: Workflow },
      { id: 'workload'  as View, label: 'Workload',   icon: GanttChartSquare },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { id: 'reports'  as View, label: 'Reports',  icon: TrendingUp },
      { id: 'settings' as View, label: 'Settings', icon: SlidersHorizontal },
    ],
  },
]

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { view, setView, currentUser, logout, isOnline } = useAppStore()

  function navigate(id: View) { setView(id); onClose() }

  return (
    <aside className={`
      sidebar-bg w-64 flex flex-col h-full shrink-0 z-30
      fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out
      lg:relative lg:translate-x-0
      ${open ? 'translate-x-0 slide-in-left' : '-translate-x-full'}
    `}>

      {/* ── Logo ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="logo-glow w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 flex items-center justify-center shrink-0 relative">
            <Camera size={15} className="text-white" strokeWidth={2.5} />
            {/* Aperture ring accent */}
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-sky-400 rounded-full flex items-center justify-center">
              <Aperture size={8} className="text-white" strokeWidth={3} />
            </span>
          </div>
          <div>
            <p className="gradient-text font-black text-sm tracking-tight leading-none">D&amp;AP</p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em] mt-0.5">Booking &amp; Workload</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="h-px mx-4 bg-slate-100 dark:bg-slate-700" />

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <span className="section-label">{group.label}</span>
            {group.items.map(({ id, label, icon: Icon }) => {
              const active = view === id
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    active
                      ? 'nav-active text-blue-700 dark:text-blue-300'
                      : 'nav-inactive hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon
                    size={16}
                    strokeWidth={active ? 2.5 : 2}
                    className={active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}
                  />
                  <span className={active ? 'font-semibold' : ''}>{label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 pulse-dot" />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="h-px mx-4 bg-slate-100 dark:bg-slate-700" />

      {/* ── Online status ─────────────────────────────── */}
      <div className="px-3 py-3">
        <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 font-medium ${
          isOnline
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800'
        }`}>
          {isOnline ? <Wifi size={12} strokeWidth={2.5} /> : <WifiOff size={12} strokeWidth={2.5} />}
          <span>{isOnline ? 'Online' : 'Offline mode'}</span>
          {isOnline && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />}
        </div>
      </div>

      {/* ── User card ─────────────────────────────────── */}
      <div className="px-3 pb-5">
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-2xl px-3 py-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm">
            {currentUser?.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{currentUser?.name}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{currentUser?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}

