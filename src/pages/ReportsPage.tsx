import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, BarChart3,
  PieChart as PieIcon, Users, Target, Zap, Activity,
  Camera, Video, Palette, Scissors, Mic, Headphones,
  ArrowUpRight, ArrowDownRight, Minus, Filter, X,
  Image, Printer, ShieldCheck, PenLine,
} from 'lucide-react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { activityCalendarColors, loadColor } from '../utils/colors'
import { isOverdue, memberLoad } from '../utils/helpers'
import type { ActivityType } from '../types'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot', 'Video Shoot', 'Static Artwork Design', 'Digital Design',
  'Graphics', 'Printing', 'ASC',
  'Video Editing', 'Audio Services', 'Audio Recording', 'Audio Editing', 'Content Writing',
]

const PREDEFINED_TEAMS = ['BMG', 'MOD', 'MTO', 'CBE']

const activityIcon: Record<ActivityType, React.ElementType> = {
  'Photo Shoot':           Camera,
  'Video Shoot':           Video,
  'Static Artwork Design': Palette,
  'Digital Design':        Palette,
  'Video Editing':         Scissors,
  'Graphics':              Image,
  'Printing':              Printer,
  'ASC':                   ShieldCheck,
  'Audio Recording':       Mic,
  'Audio Editing':         Headphones,
  'Audio Services':        Mic,
  'Content Writing':       PenLine,
}

