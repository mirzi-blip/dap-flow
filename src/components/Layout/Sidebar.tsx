import {
  LayoutDashboard, CalendarRange, FileText, Workflow, GanttChartSquare,
  TrendingUp, SlidersHorizontal, LogOut, Wifi, WifiOff,
  Camera, Aperture, X,
} from 'lucide-react'
import { useAppStore, type View } from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'

const NAV_GROUPS = [
  {
    label: 'MAIN',
    items: [
      { id: 'dashboard' as View, label: 'Dashboard',  icon: LayoutDashboard, module: 'dashboard' },
      { id: 'calendar'  as View, label: 'Calendar',   icon: CalendarRange,   module: 'calendar'  },
    ],
  },
  {
    label: 'WORK',
    items: [
      { id: 'joborders' as View, label: 'Job Orders', icon: FileText,          module: 'job_orders' },
      { id: 'kanban'    as View, label: 'Pipeline',   icon: Workflow,          module: 'pipeline'   },
      { id: 'workload'  as View, label: 'Workload',   icon: GanttChartSquare,  module: 'workload'   },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { id: 'reports'  as View, label: 'Reports',  icon: TrendingUp,       module: 'reports'   },
      { id: 'settings' as View, label: 'Settings', icon: SlidersHorizontal, module: 'settings'  },
    ],
  },
]

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { view, setView, currentUser, logout, isOnline } = useAppStore()
  const { canView, can } = usePermissions()

  // Settings has no "view" action — gate it on any settings permission instead
  function canViewModule(module: string): boolean {
    if (module === 'settings') {
      return can('settings', 'view_profile') || can('settings', 'view_users') || can('settings', 'manage_users') || can('settings', 'manage_team') || can('settings', 'manage_permissions') || can('settings', 'manage_integrations')
    }
    return canView(module)
  }

  function navigate(id: View) { setView(id); onClose() }

  return (
    <aside className={`
      w-64 flex flex-col h-full shrink-0 z-30
      fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out
      lg:relative lg:translate-x-0
      ${open ? 'translate-x-0 slide-in-left' : '-translate-x-full'}
    `}
      style={{ background: 'linear-gradient(160deg, #111D3B 0%, #1B2F5E 45%, #24346B 100%)' }}
    >

      {/* ── Logo ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="DAP Flow" className="w-10 h-10 shrink-0 rounded-xl shadow-lg shadow-brand-900/30" />
          <div>
            <p className="font-black text-sm tracking-tight leading-none text-white">DAP Flow</p>
            <p className="text-[9px] text-brand-300/70 uppercase tracking-[0.14em] mt-0.5">Booking &amp; Workload</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 text-brand-300/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="h-px mx-4 bg-white/10" />

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-300/40 px-3 mb-1 mt-5 block">
              {group.label}
            </span>
            {group.items.filter(item => canViewModule(item.module)).map(({ id, label, icon: Icon }) => {
              const active = view === id
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    active
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-brand-200/70 hover:text-white'
                  }`}
                  style={active ? { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' } : undefined}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                >
                  {active && (
                    <span className="absolute left-0 w-1 h-6 rounded-r-full bg-brand-400 shadow-[0_0_8px_rgba(139,159,232,0.8)]" />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={active ? 2.5 : 2}
                    className={active ? 'text-brand-300' : 'text-brand-400/50'}
                  />
                  <span className={active ? 'font-semibold' : ''}>{label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 pulse-dot shadow-[0_0_6px_rgba(139,159,232,0.9)]" />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="h-px mx-4 bg-white/10" />

      {/* ── Online status ─────────────────────────────── */}
      <div className="px-3 py-3">
        <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 font-medium ${
          isOnline
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
            : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
        }`}>
          {isOnline ? <Wifi size={12} strokeWidth={2.5} /> : <WifiOff size={12} strokeWidth={2.5} />}
          <span>{isOnline ? 'Online' : 'Offline mode'}</span>
          {isOnline && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />}
        </div>
      </div>

      {/* ── User card ─────────────────────────────────── */}
      <div className="px-3 pb-5">
        <div className="flex items-center gap-2.5 bg-white/8 border border-white/10 rounded-2xl px-3 py-3"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-lg shrink-0 overflow-hidden">
            {(currentUser?.avatar?.startsWith('data:') || currentUser?.avatar?.startsWith('http'))
              ? <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              : currentUser?.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
            <p className="text-[10px] text-brand-300/60 truncate">{currentUser?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-brand-300/40 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
