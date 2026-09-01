import { useState, useMemo } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import {
  startOfWeek, addDays, addWeeks, format, isSameDay, parseISO, isToday,
} from 'date-fns'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { teamColor, activityCalendarColors, loadColor } from '../utils/colors'
import { orderedTeams, memberLoad, isLoadBearing, memberWeekLoad, loadRatio } from '../utils/helpers'
import type { DAPTeam, JobOrder } from '../types'
import {
  WEEKLY_CAPACITY_HRS, HOURS_PER_DAY, WORKING_DAYS_PER_WEEK, NON_PROJECT_HRS_PER_DAY,
  FOCUS_FACTOR, LOAD_OPTIMAL, LOAD_THRESHOLD, LOAD_PEAK,
} from '../types'

export function WorkloadPage() {
  const { jobOrders } = useDataStore()
  const { resources } = useAppStore()
  const [filterTeam, setFilterTeam] = useState<DAPTeam | 'All'>('All')

  // Teams shown = the configured list plus any (legacy) team still assigned to a member
  const TEAMS = useMemo<DAPTeam[]>(() => orderedTeams(resources), [resources])

  const displayResources = useMemo(() =>
    resources.filter(r => filterTeam === 'All' || r.team === filterTeam),
    [resources, filterTeam]
  )

  function getMemberStats(resourceId: string) {
    const now = new Date()
    const in4Weeks = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
    const assigned  = jobOrders.filter(j => j.assignedMemberIds.includes(resourceId))
    // Same set the Load Ratio is built from, so hours and JO count agree.
    const active    = assigned.filter(j => isLoadBearing(j.status))
    const completed = assigned.filter(j => j.status === 'Completed')
    const next4Weeks = assigned.filter(j => {
      if (['Completed', 'Cancelled'].includes(j.status)) return false
      const d = new Date(j.deadline)
      return d >= now && d <= in4Weeks
    }).length

    // Load Ratio = (total assigned work hours ÷ load capacity) × 100
    const { hours: estimatedHrs, pct: loadPct, status, overloaded } = memberLoad(jobOrders, resourceId)
    // Actual hours logged against this week (confirmed + in-progress accrual)
    const week = memberWeekLoad(jobOrders, resourceId)

    return { assigned: assigned.length, active, completed: completed.length, next4Weeks, overloaded, estimatedHrs, loadPct, status, week }
  }

  const teamSummary = useMemo(() =>
    TEAMS.map(team => {
      const members = resources.filter(r => r.team === team)
      const totalNext4Weeks = members.reduce((acc, r) => acc + getMemberStats(r.id).next4Weeks, 0)
      const totalActive = jobOrders.filter(j =>
        !['Completed', 'Delayed', 'Cancelled'].includes(j.status) &&
        members.some(m => j.assignedMemberIds.includes(m.id))
      ).length
      const avgLoad = members.length
        ? Math.round(members.reduce((acc, r) => acc + getMemberStats(r.id).loadPct, 0) / members.length)
        : 0
      return { team, members: members.length, totalActive, totalNext4Weeks, avgLoad }
    }),
    [jobOrders, resources, TEAMS]
  )

  // ── Calendar visualization ──────────────────────────────────────────────────
  const [calWeekOffset, setCalWeekOffset] = useState(0)

  // Build 4-week grid starting from the Sunday of (current week + offset)
  const calStartSunday = useMemo(() =>
    startOfWeek(addWeeks(new Date(), calWeekOffset)),
    [calWeekOffset]
  )
  const calDays = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => addDays(calStartSunday, i)),
    [calStartSunday]
  )
  const calWeeks = useMemo(() => [0, 1, 2, 3].map(w => calDays.slice(w * 7, w * 7 + 7)), [calDays])

  // JOs to display on the calendar (filtered by team, not completed/cancelled)
  const calJOs: JobOrder[] = useMemo(() => {
    const memberIds = resources
      .filter(r => filterTeam === 'All' || r.team === filterTeam)
      .map(r => r.id)
    return jobOrders.filter(j =>
      !['Completed', 'Cancelled'].includes(j.status) &&
      j.assignedMemberIds.some(id => memberIds.includes(id))
    )
  }, [jobOrders, resources, filterTeam])

  function josOnDay(date: Date): JobOrder[] {
    return calJOs.filter(j => j.deadline && isSameDay(parseISO(j.deadline), date))
  }

  const [hoveredJO, setHoveredJO] = useState<string | null>(null)

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Capacity constants legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm flex-wrap">
        <span className="font-bold text-slate-700 dark:text-slate-300">Capacity Model:</span>
        <span title={`${WORKING_DAYS_PER_WEEK} days × ${HOURS_PER_DAY} hrs = ${WORKING_DAYS_PER_WEEK * HOURS_PER_DAY} gross, less ${NON_PROJECT_HRS_PER_DAY} hrs/day non-project, × ${FOCUS_FACTOR * 100}% focus factor`}>
          📆 ~{Math.round(WEEKLY_CAPACITY_HRS)} hrs/week per person
        </span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"/>Underload: &lt;{LOAD_OPTIMAL}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>Optimal: {LOAD_OPTIMAL}–{LOAD_THRESHOLD - 1}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/>Threshold: {LOAD_THRESHOLD}–{LOAD_PEAK - 1}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>Peak: ≥{LOAD_PEAK}%</span>
        <span className="ml-auto italic">Load Ratio = (Assigned hrs ÷ {WEEKLY_CAPACITY_HRS}) × 100</span>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {teamSummary.map(t => {
          const color = teamColor(t.team)
          const isOverloaded = t.avgLoad >= LOAD_PEAK
          return (
            <div key={t.team} className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border ${isOverloaded ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color.hex }} />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.team} Team</p>
                </div>
                {isOverloaded && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
              </div>
              <p className={`text-3xl font-black ${isOverloaded ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {t.avgLoad}%
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">avg load</p>
              <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${t.avgLoad}%`, background: isOverloaded ? '#EF4444' : color.hex }} />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                {t.members} members · {t.totalActive} active JOs
              </p>
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-1 shadow-sm">
          {(['All', ...TEAMS] as (DAPTeam | 'All')[]).map(t => (
            <button
              key={t}
              onClick={() => setFilterTeam(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterTeam === t
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {displayResources.length} member{displayResources.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Member capacity grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayResources.map(r => {
          const stats = getMemberStats(r.id)

          return (
            <div key={r.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border ${
              stats.overloaded ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${r.color} flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0`}>
                  {r.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{r.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{r.role} · {r.team} Team</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black ${loadColor(stats.status).text}`}>
                        {stats.loadPct}<span className="text-sm font-semibold">%</span>
                      </p>
                      <p className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${loadColor(stats.status).text}`}>
                        {stats.status === 'Peak'      && <><AlertTriangle size={9} /> Peak</>}
                        {stats.status === 'Threshold' && <><AlertTriangle size={9} /> Threshold</>}
                        {stats.status === 'Optimal'   && <><CheckCircle2 size={9} /> Optimal</>}
                        {stats.status === 'Underload' && 'Underload'}
                      </p>
                    </div>
                  </div>

                  {/* Planned load — from estimates */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 w-12 shrink-0">Planned</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, stats.loadPct)}%`, background: loadColor(stats.status).bar }} />
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 w-24 text-right shrink-0 tabular-nums">
                      {stats.estimatedHrs.toFixed(1)}h / ~{Math.round(WEEKLY_CAPACITY_HRS)}h
                    </span>
                  </div>

                  {/* Actual load — this week, from logged hours */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 w-12 shrink-0">Actual</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                      <div className="h-full transition-all duration-700"
                        style={{ width: `${Math.min(100, loadRatio(stats.week.confirmed))}%`, background: loadColor(stats.week.status).bar }} />
                      {/* Provisional accrual for work still Ongoing — striped, not settled */}
                      <div className="h-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100 - Math.min(100, loadRatio(stats.week.confirmed)), loadRatio(stats.week.provisional))}%`,
                          backgroundImage: `repeating-linear-gradient(45deg, ${loadColor(stats.week.status).bar}, ${loadColor(stats.week.status).bar} 3px, transparent 3px, transparent 6px)`,
                        }} />
                    </div>
                    <span className="text-[10px] w-24 text-right shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                      {stats.week.total > 0
                        ? <>{stats.week.total.toFixed(1)}h · <span className={loadColor(stats.week.status).text}>{stats.week.pct}%</span></>
                        : <span className="text-slate-300 dark:text-slate-600">none logged</span>}
                    </span>
                  </div>
                  {(stats.week.provisional > 0 || stats.week.overtime > 0) && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {stats.week.provisional > 0 && <>{stats.week.provisional.toFixed(1)}h still in progress (unconfirmed)</>}
                      {stats.week.provisional > 0 && stats.week.overtime > 0 && ' · '}
                      {stats.week.overtime > 0 && <span className="text-amber-600 dark:text-amber-400">{stats.week.overtime.toFixed(1)}h overtime</span>}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.active.length}</span> active JOs
                    <span>·</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.completed}</span> completed
                    <span>·</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{r.maxWeeklyHours}h</span>/week max
                  </div>

                  {stats.active.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {stats.active.slice(0, 3).map(jo => (
                        <div key={jo.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: activityCalendarColors[jo.activityType] }} />
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{jo.projectName}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">{jo.joNumber}</span>
                        </div>
                      ))}
                      {stats.active.length > 3 && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{stats.active.length - 3} more</p>
                      )}
                    </div>
                  )}

                  {stats.overloaded && (
                    <div className="mt-3 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 border border-red-100 dark:border-red-800">
                      <AlertTriangle size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">Load ≥{LOAD_PEAK}% (Peak) — {stats.estimatedHrs.toFixed(1)}h assigned vs ~{Math.round(WEEKLY_CAPACITY_HRS)}h capacity. Consider redistributing.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Calendar task visualization ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">4-Week Deadline Calendar</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {format(calDays[0], 'MMM d')} – {format(calDays[27], 'MMM d, yyyy')} · deadlines for {filterTeam === 'All' ? 'all teams' : `${filterTeam} team`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCalWeekOffset(o => o - 4)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCalWeekOffset(0)}
              disabled={calWeekOffset === 0}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Now
            </button>
            <button
              onClick={() => setCalWeekOffset(o => o + 4)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {calWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-700">
              {week.map((day, di) => {
                const dayJOs = josOnDay(day)
                const today = isToday(day)
                const isPast = day < new Date() && !today
                return (
                  <div
                    key={di}
                    className={`min-h-[90px] p-2 transition-colors
                      ${today ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}
                      ${isPast ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}
                    `}
                  >
                    {/* Date number */}
                    <div className="mb-1.5">
                      <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-bold
                        ${today
                          ? 'bg-brand-600 text-white'
                          : isPast
                            ? 'text-slate-300 dark:text-slate-600'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {di === 0 && (
                        <span className="ml-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                          {format(day, 'MMM')}
                        </span>
                      )}
                    </div>

                    {/* JO chips */}
                    <div className="space-y-0.5">
                      {dayJOs.slice(0, 3).map(jo => {
                        const color = activityCalendarColors[jo.activityType]
                        const isHovered = hoveredJO === jo.id
                        return (
                          <div
                            key={jo.id}
                            onMouseEnter={() => setHoveredJO(jo.id)}
                            onMouseLeave={() => setHoveredJO(null)}
                            className="relative group"
                          >
                            <div
                              className={`text-white text-[9px] font-semibold px-1.5 py-0.5 rounded truncate cursor-default transition-all
                                ${isHovered ? 'opacity-100 scale-[1.03]' : 'opacity-85'}`}
                              style={{ background: color }}
                            >
                              {jo.projectName}
                            </div>
                            {/* Tooltip */}
                            {isHovered && (
                              <div className="absolute z-50 bottom-full left-0 mb-1 w-48 bg-slate-900 dark:bg-slate-700 text-white rounded-xl shadow-xl p-2.5 text-[10px] pointer-events-none">
                                <p className="font-bold text-[11px] mb-1 truncate">{jo.projectName}</p>
                                <p className="text-slate-300">{jo.joNumber} · {jo.activityType}</p>
                                <p className="text-slate-300 mt-0.5">Deadline: {format(parseISO(jo.deadline), 'MMM d, yyyy')}</p>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {jo.assignedMemberIds.map(mid => {
                                    const m = resources.find(r => r.id === mid)
                                    return m ? (
                                      <span key={mid} className={`${m.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full`}>
                                        {m.initials}
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {dayJOs.length > 3 && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 pl-1">+{dayJOs.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(activityCalendarColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{type}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

