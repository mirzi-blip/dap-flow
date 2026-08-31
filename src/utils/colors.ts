import type { ActivityType, JOStatus, Priority } from '../types'

// Activity colors — per wireframe spec (Blue/Red/Green/Purple/Orange)
export const activityColors: Record<ActivityType, { bg: string; text: string; border: string; dot: string }> = {
  'Photo Shoot':           { bg: 'bg-brand-50',    text: 'text-brand-700',   border: 'border-brand-200',   dot: 'bg-brand-500' },
  'Video Shoot':           { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  'Static Artwork Design': { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500' },
  'Digital Design':        { bg: 'bg-brand-50',  text: 'text-brand-700', border: 'border-brand-200', dot: 'bg-brand-500' },
  'Video Editing':         { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Graphics':              { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500' },
  'Printing':              { bg: 'bg-teal-50',    text: 'text-teal-700',   border: 'border-teal-200',   dot: 'bg-teal-500' },
  'ASC':                   { bg: 'bg-brand-50',  text: 'text-brand-700', border: 'border-brand-200', dot: 'bg-brand-500' },
  'Audio Recording':       { bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-200',    dot: 'bg-sky-500' },
  'Audio Editing':         { bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-200',   dot: 'bg-pink-500' },
  'Audio Services':        { bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-200',    dot: 'bg-sky-500' },
  'Content Writing':       { bg: 'bg-cyan-50',    text: 'text-cyan-700',   border: 'border-cyan-200',   dot: 'bg-cyan-500' },
}

export const activityCalendarColors: Record<ActivityType, string> = {
  'Photo Shoot':           '#3B82F6',
  'Video Shoot':           '#EF4444',
  'Static Artwork Design': '#10B981',
  'Digital Design':        '#5164C0',
  'Video Editing':         '#F97316',
  'Graphics':              '#F59E0B',
  'Printing':              '#14B8A6',
  'ASC':                   '#6F84DB',
  'Audio Recording':       '#0EA5E9',
  'Audio Editing':         '#EC4899',
  'Audio Services':        '#0EA5E9',
  'Content Writing':       '#06B6D4',
}

export const activityGradients: Record<ActivityType, string> = {
  'Photo Shoot':           'from-brand-500 to-brand-600',
  'Video Shoot':           'from-red-500 to-rose-600',
  'Static Artwork Design': 'from-emerald-500 to-teal-600',
  'Digital Design':        'from-brand-500 to-purple-600',
  'Video Editing':         'from-orange-500 to-amber-600',
  'Graphics':              'from-amber-400 to-orange-500',
  'Printing':              'from-teal-500 to-cyan-600',
  'ASC':                   'from-brand-500 to-brand-600',
  'Audio Recording':       'from-sky-500 to-brand-600',
  'Audio Editing':         'from-pink-500 to-rose-500',
  'Audio Services':        'from-sky-500 to-brand-600',
  'Content Writing':       'from-cyan-500 to-sky-600',
}

export const statusColors: Record<JOStatus, { bg: string; text: string; ring: string; glow: string }> = {
  'To Do':      { bg: 'bg-slate-100',  text: 'text-slate-600',  ring: 'ring-slate-200',  glow: '#94A3B8' },
  Ongoing:      { bg: 'bg-brand-50',   text: 'text-brand-700',  ring: 'ring-brand-200',  glow: '#5164C0' },

  'For Review':     { bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-200',  glow: '#F59E0B' },
  'Needs Revision': { bg: 'bg-rose-50',    text: 'text-rose-700',   ring: 'ring-rose-200',   glow: '#E11D48' },
  'For Approval':   { bg: 'bg-violet-50',  text: 'text-violet-700', ring: 'ring-violet-200', glow: '#8B5CF6' },
  Completed:        { bg: 'bg-emerald-50', text: 'text-emerald-700',ring: 'ring-emerald-200',glow: '#10B981' },
  Delayed:      { bg: 'bg-red-50',     text: 'text-red-700',    ring: 'ring-red-200',    glow: '#EF4444' },
  Cancelled:    { bg: 'bg-slate-100',  text: 'text-slate-500',  ring: 'ring-slate-200',  glow: '#94A3B8' },
}

export const priorityColors: Record<Priority, { bg: string; text: string; dot: string }> = {
  High:   { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  Medium: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  Low:    { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
}

export const teamColors: Record<string, { hex: string; tailwind: string; light: string }> = {
  // Current teams
  'Audio/Video':    { hex: '#0EA5E9', tailwind: 'bg-sky-500',     light: 'bg-sky-50' },
  'Multimedia':     { hex: '#5164C0', tailwind: 'bg-brand-500',   light: 'bg-brand-50' },
  'Graphics':       { hex: '#F59E0B', tailwind: 'bg-amber-500',   light: 'bg-amber-50' },
  'Content Writer': { hex: '#10B981', tailwind: 'bg-emerald-500', light: 'bg-emerald-50' },
  'ASC Compliance': { hex: '#EC4899', tailwind: 'bg-pink-500',    light: 'bg-pink-50' },
  'Printing':       { hex: '#14B8A6', tailwind: 'bg-teal-500',    light: 'bg-teal-50' },
  // Legacy teams (kept so pre-existing members still render correctly)
  Photo:  { hex: '#3B82F6', tailwind: 'bg-brand-500',    light: 'bg-brand-50' },
  Video:  { hex: '#EF4444', tailwind: 'bg-red-500',     light: 'bg-red-50' },
  Audio:  { hex: '#8B9FE8', tailwind: 'bg-brand-500',  light: 'bg-brand-50' },
  Design: { hex: '#10B981', tailwind: 'bg-emerald-500', light: 'bg-emerald-50' },
}

// Safe lookup with a neutral fallback for any team not in the map
export function teamColor(team: string) {
  return teamColors[team] ?? { hex: '#6F84DB', tailwind: 'bg-brand-500', light: 'bg-brand-50' }
}

export const kpiGradients = [
  { from: '#6F84DB', to: '#8B9FE8', icon: 'bg-gradient-to-br from-brand-500 to-brand-600' },
  { from: '#F59E0B', to: '#F97316', icon: 'bg-gradient-to-br from-amber-400 to-orange-500' },
  { from: '#8B9FE8', to: '#EC4899', icon: 'bg-gradient-to-br from-brand-500 to-pink-500' },
  { from: '#10B981', to: '#0EA5E9', icon: 'bg-gradient-to-br from-emerald-500 to-sky-500' },
]


// Load Ratio bands — one palette for workload, dashboard, reports and the
// assignment picker so a member reads the same everywhere.
export const loadStatusColors: Record<string, { hex: string; text: string; bar: string }> = {
  Underload: { hex: '#94A3B8', text: 'text-slate-500 dark:text-slate-400',     bar: '#94A3B8' },
  Optimal:   { hex: '#10B981', text: 'text-emerald-600 dark:text-emerald-400', bar: '#10B981' },
  Threshold: { hex: '#F59E0B', text: 'text-amber-600 dark:text-amber-400',     bar: '#F59E0B' },
  Peak:      { hex: '#EF4444', text: 'text-red-600 dark:text-red-400',         bar: '#EF4444' },
}

export function loadColor(status: string) {
  return loadStatusColors[status] ?? loadStatusColors.Underload
}