function KpiCard({
  label, value, sub, color, icon: Icon, trend,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
          <Icon size={18} className={color ?? 'text-slate-500'} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
            trend === 'down' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
            'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={11} /> : trend === 'down' ? <ArrowDownRight size={11} /> : <Minus size={11} />}
            {trend === 'up' ? 'Good' : trend === 'down' ? 'Needs attn' : 'Stable'}
          </span>
        )}
      </div>
      <p className={`text-3xl font-black mt-1 ${color ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle, iconColor }: { icon: React.ElementType; title: string; subtitle?: string; iconColor?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconColor ?? 'bg-brand-100 dark:bg-brand-900/40'}`}>
        <Icon size={16} className={iconColor ? 'text-white' : 'text-brand-600 dark:text-brand-400'} />
      </div>
      <div>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export function ReportsPage() {
  const { jobOrders, calendarEvents } = useDataStore()
  const { theme, resources } = useAppStore()
  const isDark = theme === 'dark'

  const now = new Date()

  // ── Global Year & Month filter (drives KPIs, status, activity, teams, resources, priority, turnaround) ──
  const [filterYear,  setFilterYear]  = useState<number | 'all'>('all')
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all')

  // ── JO Trend: own From–To date range (independent chart control) ──
  const [trendFromMonth, setTrendFromMonth] = useState(now.getMonth() >= 5 ? now.getMonth() - 5 : 0)
  const [trendFromYear, setTrendFromYear]   = useState(now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1)
  const [trendToMonth, setTrendToMonth]     = useState(now.getMonth())
  const [trendToYear, setTrendToYear]       = useState(now.getFullYear())

  // ── Global filtered JO set used by all sections except JO Trend ──
  const globalFilteredJOs = useMemo(() => {
    return jobOrders.filter(j => {
      const d = new Date(j.createdAt)
      if (filterYear  !== 'all' && d.getFullYear() !== filterYear)  return false
      if (filterMonth !== 'all' && d.getMonth()    !== filterMonth) return false
      return true
    })
  }, [jobOrders, filterYear, filterMonth])

  const isFiltered = filterYear !== 'all' || filterMonth !== 'all'
  const filterLabel = [
    filterMonth !== 'all' ? MONTHS_SHORT[filterMonth as number] : null,
    filterYear  !== 'all' ? String(filterYear) : null,
  ].filter(Boolean).join(' ') || 'All Time'

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, fontSize: 12, padding: '8px 12px',
    color: isDark ? '#f1f5f9' : '#0f172a',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  }

  // ── KPI summary — uses globalFilteredJOs ──
  const summary = useMemo(() => {
    const jos = globalFilteredJOs
    const total = jos.length
    const completed = jos.filter((j) => j.status === 'Completed').length
    const delayed = jos.filter((j) => j.status === 'Delayed').length
    const cancelled = jos.filter((j) => j.status === 'Cancelled').length
    const inFlight = jos.filter((j) => ['To Do', 'Ongoing', 'For Review', 'Needs Revision', 'For Approval'].includes(j.status)).length
    const completionRate = total ? Math.round((completed / total) * 100) : 0
    const onTimeCompleted = jos.filter((j) => j.status === 'Completed' && !isOverdue(j.deadline)).length
    const onTimeRate = completed ? Math.round((onTimeCompleted / completed) * 100) : 0
    const executionIndex = Math.round((onTimeRate * 0.6 + completionRate * 0.4))
    return { total, completed, delayed, cancelled, inFlight, completionRate, onTimeRate, executionIndex }
  }, [globalFilteredJOs])

  // ── JO Trend — uses its own From–To range, not global filter ──
  const monthlyData = useMemo(() => {
    const result = []
    let y = trendFromYear, m = trendFromMonth
    while (y < trendToYear || (y === trendToYear && m <= trendToMonth)) {
      const inMonth = jobOrders.filter((j) => {
        const c = new Date(j.createdAt)
        return c.getFullYear() === y && c.getMonth() === m
      })
      result.push({
        month: `${MONTHS_SHORT[m]} ${y !== trendFromYear || result.length > 11 ? `'${String(y).slice(2)}` : ''}`.trim(),
        submitted: inMonth.length,
        completed: inMonth.filter((j) => j.status === 'Completed').length,
        delayed: inMonth.filter((j) => j.status === 'Delayed').length,
      })
      if (m === 11) { m = 0; y++ } else { m++ }
      if (result.length > 24) break
    }
    return result
  }, [jobOrders, trendFromMonth, trendFromYear, trendToMonth, trendToYear])

  // ── Activity Type — uses globalFilteredJOs ──
  const activityData = useMemo(() =>
    ACTIVITY_TYPES.map((type) => {
      const all = globalFilteredJOs.filter((j) => j.activityType === type)
      return {
        type: type.split(' ')[0],
        fullType: type,
        total: all.length,
        completed: all.filter((j) => j.status === 'Completed').length,
        color: activityCalendarColors[type],
        icon: activityIcon[type],
      }
    }).filter((a) => a.total > 0),
  [globalFilteredJOs])

  // ── Status Distribution — uses globalFilteredJOs ──
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    globalFilteredJOs.forEach((j) => { counts[j.status] = (counts[j.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [globalFilteredJOs])

  const statusColors2: Record<string, string> = {
    'To Do': '#94A3B8', 'Ongoing': '#5164C0', 'For Review': '#F59E0B',
    'Needs Revision': '#E11D48', 'For Approval': '#8B5CF6', Completed: '#10b981',
    Delayed: '#ef4444', Cancelled: '#94a3b8',
  }

  // ── JOs by Requesting Team — uses globalFilteredJOs, with "Others" catch-all ──
  const teamData = useMemo(() => {
    const predefined = PREDEFINED_TEAMS.map((team) => ({
      team,
      total:     globalFilteredJOs.filter((j) => j.requestingTeam === team).length,
      completed: globalFilteredJOs.filter((j) => j.requestingTeam === team && j.status === 'Completed').length,
    }))
    const othersJOs = globalFilteredJOs.filter((j) => !PREDEFINED_TEAMS.includes(j.requestingTeam))
    if (othersJOs.length > 0) {
      predefined.push({
        team: 'Others',
        total:     othersJOs.length,
        completed: othersJOs.filter((j) => j.status === 'Completed').length,
      })
    }
    return predefined
  }, [globalFilteredJOs])

  // ── Individual Resource Load — uses globalFilteredJOs ──
  const resourceData = useMemo(() => {
    return resources.map((r) => {
      // Load Ratio = (total assigned work hours ÷ load capacity) × 100
      const { hours, pct: util, status } = memberLoad(globalFilteredJOs, r.id)
      return { name: r.initials, fullName: r.name, role: r.role, util, hours, status, color: r.color, team: r.team }
    })
  }, [globalFilteredJOs, resources])

  // ── Turnaround — uses globalFilteredJOs ──
  const turnaroundData = useMemo(() =>
    ACTIVITY_TYPES.map((type) => {
      const completed = globalFilteredJOs.filter((j) => j.activityType === type && j.status === 'Completed' && j.completedAt)
      if (completed.length === 0) return null
      const totalDays = completed.reduce((acc, j) => {
        const linkedEvents = calendarEvents.filter(e => e.joId === j.id)
        const startRaw = linkedEvents.length > 0
          ? linkedEvents.reduce((min, e) => e.startDate < min ? e.startDate : min, linkedEvents[0].startDate)
          : (j.deadline || j.createdAt)
        const start = new Date(startRaw).getTime()
        const end   = new Date(j.completedAt!).getTime()
        return acc + Math.max(0, Math.round((end - start) / 86_400_000))
      }, 0)
      const avg = Math.round(totalDays / completed.length)
      const color = activityCalendarColors[type]
      const Icon = activityIcon[type]
      return { type: type.split(' ')[0], fullType: type, avg, count: completed.length, color, icon: Icon }
    }).filter(Boolean) as { type: string; fullType: ActivityType; avg: number; count: number; color: string; icon: React.ElementType }[],
  [globalFilteredJOs, calendarEvents])

  const maxTurnaround = Math.max(...turnaroundData.map((d) => d.avg), 1)

  // ── Priority Breakdown — uses globalFilteredJOs ──
  const priorityData = useMemo(() => {
    const map: Record<string, number> = { High: 0, Medium: 0, Low: 0 }
    globalFilteredJOs.forEach((j) => { map[j.priority]++ })
    return [
      { name: 'High', value: map.High, color: '#ef4444' },
      { name: 'Medium', value: map.Medium, color: '#f59e0b' },
      { name: 'Low', value: map.Low, color: '#10b981' },
    ].filter((d) => d.value > 0)
  }, [globalFilteredJOs])

  const axisColor = isDark ? '#475569' : '#cbd5e1'
  const tickColor = isDark ? '#64748b' : '#94a3b8'

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Global Filter Bar ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl px-5 py-3.5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Filter size={15} />
          <span className="text-xs font-semibold">Global Filter</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="all">All Years</option>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="all">All Months</option>
            {MONTHS_SHORT.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          {isFiltered && (
            <button
              onClick={() => { setFilterYear('all'); setFilterMonth('all') }}
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
        <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
          isFiltered
            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
            : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
        }`}>
          {filterLabel} · {globalFilteredJOs.length} JOs
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
          Applies to all sections below (KPIs, activity, teams, resources). JO Trend has its own range.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Execution Index"
          value={summary.executionIndex}
          sub="Composite performance score"
          color="text-brand-600 dark:text-brand-400"
          icon={Target}
          trend={summary.executionIndex >= 70 ? 'up' : 'down'}
        />
        <KpiCard
          label="Completion Rate"
          value={`${summary.completionRate}%`}
          sub={`${summary.completed} of ${summary.total} JOs`}
          color="text-emerald-600 dark:text-emerald-400"
          icon={CheckCircle2}
          trend={summary.completionRate >= 60 ? 'up' : 'neutral'}
        />
        <KpiCard
          label="On-Time Delivery"
          value={`${summary.onTimeRate}%`}
          sub="Of completed JOs"
          color={summary.onTimeRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          icon={Clock}
          trend={summary.onTimeRate >= 80 ? 'up' : 'down'}
        />
        <KpiCard
          label="Delayed JOs"
          value={summary.delayed}
          sub="Requires escalation"
          color={summary.delayed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}
          icon={AlertTriangle}
          trend={summary.delayed === 0 ? 'up' : summary.delayed > 3 ? 'down' : 'neutral'}
        />
      </div>

      {/* Monthly trend + Status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <SectionHeader icon={BarChart3} title="JO Trend" subtitle="Submitted, completed, and delayed by month" />
            {/* Independent From–To filter for the trend chart */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">From</span>
              <select value={trendFromMonth} onChange={e => setTrendFromMonth(Number(e.target.value))} className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none">
                {MONTHS_SHORT.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={trendFromYear} onChange={e => setTrendFromYear(Number(e.target.value))} className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-slate-400 font-semibold">To</span>
              <select value={trendToMonth} onChange={e => setTrendToMonth(Number(e.target.value))} className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none">
                {MONTHS_SHORT.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={trendToYear} onChange={e => setTrendToYear(Number(e.target.value))} className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
              <Bar dataKey="submitted" name="Submitted" fill="#5164C0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delayed" name="Delayed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={PieIcon} title="Status Distribution" />
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={statusColors2[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: statusColors2[s.name] }} />
                      <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Activity type breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <SectionHeader icon={Activity} title="JOs by Activity Type" subtitle="Total vs completed per production type" />
        {activityData.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ACTIVITY_TYPES.map(type => {
              const Icon = activityIcon[type]
              const d = activityData.find(a => a.fullType === type)
              const total = d?.total ?? 0
              const completed = d?.completed ?? 0
              const color = activityCalendarColors[type]
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              return (
                <div key={type} className="rounded-2xl p-4 border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">{type.split(' ')[0]}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{total}</p>
                  <div className="w-full">
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{pct}% done</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-300 dark:text-slate-600 text-sm">No job orders match this filter</div>
        )}
      </div>

      {/* Average Turnaround Time */}
      {turnaroundData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={Clock} title="Avg Turnaround Time by Activity" subtitle="Days from activity start (or deadline) to completed_at · completed JOs only" />
          <div className="space-y-3">
            {turnaroundData.map((d) => {
              const Icon = d.icon
              const pct = Math.round((d.avg / maxTurnaround) * 100)
              return (
                <div key={d.fullType} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: d.color + '20' }}>
                      <Icon size={12} style={{ color: d.color }} />
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{d.fullType.split(' ')[0]}</p>
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                  <div className="w-28 shrink-0 flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">{d.avg}d</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">avg · {d.count} completed</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team breakdown + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={Users} title="JOs by Requesting Team" subtitle="Predefined teams + Others · total vs completed" />
          {teamData.some((t) => t.total > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamData} barGap={4} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="team" tick={{ fontSize: 12, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
                <Bar dataKey="total" name="Total" fill="#5164C0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm">No data</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={Target} title="Priority Breakdown" subtitle="Distribution of JO urgency levels" />
          {priorityData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {priorityData.map((p) => (
                  <div key={p.name} className="text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{p.name}</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{p.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 dark:text-slate-600 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Individual Resource Load */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <SectionHeader icon={Users} title="Individual Resource Load" subtitle={`Active JO workload per team member · ${filterLabel}`} />
          {isFiltered && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
              Filtered: {filterLabel}
            </span>
          )}
        </div>
        {resourceData.some(r => r.util > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resourceData.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-xl ${r.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                  {r.name}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.fullName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.role}</p>
                    </div>
                    <span className={`text-sm font-black ml-2 ${loadColor(r.status).text}`} title={`${r.hours.toFixed(1)}h assigned · ${r.status}`}>
                      {r.util}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.min(100, r.util)}%`,
                      background: loadColor(r.status).bar,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-300 dark:text-slate-600 text-sm">
            No active workload in this timeframe
          </div>
        )}
      </div>

      {/* Execution index hero */}
      <div className="bg-gradient-to-r from-brand-600 via-brand-700 to-brand-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-brand-300" />
              <p className="text-brand-200 text-sm font-semibold">DAP Execution Index · {filterLabel}</p>
            </div>
            <p className="text-7xl font-black leading-none">{summary.executionIndex}</p>
            <p className="text-brand-200 text-xs mt-2">60% on-time delivery · 40% completion rate</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-2.5 text-sm min-w-[200px]">
            {[
              { label: 'On-Time Rate', val: `${summary.onTimeRate}%`, icon: Clock },
              { label: 'Completion Rate', val: `${summary.completionRate}%`, icon: CheckCircle2 },
              { label: 'Active JOs', val: summary.inFlight, icon: Activity },
              { label: 'Delayed', val: summary.delayed, icon: AlertTriangle, warn: summary.delayed > 0 },
              { label: 'Cancelled', val: summary.cancelled, icon: AlertTriangle, warn: summary.cancelled > 0 },
            ].map(({ label, val, icon: Icon, warn }) => (
              <div key={label} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-1.5 text-brand-200">
                  <Icon size={12} />
                  <span>{label}</span>
                </div>
                <span className={`font-bold ${warn ? 'text-red-300' : 'text-white'}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
