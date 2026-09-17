import type { ActivityType } from '../types'
import { ACTIVITY_HOURS } from '../types'
import { activityCalendarColors } from '../utils/colors'

// ── Service catalog ──────────────────────────────────────────────────────────
// The single source for what services exist, how they are labelled, which DAP
// section handles them, and their planning defaults. The request form, the
// filters on Job Orders / Calendar / Reports, and Settings → Activity Types
// all read from here, so they can no longer drift apart.

/** Services a requestor can choose, in the order the booking form offers them. */
export const SERVICE_ORDER: ActivityType[] = [
  'Photo Shoot', 'Video Shoot',
  'Static Artwork Design', 'Digital Design', 'Graphics', 'Printing', 'ASC',
  'Video Editing', 'Audio Services', 'Content Writing',
]

/** No longer offered on the form; kept so job orders created under them stay
 *  visible and filterable. */
export const LEGACY_ACTIVITY_TYPES: ActivityType[] = ['Audio Recording', 'Audio Editing']

export const ALL_ACTIVITY_TYPES: ActivityType[] = [...SERVICE_ORDER, ...LEGACY_ACTIVITY_TYPES]

export const SERVICE_ICONS: Record<string, string> = {
  'Photo Shoot':           '📷',
  'Video Shoot':           '🎬',
  'Static Artwork Design': '🎨',
  'Digital Design':        '💻',
  'Graphics':              '🖼️',
  'Printing':              '🖨️',
  'ASC':                   '📋',
  'Video Editing':         '✂️',
  'Audio Recording':       '🎙️',
  'Audio Editing':         '🎧',
  'Audio Services':        '🎙️',
  'Content Writing':       '✍️',
}
export const SERVICE_DESC: Record<string, string> = {
  'Photo Shoot':           'Product, event, or portrait photography',
  'Video Shoot':           'Video production & on-site filming',
  'Static Artwork Design': 'Print-ready layouts, banners & artwork',
  'Digital Design':        'Social graphics, motion assets & digital creatives',
  'Graphics':              'Graphic layouts, illustrations & visual assets',
  'Printing':              'Print production — tarpaulins, flyers, banners & more',
  'ASC':                   'Advertising Standards Council submission & approval',
  'Video Editing':         'Post-production & video assembly',
  'Audio Recording':       'Voice-over, podcast & recording sessions',
  'Audio Editing':         'Mixing, mastering & audio cleanup',
  'Audio Services':        'Voice-over, podcast, recording & audio post-production',
  'Content Writing':       'Copywriting, scripts, captions & editorial content',
}
/** Which DAP section (Team Members team) handles each service. */
export const SERVICE_SECTION: Record<string, string> = {
  'Photo Shoot':           'Multimedia',
  'Video Shoot':           'Audio/Video',
  'Static Artwork Design': 'Graphics',
  'Digital Design':        'Graphics',
  'Graphics':              'Graphics',
  'Printing':              'Graphics',
  'ASC':                   'ASC Compliance',
  'Video Editing':         'Audio/Video',
  'Audio Services':        'Audio/Video',
  'Audio Recording':       'Audio/Video',
  'Audio Editing':         'Audio/Video',
  'Content Writing':       'Content Writer',
}

export interface ServiceInfo {
  type: ActivityType
  icon: string
  description: string
  section: string
  color: string
  /** Planning estimate used for the Load Ratio when a job order has no override. */
  defaultHours: number
  legacy: boolean
}

export const SERVICES: ServiceInfo[] = ALL_ACTIVITY_TYPES.map(type => ({
  type,
  icon: SERVICE_ICONS[type] ?? '•',
  description: SERVICE_DESC[type] ?? '',
  section: SERVICE_SECTION[type] ?? '—',
  color: activityCalendarColors[type] ?? '#94A3B8',
  defaultHours: ACTIVITY_HOURS[type] ?? 4,
  legacy: LEGACY_ACTIVITY_TYPES.includes(type),
}))
