import { useState, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { teamColors, activityCalendarColors } from '../utils/colors'
import type { DAPTeam } from '../types'

const TEAMS: DAPTeam[] = ['Photo', 'Video', 'Audio', 'Design']

export function WorkloadPage() {
  const { jobOrders } = useDataStore()
  const { resources } = useAppStore()
  const [filterTeam, setFilterTeam] = useState<DAPTeam | 'All'>('All')

  const displayResources = useMemo(() =>
    resources.filter(r => filterTeam === 'All' || r.team === filterTeam),
    [resources, filterTeam]
  )

  function getMemberStats(resourceId: string) {
    const assigned = jobOrders.filter(j => j.assignedMemberIds.includes(resourceId))
    const active = assigned.filter(j => !['Completed', 'Delayed', 'Cancelled'].includes(j.status))
    const completed = assigned.filter(j => j.status === 'Completed')
    const util = Math.min(100, Math.round((active.length / 5) * 100))
    return { assigned: assigned.length, active, completed: completed.length, util }
  }

  const teamSummary = useMemo(() =>
    TEAMS.map(team => {
      const members = resources.filter(r => r.team === team)
      const totalActive = jobOrders.filter(j =>
        !['Completed', 'Delayed', 'Cancelled'].includes(j.status) &&
        members.some(m => j.assignedMemberIds.includes(m.id))
      ).length
      const avgUtil = members.length
        ? Math.round(members.reduce((acc, r) => acc + getMemberStats(r.id).util, 0) / members.length)
        : 0
      return { team, members: members.length, totalActive, avgUtil }
    }),
    [jobOrders, resources]
  )

  const projectLoad = useMemo(() => {
    const map: Record<string, number> = {}
    jobOrders.filter(j => !['Completed', 'Cancelled'].includes(j.status)).forEach(j => {
      map[j.projectName] = (map[j.projectName] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [jobOrders])

  const maxProjectLoad = Math.max(...projectLoad.map(p => p.count), 1)

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {teamSummary.map(t => {
          const color = teamColors[t.team]
          return (
            <div key={t.team} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color.hex }} />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.team} Team</p>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {t.avgUtil}<span className="text-lg font-bold text-slate-400 dark:text-slate-500">%</span>
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">avg utilization</p>
              <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${t.avgUtil}%`, background: t.avgUtil > 90 ? '#EF4444' : color.hex }}
                />
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
                  ? 'bg-blue-600 text-white shadow-sm'
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
          const isOverloaded = stats.util > 90
          const teamColor = teamColors[r.team]

          return (
            <div key={r.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border ${
              isOverloaded ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'
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
                      <p className={`text-2xl font-black ${
                        isOverloaded ? 'text-red-600 dark:text-red-400' :
                        stats.util >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                        'text-slate-600 dark:text-slate-400'
                      }`}>
                        {stats.util}%
                      </p>
                      {isOverloaded && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold flex items-center gap-0.5 justify-end">
                          <AlertTriangle size={9} /> Overloaded
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.util}%`,
                        background: isOverloaded
                          ? 'linear-gradient(90deg,#EF4444,#DC2626)'
                          : `linear-gradient(90deg,${teamColor.hex}cc,${teamColor.hex})`,
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.active.length}</span> active JOs
                    <span>·</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.completed}</span> completed
                    <span>·</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{r.maxWeeklyHours}h</span>/week
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

                  {isOverloaded && (
                    <div className="mt-3 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2 border border-red-100 dark:border-red-800">
                      <AlertTriangle size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">Exceeds optimal capacity — consider reassigning tasks</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Project load heatmap */}
      {projectLoad.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">Project Load Distribution</h2>
          <div className="space-y-3">
            {projectLoad.map(p => (
              <div key={p.name} className="flex items-center gap-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium w-52 truncate flex-shrink-0">{p.name}</p>
                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(p.count / maxProjectLoad) * 100}%`,
                      background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 w-8 text-right flex-shrink-0">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

