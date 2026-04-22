import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, BarChart3,
  PieChart as PieIcon, Users, Target, Zap, Activity,
  Camera, Video, Palette, Scissors, Mic, Headphones,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { RESOURCES } from '../data/seed'
import { activityCalendarColors, teamColors } from '../utils/colors'
import { isOverdue } from '../utils/helpers'
import type { ActivityType } from '../types'

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot', 'Video Shoot', 'Static Artwork Design',
  'Video Editing', 'Audio Recording', 'Audio Editing',
]

const activityIcon: Record<ActivityType, React.ElementType> = {
  'Photo Shoot':           Camera,
  'Video Shoot':           Video,
  'Static Artwork Design': Palette,
  'Video Editing':         Scissors,
  'Audio Recording':       Mic,
  'Audio Editing':         Headphones,
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
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconColor ?? 'bg-blue-100 dark:bg-blue-900/40'}`}>
        <Icon size={16} className={iconColor ? 'text-white' : 'text-blue-600 dark:text-blue-400'} />
      </div>
      <div>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export function ReportsPage() {
  const { jobOrders } = useDataStore()
  const { theme } = useAppStore()
  const isDark = theme === 'dark'

  const tooltipStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, fontSize: 12, padding: '8px 12px',
    color: isDark ? '#f1f5f9' : '#0f172a',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  }

  const summary = useMemo(() => {
    const total = jobOrders.length
    const completed = jobOrders.filter((j) => j.status === 'Completed').length
    const delayed = jobOrders.filter((j) => j.status === 'Delayed').length
    const cancelled = jobOrders.filter((j) => j.status === 'Cancelled').length
    const inFlight = jobOrders.filter((j) => ['Scheduled', 'In Progress', 'For Review'].includes(j.status)).length
    const completionRate = total ? Math.round((completed / total) * 100) : 0
    const onTimeCompleted = jobOrders.filter((j) => j.status === 'Completed' && !isOverdue(j.deadline)).length
    const onTimeRate = completed ? Math.round((onTimeCompleted / completed) * 100) : 0
    const executionIndex = Math.round((onTimeRate * 0.6 + completionRate * 0.4))
    return { total, completed, delayed, cancelled, inFlight, completionRate, onTimeRate, executionIndex }
  }, [jobOrders])

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const y = d.getFullYear()
      const m = d.getMonth()
      const inMonth = jobOrders.filter((j) => {
        const c = new Date(j.createdAt)
        return c.getFullYear() === y && c.getMonth() === m
      })
      return {
        month: label,
        submitted: inMonth.length,
        completed: inMonth.filter((j) => j.status === 'Completed').length,
        delayed: inMonth.filter((j) => j.status === 'Delayed').length,
      }
    })
  }, [jobOrders])

  const activityData = useMemo(() =>
    ACTIVITY_TYPES.map((type) => {
      const all = jobOrders.filter((j) => j.activityType === type)
      return {
        type: type.split(' ')[0],
        fullType: type,
        total: all.length,
        completed: all.filter((j) => j.status === 'Completed').length,
        color: activityCalendarColors[type],
        icon: activityIcon[type],
      }
    }).filter((a) => a.total > 0),
  [jobOrders])

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    jobOrders.forEach((j) => { counts[j.status] = (counts[j.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [jobOrders])

  const statusColors2: Record<string, string> = {
    Pending: '#eab308', Approved: '#3b82f6', Scheduled: '#6366f1',
    'In Progress': '#8b5cf6', 'For Review': '#f97316', Completed: '#10b981',
    Delayed: '#ef4444', Cancelled: '#94a3b8',
  }

  const teamData = useMemo(() => {
    return ['BMG', 'MOD', 'MTO', 'CBE'].map((team) => ({
      team,
      total: jobOrders.filter((j) => j.requestingTeam === team).length,
      completed: jobOrders.filter((j) => j.requestingTeam === team && j.status === 'Completed').length,
    }))
  }, [jobOrders])

  const resourceData = useMemo(() => {
    return RESOURCES.map((r) => {
      const assigned = jobOrders.filter((j) =>
        j.assignedMemberIds.includes(r.id) && !['Completed', 'Delayed'].includes(j.status)
      ).length
      const util = Math.min(100, Math.round((assigned / 5) * 100))
      return { name: r.initials, fullName: r.name, role: r.role, util, color: r.color, team: r.team }
    })
  }, [jobOrders])

  const priorityData = useMemo(() => {
    const map: Record<string, number> = { High: 0, Medium: 0, Low: 0 }
    jobOrders.forEach((j) => { map[j.priority]++ })
    return [
      { name: 'High', value: map.High, color: '#ef4444' },
      { name: 'Medium', value: map.Medium, color: '#f59e0b' },
      { name: 'Low', value: map.Low, color: '#10b981' },
    ].filter((d) => d.value > 0)
  }, [jobOrders])

  const axisColor = isDark ? '#475569' : '#cbd5e1'
  const tickColor = isDark ? '#64748b' : '#94a3b8'

  return (
    <div className="space-y-6 max-w-7xl">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Execution Index"
          value={summary.executionIndex}
          sub="Composite performance score"
          color="text-blue-600 dark:text-blue-400"
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
          <SectionHeader icon={BarChart3} title="6-Month JO Trend" subtitle="Submitted, completed, and delayed by month" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
              <Bar dataKey="submitted" name="Submitted" fill="#7C3AED" radius={[4, 4, 0, 0]} />
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

      {/* Activity type breakdown — visual cards */}
      {activityData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={Activity} title="JOs by Activity Type" subtitle="Total vs completed per production type" />
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
        </div>
      )}

      {/* Team breakdown + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <SectionHeader icon={Users} title="JOs by Requesting Team" subtitle="Total submitted vs completed" />
          {teamData.some((t) => t.total > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamData} barGap={4} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="team" tick={{ fontSize: 12, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }} />
                <Bar dataKey="total" name="Total" fill="#7C3AED" radius={[4, 4, 0, 0]} />
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

      {/* Resource utilization */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <SectionHeader icon={Users} title="Individual Resource Load" subtitle="Active JO workload per team member" />
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
                  <span className={`text-sm font-black ml-2 ${r.util > 90 ? 'text-red-600 dark:text-red-400' : r.util >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {r.util}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${r.util}%`,
                    background: r.util > 90 ? '#ef4444' : r.util >= 70 ? '#10b981' : '#7C3AED',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution index hero */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-blue-300" />
              <p className="text-blue-200 text-sm font-semibold">DAP Execution Index</p>
            </div>
            <p className="text-7xl font-black leading-none">{summary.executionIndex}</p>
            <p className="text-blue-200 text-xs mt-2">60% on-time delivery · 40% completion rate</p>
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
                <div className="flex items-center gap-1.5 text-blue-200">
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

