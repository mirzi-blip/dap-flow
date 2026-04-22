import type { ActivityType, JOStatus, Priority } from '../../types'
import { activityColors, statusColors, priorityColors } from '../../utils/colors'

interface BadgeProps {
  label: string
  className?: string
}

export function Badge({ label, className }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export function ActivityBadge({ type }: { type: ActivityType }) {
  const c = activityColors[type]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {type}
    </span>
  )
}

export function StatusBadge({ status }: { status: JOStatus }) {
  const c = statusColors[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${c.bg} ${c.text} ${c.ring}`}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const c = priorityColors[priority]
  const icon = priority === 'High' ? '▲' : priority === 'Medium' ? '■' : '▼'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className="text-[10px]">{icon}</span>
      {priority}
    </span>
  )
}
