import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  AlertTriangle, CheckCircle2, Clock, Zap, ArrowRight,
  Plus, ClipboardList, Camera, Video, Mic, Palette, Scissors, Headphones,
  CalendarClock, TrendingUp, ArrowUpRight, Ban, Users,
  ChevronLeft, ChevronRight, CalendarDays, Image, Printer, ShieldCheck,
} from 'lucide-react'
import { useAppStore, useDataStore } from '../store/useAppStore'
import { activityCalendarColors, teamColors } from '../utils/colors'
import type { JOStatus, ActivityType } from '../types'
import { ACTIVITY_HOURS, WEEKLY_CAPACITY_HRS, TEAM_TOTAL_CAPACITY, LOAD_OVERLOAD } from '../types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

const statusBadge: Record<JOStatus, string> = {
  'Pending':     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Approved':    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Scheduled':   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'For Review':     'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  'Needs Revision': 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'Completed':      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Delayed':        'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  'Cancelled':      'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
}

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
}

export function DashboardPage() {
  const { setView, theme, resources } = useAppStore()
  const { jobOrders, calendarEvents, bookingRequests } = useDataStore()
  const isDark = theme === 'dark'

  const now = new Date()

  // ── Year / Month range filter ────────────────────────────────────────────
  const [fromYear,  setFromYear]  = useState<number>(now.getFullYear())
  const [fromMonth, setFromMonth] = useState<number>(0)          // Jan = 0
  const [toYear,    setToYear]    = useState<number>(now.getFullYear())
  const [toMonth,   setToMonth]   = useState<number>(now.getMonth())  // current month

  // Years that have at least one JO (+ current year always included)
  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    jobOrders.forEach(j => years.add(new Date(j.createdAt).getFullYear()))
    return Array.from(years).sort((a, b) => a - b)   // ascending for range sense
  }, [jobOrders, now])

  // Convert year+month to a comparable integer: YYYYMM
  const fromKey = fromYear * 100 + fromMonth
  const toKey   = toYear   * 100 + toMonth

  // If user accidentally sets from > to, treat as single month
  const effectiveFromKey = Math.min(fromKey, toKey)
  const effectiveToKey   = Math.max(fromKey, toKey)

  const isFiltered = !(fromYear === now.getFullYear() && fromMonth === 0 &&
                       toYear   === now.getFullYear() && toMonth   === now.getMonth())

  // Range label for the summary bar
  const rangeLabel = (() => {
    const fk = effectiveFromKey
    const tk = effectiveToKey
    const fy = Math.floor(fk / 100), fm = fk % 100
    const ty = Math.floor(tk / 100), tm = tk % 100
    if (fk === tk) return `${MONTHS_FULL[fm]} ${fy}`
    return `${MONTHS[fm]} ${fy} – ${MONTHS[tm]} ${ty}`
  })()

  // Filtered job orders within the from–to range
  const filteredJOs = useMemo(() => {
    return jobOrders.filter(j => {
      const d = new Date(j.createdAt)
      const key = d.getFullYear() * 100 + d.getMonth()
      return key >= effectiveFromKey && key <= effectiveToKey
    })
  }, [jobOrders, effectiveFromKey, effectiveToKey])

  // ── KPI counts — scoped to the selected year/month ──────────────────────
  const totalJOs      = filteredJOs.length
  const activeJOs     = filteredJOs.filter(j => !['Completed','Cancelled','Delayed'].includes(j.status)).length
  const pendingJOs    = filteredJOs.filter(j => j.status === 'Pending').length
  const approvedJOs   = filteredJOs.filter(j => j.status === 'Approved').length
  const scheduledJOs  = filteredJOs.filter(j => j.status === 'Scheduled').length
  const forReviewJOs  = filteredJOs.filter(j => j.status === 'For Review').length
  const completedJOs  = filteredJOs.filter(j => j.status === 'Completed').length
  const delayedJOs    = filteredJOs.filter(j => j.status === 'Delayed').length
  const cancelledJOs  = filteredJOs.filter(j => j.status === 'Cancelled').length

  // Status breakdown config
  const STATUS_BREAKDOWN = [
    { label: 'Pending',     count: pendingJOs,    color: '#F59E0B' },
    { label: 'Approved',    count: approvedJOs,   color: '#3B82F6' },
    { label: 'Scheduled',   count: scheduledJOs,  color: '#6366F1' },
    { label: 'For Review',  count: forReviewJOs,  color: '#F97316' },
    { label: 'Completed',   count: completedJOs,  color: '#10B981' },
    { label: 'Delayed',     count: delayedJOs,    color: '#EF4444' },
    { label: 'Cancelled',   count: cancelledJOs,  color: '#94A3B8' },
  ]

  // Team workload heatmap — uses 6.6 hr/day × 5 = 33 hr/week formula
  const teamWorkload = useMemo(() => {
    const teams = ['Photo', 'Video', 'Audio', 'Design'] as const
    return teams.map(team => {
      const members = resources.filter(r => r.team === team)
      const totalActive = filteredJOs.filter(j =>
        !['Completed','Cancelled','Delayed'].includes(j.status) &&
        members.some(m => j.assignedMemberIds.includes(m.id))
      ).length
      const avgUtil = members.length
        ? Math.round(members.reduce((acc, r) => {
            const activeJOs = filteredJOs.filter(jo =>
              jo.assignedMemberIds.includes(r.id) &&
              !['Completed','Delayed','Cancelled'].includes(jo.status)
            )
            const estimatedHrs = activeJOs.reduce((s, jo) =>
              s + (ACTIVITY_HOURS[jo.activityType] ?? 4), 0)
            return acc + Math.min(100, Math.round((estimatedHrs / WEEKLY_CAPACITY_HRS) * 100))
          }, 0) / members.length)
        : 0
      const color = teamColors[team]
      return { team, util: avgUtil, totalActive, members: members.length, color }
    })
  }, [filteredJOs, resources])

  // Individual resource load data for capacity monitoring section
  const resourceLoadData = useMemo(() => {
    return resources.map(r => {
      const activeJOs = filteredJOs.filter(jo =>
        jo.assignedMemberIds.includes(r.id) &&
        !['Completed','Cancelled'].includes(jo.status)
      )
      const estimatedHrs = activeJOs.reduce((s, jo) =>
        s + (ACTIVITY_HOURS[jo.activityType] ?? 4), 0)
      const loadPct = Math.min(100, Math.round((estimatedHrs / WEEKLY_CAPACITY_HRS) * 100))
      return {
        id: r.id, name: r.name, team: r.team, role: r.role, initials: r.initials,
        activeJOs: activeJOs.length, estimatedHrs, loadPct,
        status: loadPct >= LOAD_OVERLOAD ? 'overload' : loadPct >= 50 ? 'optimal' : 'underload',
      }
    }).sort((a, b) => b.loadPct - a.loadPct)
  }, [filteredJOs, resources])

  // Team capacity totals
  const teamCapacityTotals = useMemo(() => {
    const teams = ['Photo', 'Video', 'Audio', 'Design'] as const
    return teams.map(team => {
      const members = resources.filter(r => r.team === team)
      const usedHrs = members.reduce((sum, r) => {
        const activeJOs = filteredJOs.filter(jo =>
          jo.assignedMemberIds.includes(r.id) &&
          !['Completed','Cancelled'].includes(jo.status)
        )
        return sum + activeJOs.reduce((s, jo) => s + (ACTIVITY_HOURS[jo.activityType] ?? 4), 0)
      }, 0)
      const totalCapacity = members.length * WEEKLY_CAPACITY_HRS
      const pct = totalCapacity > 0 ? Math.min(100, Math.round((usedHrs / totalCapacity) * 100)) : 0
      return { team, usedHrs, totalCapacity, pct, members: members.length, color: teamColors[team] }
    })
  }, [filteredJOs, resources])

  const totalUsedHrs = resourceLoadData.reduce((s, r) => s + r.estimatedHrs, 0)
  const overloadedResources = resourceLoadData.filter(r => r.status === 'overload')

  // Today's schedule snapshot (per wireframe ROW 3)
  const todaySchedule = useMemo(() => {
    const today = new Date().toDateString()
    return calendarEvents
      .filter(e => new Date(e.startDate).toDateString() === today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 6)
  }, [calendarEvents])

  // Production Analytics state — defaults follow the global year/month filter
  const [analyticsView, setAnalyticsView] = useState<'year' | 'month'>('year')
  const [analyticsYear, setAnalyticsYear] = useState(now.getFullYear())
  const [analyticsMonth, setAnalyticsMonth] = useState(now.getMonth())

  const analyticsData = useMemo(() => {
    if (analyticsView === 'year') {
      // 12 monthly bars for selected year
      return Array.from({ length: 12 }, (_, m) => {
        const count = filteredJOs.filter(j => {
          const d = new Date(j.createdAt)
          return d.getFullYear() === analyticsYear && d.getMonth() === m
        }).length
        const completed = filteredJOs.filter(j => {
          const d = new Date(j.completedAt ?? j.createdAt)
          return d.getFullYear() === analyticsYear && d.getMonth() === m && j.status === 'Completed'
        }).length
        return { label: MONTHS[m], count, completed, current: m === now.getMonth() && analyticsYear === now.getFullYear() }
      })
    } else {
      // Daily bars for selected month/year
      const daysInMonth = new Date(analyticsYear, analyticsMonth + 1, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, d) => {
        const day = d + 1
        const count = filteredJOs.filter(j => {
          const date = new Date(j.createdAt)
          return date.getFullYear() === analyticsYear && date.getMonth() === analyticsMonth && date.getDate() === day
        }).length
        const completed = filteredJOs.filter(j => {
          const date = new Date(j.completedAt ?? j.createdAt)
          return date.getFullYear() === analyticsYear && date.getMonth() === analyticsMonth && date.getDate() === day && j.status === 'Completed'
        }).length
        const isToday = day === now.getDate() && analyticsMonth === now.getMonth() && analyticsYear === now.getFullYear()
        return { label: `${day}`, count, completed, current: isToday }
      })
    }
  }, [filteredJOs, analyticsView, analyticsYear, analyticsMonth, now])

  function prevAnalytics() {
    if (analyticsView === 'year') {
      setAnalyticsYear(y => y - 1)
    } else {
      if (analyticsMonth === 0) { setAnalyticsMonth(11); setAnalyticsYear(y => y - 1) }
      else setAnalyticsMonth(m => m - 1)
    }
  }
  function nextAnalytics() {
    if (analyticsView === 'year') {
      setAnalyticsYear(y => y + 1)
    } else {
      if (analyticsMonth === 11) { setAnalyticsMonth(0); setAnalyticsYear(y => y + 1) }
      else setAnalyticsMonth(m => m + 1)
    }
  }
  const analyticsLabel = analyticsView === 'year'
    ? `${analyticsYear}`
    : `${MONTHS[analyticsMonth]} ${analyticsYear}`

  // Alerts — scan filtered active JOs (≥75% = overload)
  const overbookedTeams = teamWorkload.filter(t => t.util >= LOAD_OVERLOAD)
  const nearDeadline = filteredJOs.filter(j => {
    if (['Completed','Cancelled'].includes(j.status)) return false
    const d = Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86400_000)
    return d >= 0 && d <= 5
  }).length

  // Recent JOs — most recently created, sorted descending (filtered)
  const recentJOs = useMemo(() =>
    [...filteredJOs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
  [filteredJOs])

  // Activity mix donut — filtered non-cancelled JOs
  const activityMix = useMemo(() => {
    const map: Record<string, number> = {}
    filteredJOs.filter(j => j.status !== 'Cancelled').forEach(j => {
      map[j.activityType] = (map[j.activityType] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filteredJOs])

  const PIE_COLORS = ['#7C3AED','#EC4899','#F97316','#10B981','#3B82F6','#F59E0B']

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, fontSize: 12, padding: '8px 12px',
    color: isDark ? '#f1f5f9' : '#0f172a',
  }


  return (
    <div className="space-y-4 lg:space-y-5 max-w-[1400px]">

      {/* ── Top bar: heading + Year/Month filter + actions ─────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-slate-100">Operations Overview</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">

          {/* ── Date range filter ── */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
            <CalendarDays size={13} className="text-blue-500 shrink-0" />
            {/* FROM */}
            <select
              value={fromMonth}
              onChange={e => setFromMonth(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={fromYear}
              onChange={e => setFromYear(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">→</span>

            {/* TO */}
            <select
              value={toMonth}
              onChange={e => setToMonth(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={toYear}
              onChange={e => setToYear(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Reset */}
            {isFiltered && (
              <button
                onClick={() => {
                  setFromYear(now.getFullYear()); setFromMonth(0)
                  setToYear(now.getFullYear());   setToMonth(now.getMonth())
                }}
                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs font-bold"
                title="Reset range"
              >✕</button>
            )}
          </div>

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
            const overloaded = t.util >= LOAD_OVERLOAD
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
                <div className="w-36 shrink-0 flex items-center gap-1.5">
                  {overloaded ? (
                    <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-semibold">
                      <AlertTriangle size={10} /> Overloaded ≥{LOAD_OVERLOAD}%
                    </span>
                  ) : t.util >= 50 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">✓ Optimal</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.totalActive} active JOs</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* Capacity legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex-wrap text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />Underload (&lt;50%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Optimal (50–74%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Overload (≥{LOAD_OVERLOAD}%)</span>
          <span className="ml-auto text-slate-400 dark:text-slate-500">Formula: (Est. hrs / {WEEKLY_CAPACITY_HRS} weekly hrs) × 100</span>
        </div>
      </div>

      {/* ── CAPACITY MONITORING ──────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Users size={14} className="text-blue-500" />
              Capacity &amp; Resource Load
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              6.6 hrs/day · 33 hrs/week per person · {TEAM_TOTAL_CAPACITY} hrs total team · ≥{LOAD_OVERLOAD}% = Overload
            </p>
          </div>
          <button onClick={() => setView('workload')} className="btn-ghost">
            Full view <ArrowRight size={12} />
          </button>
        </div>

        {/* Team capacity rows */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {teamCapacityTotals.map(t => (
            <div key={t.team} className={`rounded-xl p-3 border ${t.pct >= LOAD_OVERLOAD ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color.hex }} />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.team}</p>
                </div>
                <span className={`text-[10px] font-black ${t.pct >= LOAD_OVERLOAD ? 'text-red-600 dark:text-red-400' : t.pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {t.pct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${t.pct}%`, background: t.pct >= LOAD_OVERLOAD ? '#EF4444' : t.color.hex }} />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {Math.round(t.usedHrs)}h used · {Math.max(0, Math.round(t.totalCapacity - t.usedHrs))}h free
              </p>
            </div>
          ))}
        </div>

        {/* Total capacity bar */}
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Overall Team Capacity</p>
            <p className="text-xs font-black text-slate-700 dark:text-slate-200">
              {Math.round(totalUsedHrs)}h used · {Math.max(0, TEAM_TOTAL_CAPACITY - Math.round(totalUsedHrs))}h remaining
            </p>
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (totalUsedHrs / TEAM_TOTAL_CAPACITY) * 100)}%`,
                background: totalUsedHrs / TEAM_TOTAL_CAPACITY >= LOAD_OVERLOAD / 100
                  ? 'linear-gradient(90deg,#EF4444,#DC2626)'
                  : 'linear-gradient(90deg,#7C3AED,#6366F1)',
              }} />
          </div>
          {/* 75% threshold marker */}
          <div className="relative mt-1 h-2">
            <div className="absolute top-0 flex flex-col items-center" style={{ left: `${LOAD_OVERLOAD}%` }}>
              <div className="w-px h-2 bg-red-400" />
            </div>
            <p className="absolute text-[9px] text-red-500 font-bold" style={{ left: `${LOAD_OVERLOAD - 2}%`, top: 2 }}>
              {LOAD_OVERLOAD}%
            </p>
          </div>
        </div>

        {/* Individual resource load — top overloaded or all if few */}
        {overloadedResources.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <AlertTriangle size={11} /> {overloadedResources.length} Overloaded Resource{overloadedResources.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5">
              {overloadedResources.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-[9px] font-black text-red-700 dark:text-red-300 shrink-0">
                    {r.initials}
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 w-32 truncate shrink-0">{r.name.split(', ').reverse().join(' ')}</p>
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${r.loadPct}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-red-600 dark:text-red-400 w-10 text-right shrink-0">{r.loadPct}%</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{r.activeJOs} JOs</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {overloadedResources.length === 0 && (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={15} />
            <span className="text-xs">All resources within capacity — no overloads detected</span>
          </div>
        )}
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
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Production Analytics</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Identify workload peaks</p>
            </div>
            <button onClick={() => setView('reports')} className="btn-ghost">
              Reports <ArrowRight size={12} />
            </button>
          </div>

          {/* View toggle + navigation */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              {(['year', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setAnalyticsView(v)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                    analyticsView === v
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >{v}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={prevAnalytics} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-24 text-center">{analyticsLabel}</span>
              <button onClick={nextAnalytics} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={analyticsData} barSize={analyticsView === 'month' ? 8 : 18} barCategoryGap="25%">
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fontSize: analyticsView === 'month' ? 9 : 11, fill: isDark ? '#64748b' : '#94a3b8' }}
                interval={analyticsView === 'month' ? 3 : 0}
              />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(124,58,237,0.1)' : '#F5F3FF', radius: 6 }} />
              <Bar dataKey="count" name="Submitted" radius={[5, 5, 0, 0]} stackId="a">
                {analyticsData.map((e, i) => (
                  <Cell key={i} fill={e.current ? '#7C3AED' : isDark ? '#312e81' : '#EDE9FE'} />
                ))}
              </Bar>
              <Bar dataKey="completed" name="Completed" radius={[5, 5, 0, 0]} fill="#10b981" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />Submitted</span>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Completed</span>
          </div>
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

      {/* ── 7-Step Booking Flow ──────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">DAP Booking Flow</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">4D System — Discern · Decide · Delegate · Deliver</p>
          </div>
        </div>
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {([
            { step: 1, label: 'Request\nSubmitted',  count: bookingRequests.length,                                                    color: '#7C3AED', phase: 'Discern' },
            { step: 2, label: 'Pending\nReview',     count: bookingRequests.filter(r => r.status === 'Pending Review').length,         color: '#6366F1', phase: 'Discern' },
            { step: 3, label: 'Members\nAssigned',   count: bookingRequests.filter(r => r.status === 'Assigned').length,               color: '#3B82F6', phase: 'Decide' },
            { step: 4, label: 'JO\nScheduled',       count: scheduledJOs,  color: '#0EA5E9', phase: 'Delegate' },
            { step: 5, label: 'For\nReview',         count: forReviewJOs,  color: '#F97316', phase: 'Deliver' },
            { step: 6, label: 'Completed\n& Closed', count: completedJOs,  color: '#10B981', phase: 'Deliver' },
          ]).map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-1 flex-1 min-w-[90px]">
              <div className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: s.color }}>
                  {s.step}
                </div>
                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight whitespace-pre-line">{s.label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100">{s.count}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ background: s.color + 'cc' }}>{s.phase}</span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
              )}
            </div>
          ))}
        </div>
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
                <p className="text-xl font-black text-slate-900 dark:text-slate-100">{activeJOs}</p>
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
