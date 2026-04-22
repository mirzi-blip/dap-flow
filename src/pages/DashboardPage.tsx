import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  AlertTriangle, CheckCircle2, Clock, Zap, ArrowRight,
  Plus, ClipboardList, Camera, Video, Mic, Palette, Scissors, Headphones,
  CalendarClock, TrendingUp, ArrowUpRight, Ban,
} from 'lucide-react'
import { useAppStore, useDataStore } from '../store/useAppStore'
import { RESOURCES } from '../data/seed'
import { activityCalendarColors, teamColors } from '../utils/colors'
import type { JOStatus, ActivityType } from '../types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const statusBadge: Record<JOStatus, string> = {
  'Pending':     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Approved':    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Scheduled':   'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  'In Progress': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'For Review':  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  'Completed':   'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Delayed':     'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  'Cancelled':   'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

const activityIcon: Record<ActivityType, React.ElementType> = {
  'Photo Shoot':           Camera,
  'Video Shoot':           Video,
  'Static Artwork Design': Palette,
  'Video Editing':         Scissors,
  'Audio Recording':       Mic,
  'Audio Editing':         Headphones,
}

export function DashboardPage() {
  const { setView, theme } = useAppStore()
  const { jobOrders, calendarEvents } = useDataStore()
  const isDark = theme === 'dark'

  // KPI counts
  const totalJOs      = jobOrders.length
  const activeJOs     = jobOrders.filter(j => !['Completed','Cancelled','Delayed'].includes(j.status)).length
  const pendingJOs    = jobOrders.filter(j => j.status === 'Pending').length
  const approvedJOs   = jobOrders.filter(j => j.status === 'Approved').length
  const scheduledJOs  = jobOrders.filter(j => j.status === 'Scheduled').length
  const inProgressJOs = jobOrders.filter(j => j.status === 'In Progress').length
  const forReviewJOs  = jobOrders.filter(j => j.status === 'For Review').length
  const completedJOs  = jobOrders.filter(j => j.status === 'Completed').length
  const delayedJOs    = jobOrders.filter(j => j.status === 'Delayed').length
  const cancelledJOs  = jobOrders.filter(j => j.status === 'Cancelled').length

  // Status breakdown config
  const STATUS_BREAKDOWN = [
    { label: 'Pending',     count: pendingJOs,    color: '#F59E0B' },
    { label: 'Approved',    count: approvedJOs,   color: '#3B82F6' },
    { label: 'Scheduled',   count: scheduledJOs,  color: '#6366F1' },
    { label: 'In Progress', count: inProgressJOs, color: '#8B5CF6' },
    { label: 'For Review',  count: forReviewJOs,  color: '#F97316' },
    { label: 'Completed',   count: completedJOs,  color: '#10B981' },
    { label: 'Delayed',     count: delayedJOs,    color: '#EF4444' },
    { label: 'Cancelled',   count: cancelledJOs,  color: '#94A3B8' },
  ]

  // Team workload heatmap (per wireframe ROW 2)
  const teamWorkload = useMemo(() => {
    const teams = ['Photo', 'Video', 'Audio', 'Design'] as const
    return teams.map(team => {
      const members = RESOURCES.filter(r => r.team === team)
      const totalActive = jobOrders.filter(j =>
        !['Completed','Cancelled','Delayed'].includes(j.status) &&
        members.some(m => j.assignedMemberIds.includes(m.id))
      ).length
      const avgUtil = members.length
        ? Math.round(members.reduce((acc, r) => {
            const active = jobOrders.filter(jo =>
              jo.assignedMemberIds.includes(r.id) &&
              !['Completed','Delayed','Cancelled'].includes(jo.status)
            ).length
            return acc + Math.min(100, Math.round((active / 5) * 100))
          }, 0) / members.length)
        : 0
      const color = teamColors[team]
      return { team, util: avgUtil, totalActive, members: members.length, color }
    })
  }, [jobOrders])

  // Today's schedule snapshot (per wireframe ROW 3)
  const todaySchedule = useMemo(() => {
    const today = new Date().toDateString()
    return calendarEvents
      .filter(e => new Date(e.startDate).toDateString() === today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 6)
  }, [calendarEvents])

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1)
      const count = jobOrders.filter(j => {
        const c = new Date(j.createdAt)
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
      }).length
      return { label: MONTHS[d.getMonth()], count, current: i === 6 }
    })
  }, [jobOrders])

  // Alerts (per wireframe ROW 4)
  const overbookedTeams = teamWorkload.filter(t => t.util > 90)
  const nearDeadline = jobOrders.filter(j => {
    if (['Completed','Cancelled'].includes(j.status)) return false
    const d = Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86400_000)
    return d >= 0 && d <= 5
  }).length

  // Recent JOs
  const recentJOs = useMemo(() => jobOrders.slice(0, 6), [jobOrders])

  // Donut data
  const activityMix = useMemo(() => {
    const map: Record<string, number> = {}
    jobOrders.filter(j => !['Cancelled'].includes(j.status)).forEach(j => {
      map[j.activityType] = (map[j.activityType] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [jobOrders])

  const PIE_COLORS = ['#7C3AED','#EC4899','#F97316','#10B981','#3B82F6','#F59E0B']

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, fontSize: 12, padding: '8px 12px',
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  return (
    <div className="space-y-4 lg:space-y-5 max-w-[1400px]">

      {/* Page heading + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-slate-100">Today's Operations Overview</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setView('calendar')} className="btn-secondary text-xs px-3 py-2">
            View Schedule
          </button>
          <button onClick={() => setView('joborders')} className="btn-primary text-xs px-3 py-2">
            <Plus size={13} /> New Job Order
          </button>
        </div>
      </div>

      {/* ── ROW 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total JOs — hero card */}
        <div className="kpi-card-hero col-span-2 lg:col-span-1 cursor-pointer" onClick={() => setView('joborders')}>
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold text-blue-200">Total JOs</p>
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ArrowUpRight size={16} className="text-white" />
            </div>
          </div>
          <p className="text-5xl font-black text-white leading-none">{totalJOs}</p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <TrendingUp size={10} /> All job orders
            </span>
          </div>
        </div>

        {/* Active */}
        <div className="kpi-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('kanban')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Zap size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{activeJOs}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">In pipeline</p>
          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${totalJOs > 0 ? (activeJOs / totalJOs) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Completed */}
        <div className="kpi-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('reports')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Completed</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{completedJOs}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {totalJOs > 0 ? Math.round((completedJOs / totalJOs) * 100) : 0}% completion rate
          </p>
          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${totalJOs > 0 ? (completedJOs / totalJOs) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Delayed / Cancelled */}
        <div className="kpi-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView('joborders')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Delayed / Cancelled</p>
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-500 dark:text-red-400" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{delayedJOs + cancelledJOs}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {delayedJOs} delayed · {cancelledJOs} cancelled
          </p>
          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-red-400 transition-all duration-700"
              style={{ width: `${totalJOs > 0 ? ((delayedJOs + cancelledJOs) / totalJOs) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* ── Status Breakdown ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Status Breakdown</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">All {totalJOs} job orders distributed across statuses</p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="h-5 rounded-full overflow-hidden flex mb-4 bg-slate-100 dark:bg-slate-700">
          {totalJOs === 0 ? (
            <div className="h-full w-full bg-slate-200 dark:bg-slate-600 rounded-full" />
          ) : (
            STATUS_BREAKDOWN.filter(s => s.count > 0).map(s => (
              <div
                key={s.label}
                className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(s.count / totalJOs) * 100}%`,
                  background: s.color,
                }}
                title={`${s.label}: ${s.count}`}
              />
            ))
          )}
        </div>

        {/* Mini stat chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_BREAKDOWN.map(s => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/60 border border-slate-100 dark:border-slate-700"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{s.label}</span>
              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 2: WORKLOAD HEATMAP (per PDF wireframe) ─────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Team Workload Heatmap</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Capacity utilization per team · Highlight if &gt;90% (Overloaded)</p>
          </div>
          <button onClick={() => setView('workload')} className="btn-ghost">
            Full view <ArrowRight size={12} />
          </button>
        </div>
        <div className="space-y-3">
          {teamWorkload.map(t => {
            const overloaded = t.util > 90
            return (
              <div key={t.team} className="flex items-center gap-4">
                {/* Team label */}
                <div className="flex items-center gap-2 w-28 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: t.color.hex }} />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.team} Team</p>
                </div>
                {/* Bar */}
                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                    style={{
                      width: `${t.util}%`,
                      background: overloaded
                        ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                        : `linear-gradient(90deg, ${t.color.hex}cc, ${t.color.hex})`,
                    }}
                  >
                    {t.util > 20 && (
                      <span className="text-[10px] font-bold text-white">{t.util}%</span>
                    )}
                  </div>
                  {t.util <= 20 && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 dark:text-slate-400">{t.util}%</span>
                  )}
                </div>
                {/* Status */}
                <div className="w-28 shrink-0 flex items-center gap-1.5">
                  {overloaded ? (
                    <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                      <AlertTriangle size={10} /> Overloaded
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.totalActive} active JOs</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ROW 3: Today's Schedule Snapshot + Production Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Today's Schedule Snapshot (per wireframe) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={15} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Today's Schedule Snapshot</h3>
            </div>
            <button onClick={() => setView('calendar')} className="btn-ghost">
              Calendar <ArrowRight size={12} />
            </button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <CheckCircle2 size={28} className="text-emerald-300 mb-2" />
              <p className="text-xs">No bookings scheduled for today</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Time</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">Activity</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Project</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {todaySchedule.map(ev => {
                    const Icon = activityIcon[ev.activityType] ?? Camera
                    return (
                      <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                          {new Date(ev.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: activityCalendarColors[ev.activityType] + '20' }}>
                              <Icon size={11} style={{ color: activityCalendarColors[ev.activityType] }} />
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">{ev.activityType.split(' ')[0]}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[100px] hidden sm:table-cell">{ev.title}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-slate-500 dark:text-slate-500">{ev.assignedMemberIds.length} pax</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Production Analytics chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Production Analytics</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Job orders by month</p>
            </div>
            <button onClick={() => setView('reports')} className="btn-ghost">
              Reports <ArrowRight size={12} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyTrend} barSize={22} barCategoryGap="35%">
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#64748b' : '#94a3b8' }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(124,58,237,0.15)' : '#F5F3FF', radius: 6 }} />
              <Bar dataKey="count" name="Job Orders" radius={[8, 8, 0, 0]}>
                {monthlyTrend.map((e, i) => (
                  <Cell key={i} fill={e.current ? '#7C3AED' : isDark ? '#312e81' : '#EDE9FE'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── ROW 4: ALERTS (per wireframe) ─────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-slate-400 dark:text-slate-500" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active Alerts</p>
          {(overbookedTeams.length + (nearDeadline > 0 ? 1 : 0) + (delayedJOs > 0 ? 1 : 0) + (cancelledJOs > 0 ? 1 : 0)) > 0 && (
            <span className="ml-auto text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
              {overbookedTeams.length + (nearDeadline > 0 ? 1 : 0) + (delayedJOs > 0 ? 1 : 0) + (cancelledJOs > 0 ? 1 : 0)} active
            </span>
          )}
        </div>
        {(overbookedTeams.length === 0 && nearDeadline === 0 && delayedJOs === 0 && cancelledJOs === 0) ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={16} />
            <span>All systems clear — no active alerts</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {overbookedTeams.map(t => (
              <div key={t.team} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-400 font-medium">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{t.team} Team overloaded ({t.util}%)</span>
              </div>
            ))}
            {nearDeadline > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                <Clock size={13} className="shrink-0" />
                <span>{nearDeadline} JO{nearDeadline !== 1 ? 's' : ''} nearing deadline (≤5 days)</span>
              </div>
            )}
            {delayedJOs > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl px-3 py-2 text-xs text-orange-700 dark:text-orange-400 font-medium">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{delayedJOs} delayed project{delayedJOs !== 1 ? 's' : ''} — needs escalation</span>
              </div>
            )}
            {cancelledJOs > 0 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <Ban size={13} className="shrink-0" />
                <span>{cancelledJOs} cancelled JO{cancelledJOs !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ROW 5: Recent JOs + Activity Mix ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent JOs */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Recent Job Orders</h3>
            <button onClick={() => setView('joborders')} className="btn-ghost">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {recentJOs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No job orders yet</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {recentJOs.map(jo => {
                const Icon = activityIcon[jo.activityType] ?? ClipboardList
                return (
                  <div key={jo.id} className="flex items-center gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 -mx-2 px-2 rounded-xl transition-colors">
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                      style={{ background: activityCalendarColors[jo.activityType] + '20' }}>
                      <Icon size={15} style={{ color: activityCalendarColors[jo.activityType] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{jo.projectName}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {jo.activityType} · {jo.joNumber}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusBadge[jo.status]}`}>
                      {jo.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Activity mix donut */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Activity Mix</h3>
          </div>
          <div className="flex justify-center mb-4">
            <div className="relative w-28 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activityMix.length > 0 ? activityMix : [{ name: 'Empty', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                    paddingAngle={3} dataKey="value" strokeWidth={0}
                  >
                    {(activityMix.length > 0 ? activityMix : []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                    {activityMix.length === 0 && <Cell fill={isDark ? '#334155' : '#E2E8F0'} />}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xl font-black text-slate-900 dark:text-slate-100">{inProgressJOs}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Active</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {activityMix.slice(0, 5).map((a, i) => (
              <div key={a.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">{a.name}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{a.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

