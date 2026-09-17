import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { JobOrder, Resource } from '../types'
import { WEEKLY_CAPACITY_HRS } from '../types'
import { groupByPerson, memberLoad } from '../utils/helpers'
import { loadColor } from '../utils/colors'

interface Props {
  resources: Resource[]
  jobOrders: JobOrder[]
  /** Resource (role) ids currently selected. */
  selectedIds: string[]
  onToggle: (resourceId: string) => void
  /** Show the overall load bar per person (Review & Assign). */
  showLoad?: boolean
  /** Layout density. */
  compact?: boolean
}

/**
 * Assign work to a person in a specific role. Each person appears once with
 * their overall load across every role, so an assigner sees the true picture;
 * the role chips choose which workload bucket the job lands in. Selecting a
 * chip selects that role's resource id — the job order data model is unchanged.
 */
export function MemberRolePicker({ resources, jobOrders, selectedIds, onToggle, showLoad = false, compact = false }: Props) {
  // Removed roles stay in the data for history but are not offered here.
  const people = useMemo(
    () => groupByPerson(resources)
      .map(p => ({ ...p, roles: p.roles.filter(r => r.active) }))
      .filter(p => p.roles.length > 0),
    [resources]
  )

  return (
    <div className={`space-y-1.5 ${compact ? '' : ''}`}>
      {people.map(p => {
        const load = memberLoad(jobOrders, p.ids)
        const pct = Math.min(100, load.pct)
        const anySelected = p.roles.some(r => selectedIds.includes(r.id))
        return (
          <div
            key={p.key}
            className={`rounded-xl border transition-colors ${compact ? 'p-2' : 'p-2.5'} ${
              anySelected
                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700'
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`${compact ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-[11px]'} rounded-full ${p.color} flex items-center justify-center text-white font-bold shrink-0`}>
                {p.initials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`${compact ? 'text-xs' : 'text-[13px]'} font-semibold text-slate-900 dark:text-slate-100 truncate`}>{p.name}</p>
                  {showLoad && (
                    <span className={`flex items-center gap-1 text-[10px] font-bold shrink-0 ${loadColor(load.status).text}`}>
                      {load.overloaded && <AlertTriangle size={10} />}
                      {load.pct}% · {load.status}
                    </span>
                  )}
                </div>

                {/* Role chips — the workload bucket the assignment lands in */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.roles.map(r => {
                    const on = selectedIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onToggle(r.id)}
                        aria-pressed={on}
                        title={`${p.name} → ${r.role}${p.roles.length > 1 ? ` (${r.team})` : ''}`}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                          on
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
                        }`}
                      >
                        {on ? '✓ ' : ''}{r.role}
                      </button>
                    )
                  })}
                </div>

                {showLoad && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: loadColor(load.status).bar }} />
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap tabular-nums"
                      title={`Overall across all roles · ${load.hours.toFixed(1)}h of ~${Math.round(WEEKLY_CAPACITY_HRS)}h weekly capacity`}>
                      {load.hours.toFixed(1)}h / ~{Math.round(WEEKLY_CAPACITY_HRS)}h
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {people.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-2">No team members available.</p>
      )}
    </div>
  )
}
