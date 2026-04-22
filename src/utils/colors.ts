import type { ActivityType, JOStatus, Priority } from '../types'

// Activity colors — per wireframe spec (Blue/Red/Green/Purple/Orange)
export const activityColors: Record<ActivityType, { bg: string; text: string; border: string; dot: string }> = {
  'Photo Shoot':           { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  'Video Shoot':           { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  'Static Artwork Design': { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500' },
  'Video Editing':         { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Audio Recording':       { bg: 'bg-blue-50',  text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Audio Editing':         { bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-200',   dot: 'bg-pink-500' },
}

export const activityCalendarColors: Record<ActivityType, string> = {
  'Photo Shoot':           '#3B82F6',
  'Video Shoot':           '#EF4444',
  'Static Artwork Design': '#10B981',
  'Video Editing':         '#F97316',
  'Audio Recording':       '#8B5CF6',
  'Audio Editing':         '#EC4899',
}

export const activityGradients: Record<ActivityType, string> = {
  'Photo Shoot':           'from-blue-500 to-blue-600',
  'Video Shoot':           'from-red-500 to-rose-600',
  'Static Artwork Design': 'from-emerald-500 to-teal-600',
  'Video Editing':         'from-orange-500 to-amber-600',
  'Audio Recording':       'from-blue-500 to-purple-600',
  'Audio Editing':         'from-pink-500 to-blue-500',
}

export const statusColors: Record<JOStatus, { bg: string; text: string; ring: string; glow: string }> = {
  Pending:      { bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200',  glow: '#F59E0B' },
  Approved:     { bg: 'bg-sky-50',     text: 'text-sky-700',    ring: 'ring-sky-200',    glow: '#0EA5E9' },
  Scheduled:    { bg: 'bg-indigo-50',  text: 'text-indigo-700', ring: 'ring-indigo-200', glow: '#6366F1' },
  'In Progress':{ bg: 'bg-blue-50',  text: 'text-blue-700', ring: 'ring-blue-200', glow: '#8B5CF6' },
  'For Review': { bg: 'bg-orange-50',  text: 'text-orange-700', ring: 'ring-orange-200', glow: '#F97316' },
  Completed:    { bg: 'bg-emerald-50', text: 'text-emerald-700',ring: 'ring-emerald-200',glow: '#10B981' },
  Delayed:      { bg: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-200',    glow: '#EF4444' },
  Cancelled:    { bg: 'bg-slate-100',  text: 'text-slate-500',  ring: 'ring-slate-200',  glow: '#94A3B8' },
}

export const priorityColors: Record<Priority, { bg: string; text: string; dot: string }> = {
  High:   { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  Medium: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  Low:    { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
}

export const teamColors: Record<string, { hex: string; tailwind: string; light: string }> = {
  Photo:  { hex: '#3B82F6', tailwind: 'bg-blue-500',    light: 'bg-blue-50' },
  Video:  { hex: '#EF4444', tailwind: 'bg-red-500',     light: 'bg-red-50' },
  Audio:  { hex: '#8B5CF6', tailwind: 'bg-blue-500',  light: 'bg-blue-50' },
  Design: { hex: '#10B981', tailwind: 'bg-emerald-500', light: 'bg-emerald-50' },
}

export const kpiGradients = [
  { from: '#6366F1', to: '#8B5CF6', icon: 'bg-gradient-to-br from-indigo-500 to-blue-600' },
  { from: '#F59E0B', to: '#F97316', icon: 'bg-gradient-to-br from-amber-400 to-orange-500' },
  { from: '#8B5CF6', to: '#EC4899', icon: 'bg-gradient-to-br from-blue-500 to-pink-500' },
  { from: '#10B981', to: '#0EA5E9', icon: 'bg-gradient-to-br from-emerald-500 to-sky-500' },
]

