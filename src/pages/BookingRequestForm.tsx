import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Camera, Aperture, ArrowLeft, ChevronLeft, ChevronRight, Search,
  ChevronDown, CalendarDays, Clock, Info, AlertTriangle,
} from 'lucide-react'
import { supabase, requestToRow, uploadBookingFile } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import type { ActivityType, BookingRequest, Approver, ShootType, ProjectScale, DesignSpecs } from '../types'
import { getCrewRequirement } from '../types'
import { generateId } from '../utils/helpers'

// ── Activity catalogue ────────────────────────────────────────────────────────
const ACTIVITY_TYPES: ActivityType[] = [
  'ASC',
  'Audio Services',
  'Digital Design',
  'Graphics',
  'Photo Shoot',
  'Printing',
  'Static Artwork Design',
  'Video Editing',
  'Video Shoot',
]

const SHOOT_ACTIVITIES: ActivityType[]      = ['Photo Shoot', 'Video Shoot']
const DESIGN_ACTIVITIES: ActivityType[]     = ['Static Artwork Design', 'Digital Design', 'Graphics', 'Printing', 'ASC', 'Video Editing', 'Audio Services']
const DATE_ONLY_ACTIVITIES: ActivityType[]  = ['Static Artwork Design', 'Digital Design', 'Graphics', 'Printing', 'ASC', 'Audio Services', 'Audio Recording', 'Audio Editing', 'Video Editing']

// ── Dropdown options (static fallbacks used before formOptions load) ───────────
const PAPER_SIZES_FB    = ['A4', 'A3', 'A2', 'A1', 'A0', 'Letter (8.5"×11")', 'Legal (8.5"×14")', 'Tabloid (11"×17")', '4R (4"×6")', '5R (5"×7")', 'Custom']
const MATERIAL_TYPES_FB = ['Tarpaulin', 'Glossy Paper', 'Matte Paper', 'Canvas', 'Vinyl', 'Sintra Board', 'Foam Board', 'Sticker Paper', 'Fabric', 'Custom']
const ORIENTATIONS_FB   = ['Portrait', 'Landscape', 'Square']

const GRAPHICS_MATERIALS_FB: Record<string, string[]> = {
  'Large Format Printing': ['HDPE Tarpaulin', 'LDPE Tarpaulin', 'Multi Layer Tarpaulin', 'Cross Laminated Tarpaulin', 'PVC Coated Tarpaulin', 'Cotton Canvas Tarpaulin', 'Vinyl stickers', 'Sintra (PVC board)'],
  'Offset Lithography':    ['Bond Paper', 'Onion Skin', 'Carbonless Paper', 'Bookpaper', 'C1S coated', 'Matte coated', 'C2S coated', 'Foldcote', 'Claycoated Board', 'Carrier Board'],
  'Sublimation Printing':  ['Polyester Fabric', 'Polyester T-shirt', 'Sports Jersey Fabric', 'Satin Fabric', 'Microfiber Fabric', 'Canvas (Polyester)', 'Ceramic Mug (Sublimation Coated)', 'Metal Sheet (Sublimation Coated)', 'Aluminum Plate (Sublimation Coated)', 'MDF Wood (Sublimation Coated)', 'Acrylic (Sublimation Coated)', 'Glass (Sublimation Coated)', 'Mouse Pad', 'Puzzle Board', 'Lanyard'],
}

const DEFAULT_DEPTS = ['BMG', 'MOD', 'MTO', 'CBE', 'Sales', 'HR']
const MAX_CONCURRENT = 3

const PROJECT_SCALES: ProjectScale[] = [
  'Small Scale',
  'Medium Scale',
  'Large Scale',
  'Campaign Level',
]

// ── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  activityType:        ActivityType | ''
  shootType:           ShootType | ''
  projectScale:        ProjectScale | ''  // kept in state for DB compat, not shown in UI
  department:          string
  departmentOther:     string
  departmentLocal:     string
  requestorName:       string
  requestorEmail:      string
  preparedBy:          string
  selectedApproverId:  string
  approverName:        string
  approverEmail:       string
  approverPosition:    string
  projectName:         string
  neededDate:          string
  endDate:             string
  startTime:           string
  endTime:             string
  venue:               string
  notes:               string
  // Design specs (Static / Digital / Video)
  dsw_paperSize:        string
  dsw_orientation:      string
  dsw_colorMode:        string
  dsw_dimensions:       string
  dsw_material:         string
  dsw_additionalNotes:  string
  dsw_platform:         string   // Video Editing — output platform
  dsw_shootTypeDetail:  string   // Video Shoot — stream/BTS
}

const EMPTY: FormState = {
  activityType: '', shootType: '', projectScale: '',
  department: '', departmentOther: '', departmentLocal: '',
  requestorName: '', requestorEmail: '', preparedBy: '',
  selectedApproverId: '', approverName: '', approverEmail: '', approverPosition: '',
  projectName: '', neededDate: '', endDate: '', startTime: '', endTime: '',
  venue: '', notes: '',
  dsw_paperSize: '', dsw_orientation: '', dsw_colorMode: '',
  dsw_dimensions: '', dsw_material: '', dsw_additionalNotes: '',
  dsw_platform: '', dsw_shootTypeDetail: '',
}

// ── Icons / descriptions ──────────────────────────────────────────────────────
const SERVICE_ICONS: Record<string, string> = {
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
}

const SERVICE_DESC: Record<string, string> = {
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
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Crew-requirement badge ────────────────────────────────────────────────────
function CrewBadge({ activity, shootType }: { activity: ActivityType | ''; shootType: ShootType | '' }) {
  const crew = getCrewRequirement(activity, shootType || undefined)
  const cfg = {
    'Full Crew':    { bg: 'bg-red-50 border-red-200 text-red-700',    dot: 'bg-red-500',    label: 'Full Crew Required' },
    'Partial Crew': { bg: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', label: 'Partial Crew' },
    'Minimal Crew': { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', label: 'Minimal Crew' },
  }[crew]

  return (
    <div className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-[11px] font-bold ${cfg.bg}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  )
}

// ── Scale badge ───────────────────────────────────────────────────────────────
function ScaleBadge({ scale }: { scale: ProjectScale | '' }) {
  if (!scale) return null
  const cfg: Record<ProjectScale, string> = {
    'Small Scale':    'bg-slate-100 text-slate-600 border-slate-200',
    'Medium Scale':   'bg-brand-50 text-brand-600 border-brand-200',
    'Large Scale':    'bg-brand-50 text-brand-600 border-brand-200',
    'Campaign Level': 'bg-orange-50 text-orange-600 border-orange-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 border rounded-lg px-2.5 py-1 text-[11px] font-bold ${cfg[scale]}`}>
      {scale}
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ page }: { page: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Select Service' },
    { n: 2, label: 'Choose Date' },
    { n: 3, label: 'Fill Details' },
  ]
  return (
    <div className="flex items-center justify-center gap-2 pt-6 pb-2 px-4">
      {steps.map((s, i) => {
        const done   = page > s.n
        const active = page === s.n
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center transition-all
                ${done   ? 'bg-white/30 text-white'
                : active ? 'bg-white text-brand-800 shadow'
                         : 'bg-white/20 text-white/50'}`}>
                {done
                  ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  : s.n}
              </div>
              <span className={`text-xs font-semibold transition-all ${active ? 'text-white' : done ? 'text-white/60' : 'text-white/40'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-white/30 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Time Picker ───────────────────────────────────────────────────────────────
interface TimePickerProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

function TimePicker({ value, onChange, placeholder = 'Select time' }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hour24 = value ? parseInt(value.split(':')[0], 10) : null
  const minute  = value ? parseInt(value.split(':')[1], 10) : null
  const ampm    = hour24 !== null ? (hour24 >= 12 ? 'PM' : 'AM') : 'AM'
  const hour12  = hour24 !== null ? (hour24 % 12 || 12) : null

  const [pickAmpm, setPickAmpm] = useState<'AM' | 'PM'>(ampm as 'AM' | 'PM')
  const [pickHour, setPickHour] = useState<number | null>(hour12)
  const [pickMin,  setPickMin]  = useState<number | null>(minute)

  useEffect(() => {
    if (hour24 !== null) {
      setPickAmpm(hour24 >= 12 ? 'PM' : 'AM')
      setPickHour(hour24 % 12 || 12)
      setPickMin(minute)
    }
  }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function commit(h: number | null, m: number | null, ap: 'AM' | 'PM') {
    if (h === null || m === null) return
    let h24 = h % 12
    if (ap === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  function selectHour(h: number) {
    setPickHour(h)
    if (pickMin !== null) { commit(h, pickMin, pickAmpm); setOpen(false) }
  }
  function selectMin(m: number) {
    setPickMin(m)
    if (pickHour !== null) { commit(pickHour, m, pickAmpm); setOpen(false) }
  }
  function toggleAmpm(ap: 'AM' | 'PM') {
    setPickAmpm(ap)
    if (pickHour !== null && pickMin !== null) commit(pickHour, pickMin, ap)
  }

  const label = value
    ? (() => {
        const h = hour24!; const m = minute!
        const ap = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        return `${h12}:${String(m).padStart(2, '0')} ${ap}`
      })()
    : null

  const HOURS   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const MINUTES = [0, 15, 30, 45]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 border rounded-xl px-3 py-2.5 text-sm text-left transition-all ${
          open ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300'
        } ${label ? 'text-slate-800' : 'text-slate-400'} bg-white`}
      >
        <Clock size={14} className={label ? 'text-brand-500' : 'text-slate-300'} />
        <span className="flex-1 font-medium">{label ?? placeholder}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-64">
          {/* AM / PM */}
          <div className="flex gap-1.5 mb-4">
            {(['AM', 'PM'] as const).map(ap => (
              <button key={ap} type="button" onClick={() => toggleAmpm(ap)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  pickAmpm === ap ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>{ap}</button>
            ))}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Hour</p>
          <div className="grid grid-cols-4 gap-1 mb-4">
            {HOURS.map(h => (
              <button key={h} type="button" onClick={() => selectHour(h)}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                  pickHour === h ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                }`}>{h}</button>
            ))}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Minute</p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map(m => (
              <button key={m} type="button" onClick={() => selectMin(m)}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                  pickMin === m ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                }`}>:{String(m).padStart(2, '0')}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Simple Date Picker (no availability) ─────────────────────────────────────
interface SimpleDatePickerProps {
  value: string
  onChange: (iso: string) => void
  label?: string
}

function SimpleDatePicker({ value, onChange, label = 'DATE NEEDED' }: SimpleDatePickerProps) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const todayIso    = today.toISOString().split('T')[0]
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const isPrevDisabled =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-brand-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</p>
        </div>
        {value && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-600">
            {new Date(value + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevMonth} disabled={isPrevDisabled}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-bold text-slate-700 min-w-[118px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <p key={d} className="text-center text-[10px] font-bold text-slate-400 py-0.5">{d}</p>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day    = i + 1
          const iso    = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast = iso < todayIso
          const isSel  = iso === value
          const isToday = iso === todayIso

          let cls = ''
          if      (isSel)  cls = 'bg-brand-600 text-white shadow-sm'
          else if (isPast) cls = 'bg-slate-50 text-slate-300 cursor-not-allowed'
          else             cls = 'bg-white text-slate-700 hover:bg-brand-50 hover:text-brand-700 cursor-pointer border border-slate-100'

          const todayRing = isToday && !isSel ? 'ring-2 ring-brand-400 ring-offset-1' : ''

          return (
            <button key={iso} type="button" disabled={isPast}
              onClick={() => !isPast && onChange(iso)}
              className={`w-full h-8 rounded-lg text-xs font-semibold transition-all ${cls} ${todayRing}`}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-white border border-slate-200"/><span className="text-[10px] text-slate-500">Available</span></div>
        <div className="flex items-center gap-1.5 ml-auto"><div className="w-3 h-3 rounded-sm bg-brand-600"/><span className="text-[10px] text-slate-500">Selected</span></div>
      </div>
    </div>
  )
}

// ── Booking detail type for the calendar ─────────────────────────────────────
interface CalBooking {
  neededDate:   string
  endDate:      string
  startTime:    string
  endTime:      string
  activityType: string
  shootType?:   string
  projectName?: string
}

function fmtTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
}

// ── Availability Calendar ────────────────────────────────────────────────────
interface AvailabilityCalendarProps {
  activityType:   string
  shootType?:     string
  selectedStart:  string
  selectedEnd:    string
  selectionStage: 'start' | 'end'
  onSelectDate:   (iso: string) => void
}

function AvailabilityCalendar({
  activityType, shootType,
  selectedStart, selectedEnd, selectionStage, onSelectDate,
}: AvailabilityCalendarProps) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [bookings,  setBookings]  = useState<CalBooking[]>([])
  const [loading,   setLoading]   = useState(false)
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)

  useEffect(() => {
    if (!activityType) return
    let cancelled = false
    setLoading(true)
    // Fetch all bookings (not just same activity) for crew-level blocking
    supabase
      .from('booking_requests')
      .select('needed_date, end_date, start_time, end_time, activity_type, shoot_type, project_name')
      .not('status', 'in', '("Rejected","Cancelled")')
      .then(({ data }) => {
        if (!cancelled && data) {
          setBookings(data.map(r => ({
            neededDate:   r.needed_date as string,
            endDate:      (r.end_date || r.needed_date) as string,
            startTime:    (r.start_time as string) || '',
            endTime:      (r.end_time  as string) || '',
            activityType: (r.activity_type as string) || '',
            shootType:    (r.shoot_type as string) || undefined,
            projectName:  (r.project_name as string) || undefined,
          })))
        }
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activityType])

  function bookingsOnDay(iso: string): CalBooking[] {
    return bookings.filter(b => b.neededDate <= iso && b.endDate >= iso)
  }

  function hasFullCrewOnDay(iso: string): boolean {
    return bookings.some(b =>
      b.neededDate <= iso && b.endDate >= iso &&
      (b.activityType === 'Photo Shoot' || b.activityType === 'Video Shoot') &&
      b.shootType === 'Major'
    )
  }

  const sameActivityCount = (iso: string) =>
    bookings.filter(b => b.neededDate <= iso && b.endDate >= iso && b.activityType === activityType).length

  const todayIso    = today.toISOString().split('T')[0]
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const isPrevDisabled =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-brand-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Availability</p>
          {loading && (
            <svg className="w-3 h-3 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          selectionStage === 'start' ? 'bg-brand-100 text-brand-600' : 'bg-emerald-100 text-emerald-600'
        }`}>
          {selectionStage === 'start' ? '① Pick start date' : '② Pick end date'}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevMonth} disabled={isPrevDisabled}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-bold text-slate-700 min-w-[118px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <p key={d} className="text-center text-[10px] font-bold text-slate-400 py-0.5">{d}</p>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day  = i + 1
          const iso  = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayBookings   = bookingsOnDay(iso)
          const sameCount     = sameActivityCount(iso)
          const fullCrewDay   = hasFullCrewOnDay(iso)
          const isPast        = iso < todayIso
          const isToday       = iso === todayIso
          const isSelStart    = iso === selectedStart
          const isSelEnd      = iso === selectedEnd
          const isInRange     = selectedStart && selectedEnd && iso > selectedStart && iso < selectedEnd

          // Blocking logic
          const isBlockedMajor = fullCrewDay && (activityType === 'Photo Shoot' || activityType === 'Video Shoot') && shootType === 'Major'
          const isFull         = sameCount >= MAX_CONCURRENT || isBlockedMajor

          const disabled = selectionStage === 'end'
            ? (selectedStart ? iso < selectedStart : isPast) || isFull
            : isPast || isFull

          let cls = ''
          if      (isSelStart || isSelEnd) cls = 'bg-brand-600 text-white shadow-sm'
          else if (isInRange)              cls = 'bg-brand-100 text-brand-700'
          else if (isPast)                 cls = 'bg-slate-50 text-slate-300 cursor-not-allowed'
          else if (isFull)                 cls = 'bg-red-50 text-red-300 cursor-not-allowed line-through'
          else if (fullCrewDay)            cls = 'bg-orange-50 text-orange-600 hover:bg-orange-100 cursor-pointer border border-orange-100'
          else if (sameCount >= MAX_CONCURRENT - 1) cls = 'bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer'
          else if (sameCount > 0)          cls = 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 cursor-pointer'
          else                             cls = 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer border border-slate-100'

          const todayRing = isToday && !isSelStart && !isSelEnd ? 'ring-2 ring-brand-400 ring-offset-1' : ''

          // Hover tooltip content
          const showTooltip = hoveredDay === iso && dayBookings.length > 0

          return (
            <div key={iso} className="relative">
              <button type="button" disabled={disabled}
                onClick={() => !disabled && onSelectDate(iso)}
                onMouseEnter={() => setHoveredDay(iso)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-full h-8 rounded-lg text-xs font-semibold transition-all ${cls} ${todayRing}`}>
                {day}
              </button>

              {/* Hover tooltip */}
              {showTooltip && (
                <div className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-52 bg-slate-900 text-white rounded-xl shadow-2xl p-3 pointer-events-none">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                    {new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    {' · '}{dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {dayBookings.slice(0, 3).map((b, idx) => {
                      const crew = b.activityType === 'Photo Shoot' || b.activityType === 'Video Shoot'
                        ? (b.shootType === 'Major' ? 'Full Crew' : 'Partial Crew')
                        : 'Minimal Crew'
                      const crewColor = crew === 'Full Crew' ? 'text-red-300' : crew === 'Partial Crew' ? 'text-amber-300' : 'text-emerald-300'
                      return (
                        <div key={idx} className="text-[10px]">
                          <p className="font-semibold text-white truncate">{b.activityType}{b.shootType ? ` — ${b.shootType}` : ''}</p>
                          <p className={`font-bold ${crewColor}`}>{crew}</p>
                          {(b.startTime || b.endTime) && (
                            <p className="text-slate-400">{fmtTime(b.startTime)}{b.endTime ? ` – ${fmtTime(b.endTime)}` : ''}</p>
                          )}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-[10px] text-slate-400">+{dayBookings.length - 3} more</p>
                    )}
                    {isFull && <p className="text-[10px] font-bold text-red-300 mt-1">⛔ No capacity remaining</p>}
                  </div>
                  {/* Remaining capacity */}
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-[10px] text-slate-400">
                      Available slots: <span className="text-white font-bold">{Math.max(0, MAX_CONCURRENT - sameCount)}</span>
                      {fullCrewDay && !isFull && <span className="text-orange-300 ml-1">(Full crew occupied)</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-white border border-slate-200"/><span className="text-[10px] text-slate-500">Available</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-50 border border-orange-200"/><span className="text-[10px] text-slate-500">Full Crew</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-200"/><span className="text-[10px] text-slate-500">Partial</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200"/><span className="text-[10px] text-slate-500">Fully Booked</span></div>
        <div className="flex items-center gap-1.5 ml-auto"><div className="w-3 h-3 rounded-sm bg-brand-600"/><span className="text-[10px] text-slate-500">Selected</span></div>
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div className="flex items-center gap-3 px-6 sm:px-10 py-4 border-b border-white/10">
      <img src="/favicon.svg" alt="DAP Flow" className="w-9 h-9 shrink-0 rounded-xl shadow-md" />
      <div>
        <p className="text-white font-bold text-sm leading-none">DAP Flow</p>
        <p className="text-brand-200 text-[10px] uppercase tracking-widest mt-0.5">Studio Booking Portal</p>
      </div>
    </div>
  )
}

// ── Approver search helpers ───────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toLowerCase()
}

function matchApprover(a: Approver, query: string): boolean {
  if (!query) return true
  const q    = query.toLowerCase().trim()
  const name = a.name.toLowerCase()
  if (name.includes(q)) return true
  if (a.email.toLowerCase().includes(q)) return true
  if (a.position.toLowerCase().includes(q)) return true
  const initials    = getInitials(a.name)
  if (initials.includes(q)) return true
  const queryWords  = q.split(/\s+/).filter(Boolean)
  if (queryWords.length > 1 && queryWords.every(qw => name.includes(qw))) return true
  return false
}

// ── Approver Dropdown ─────────────────────────────────────────────────────────
interface ApproverDropdownProps {
  approvers:      Approver[]
  selectedId:     string
  selectedName:   string
  approverEmail:  string
  onSelect:       (id: string, name: string, email: string, position: string) => void
  onClear:        () => void
  onEmailChange:  (email: string) => void
}

function ApproverDropdown({ approvers, selectedId, selectedName, approverEmail, onSelect, onClear, onEmailChange }: ApproverDropdownProps) {
  const [search, setSearch] = useState('')
  const [open,   setOpen]   = useState(false)
  const ref      = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const active   = approvers.filter(a => a.isActive !== false && (a.approverType ?? 'booking') === 'booking')
  const filtered = active.filter(a => matchApprover(a, search))

  function highlight(text: string, q: string) {
    if (!q) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return <>{text}</>
    return <>{text.slice(0, idx)}<mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5 not-italic font-semibold">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
  }

  if (selectedId) {
    const sel = approvers.find(a => a.id === selectedId)
    return (
      <div className="bg-brand-50 border border-brand-200 rounded-xl overflow-hidden">
        {/* Approver identity row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 text-white font-black text-xs">
            {selectedName.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{selectedName}</p>
            <p className="text-[11px] text-slate-500 truncate">{sel?.position || ''}</p>
          </div>
          <button type="button" onClick={onClear}
            className="shrink-0 text-[10px] font-semibold text-slate-400 hover:text-red-500 underline transition-colors">
            Change
          </button>
        </div>
        {/* Inline email input */}
        <div className="px-4 pb-3 border-t border-brand-100 pt-3">
          <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1.5">
            Approver Email <span className="text-red-500">*</span>
            <span className="ml-1 text-[10px] font-normal normal-case text-brand-500">— for sending the approval request</span>
          </label>
          <input
            type="email"
            className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
            placeholder="approver@company.com"
            value={approverEmail}
            onChange={e => onEmailChange(e.target.value)}
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div
        className={`w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-all ${
          open ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-300 cursor-pointer'
        }`}
        onClick={() => setOpen(true)}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        <input ref={inputRef} type="text" value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, initials, or designation…"
          className="flex-1 text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400" />
        {search && (
          <button type="button" onClick={e => { e.stopPropagation(); setSearch('') }}
            className="text-slate-400 hover:text-slate-600">
            <ChevronDown size={12} className="rotate-180" />
          </button>
        )}
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {filtered.length === active.length ? `${active.length} approvers` : `${filtered.length} of ${active.length} approvers`}
              {search && ` matching "${search}"`}
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400 font-medium">No match for "{search}"</p>
                <p className="text-[11px] text-slate-300 mt-1">Try searching by surname, initials, or designation</p>
              </div>
            ) : filtered.map(a => {
              const initials = a.name.replace(/[,]/g, ' ').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')
              return (
                <button key={a.id} type="button"
                  onClick={() => { onSelect(a.id, a.name, a.email, a.position); setSearch(''); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-500">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{highlight(a.name, search)}</p>
                      {a.position && (
                        <span className="text-[9px] font-bold bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap max-w-[120px] truncate">
                          {a.position}
                        </span>
                      )}
                    </div>
                    {a.email && <p className="text-[11px] text-slate-400 truncate">{highlight(a.email, search)}</p>}
                  </div>
                </button>
              )
            })}
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/80">
              <p className="text-[10px] text-slate-400">Tip: search by initials (e.g. "JRP"), surname, or designation</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Graphics: project category → printing process mapping ────────────────────
const GRAPHICS_PROJECT_TO_PROCESS: Record<string, string> = {
  'Banners': 'Large Format Printing', 'Flag Type': 'Large Format Printing',
  'Billboards': 'Large Format Printing', 'Vehicle wraps': 'Large Format Printing',
  'Wall murals': 'Large Format Printing', 'Window graphics': 'Large Format Printing',
  'Boundary Signages': 'Large Format Printing', 'Lighted Signage': 'Large Format Printing',
  'Wallsigns': 'Large Format Printing', 'Signages': 'Large Format Printing',
  'Backdrops': 'Large Format Printing', 'Roll-up banners': 'Large Format Printing',
  'Floor graphics': 'Large Format Printing', 'Event displays': 'Large Format Printing',
  'Trade show booths': 'Large Format Printing',
  'Brochures': 'Offset Lithography', 'Flyers': 'Offset Lithography',
  'Leaflets': 'Offset Lithography', 'Catalogs': 'Offset Lithography',
  'Magazines': 'Offset Lithography', 'Books': 'Offset Lithography',
  'Calendars': 'Offset Lithography', 'Packaging boxes': 'Offset Lithography',
  'Paper bags': 'Offset Lithography', 'Corporate stationery': 'Offset Lithography',
  'Envelopes': 'Offset Lithography', 'Notebooks': 'Offset Lithography',
  'Bundling Sticker': 'Offset Lithography', 'Wobbler': 'Offset Lithography',
  'Shelftalker': 'Offset Lithography', 'Product Sticker': 'Offset Lithography',
  'PR Box': 'Offset Lithography', 'Price Tag': 'Offset Lithography',
  'Neck tag': 'Offset Lithography',
  'Customized T-shirts and sportswear': 'Sublimation Printing',
  'Coffee mugs and drinkware': 'Sublimation Printing',
  'Lanyards': 'Sublimation Printing', 'Cap and Arm Sleeves': 'Sublimation Printing',
  'Umbrella': 'Sublimation Printing', 'Folded Round Fan': 'Sublimation Printing',
  'Eco Bag': 'Sublimation Printing', 'Loot Bag': 'Sublimation Printing',
}

// ── Design Specs Form ─────────────────────────────────────────────────────────
interface DesignSpecsFormProps {
  values: {
    dsw_paperSize: string; dsw_orientation: string; dsw_colorMode: string
    dsw_dimensions: string; dsw_material: string; dsw_additionalNotes: string
    dsw_platform: string; dsw_shootTypeDetail: string
  }
  onChange: (key: string, val: string) => void
  activityType: ActivityType | ''
  attachments: File[]
  onAttachmentsChange: (files: File[]) => void
  fileLinks: string[]
  onFileLinksChange: (links: string[]) => void
}

function DesignSpecsForm({ values, onChange, activityType, attachments, onAttachmentsChange, fileLinks, onFileLinksChange }: DesignSpecsFormProps) {
  const { formOptions } = useAppStore()

  // Helper: active labels for a (service, fieldKey) pair with static fallback
  const fieldOpts = (service: string, fieldKey: string, fallback: string[] = []): string[] => {
    const dynamic = formOptions
      .filter(o => o.service === service && o.fieldKey === fieldKey && o.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(o => o.optionLabel)
    return dynamic.length > 0 ? dynamic : fallback
  }

  // Build project→process map: hardcoded base + any custom entries added via Settings
  const graphicsProjectToProcess: Record<string, string> = { ...GRAPHICS_PROJECT_TO_PROCESS }
  formOptions
    .filter(o => o.service === 'Graphics' && o.fieldKey === 'dsw_projectProcess' && o.isActive)
    .forEach(o => { graphicsProjectToProcess[o.optionValue] = o.optionLabel })

  const isStatic   = activityType === 'Static Artwork Design'
  const isDigital  = activityType === 'Digital Design'
  const isGraphics = activityType === 'Graphics'
  const isPrinting = activityType === 'Printing'
  const isASC          = activityType === 'ASC'
  const isVideoEditing = activityType === 'Video Editing'

  const [activeTab,  setActiveTab]  = useState<'specs' | 'upload'>('specs')
  const [linkDraft,  setLinkDraft]  = useState('')

  const titleMap: Record<string, string> = {
    'Static Artwork Design': 'Static Artwork Specifications',
    'Digital Design': 'Digital Design Specifications',
    'Graphics': 'Graphics Specifications',
    'Printing': 'Printing Specifications',
    'ASC': 'ASC Submission Details',
    'Video Editing': 'Video Editing Specifications',
    'Audio Services': 'Audio Services — Script Upload',
  }
  const emojiMap: Record<string, string> = {
    'Static Artwork Design': '🎨', 'Digital Design': '💻',
    'Graphics': '🖼️', 'Printing': '🖨️', 'ASC': '📋', 'Video Editing': '🎬', 'Audio Services': '🎙️',
  }
  const title = titleMap[activityType] ?? 'Specifications'
  const emoji = emojiMap[activityType] ?? '📄'
  const totalAttachments = attachments.length + fileLinks.length

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files || [])
    onAttachmentsChange([...attachments, ...incoming].slice(0, 3))
    e.target.value = ''
  }
  function removeFile(i: number) { onAttachmentsChange(attachments.filter((_, idx) => idx !== i)) }
  function addLink() {
    const url = linkDraft.trim()
    if (!url) return
    onFileLinksChange([...fileLinks, url])
    setLinkDraft('')
  }
  function removeLink(i: number) { onFileLinksChange(fileLinks.filter((_, idx) => idx !== i)) }
  function fmtSize(b: number) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
    return `${(b / 1024 ** 3).toFixed(2)} GB`
  }

  const inputCls = 'w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400'
  const selectCls = inputCls

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-2xl overflow-hidden">
      {/* Header + Tabs */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-md bg-brand-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px]">{emoji}</span>
          </div>
          <p className="text-xs font-black text-brand-800 uppercase tracking-wide">{title}</p>
        </div>
        <div className="flex border-b border-brand-200 -mx-5 px-5">
          <button type="button" onClick={() => setActiveTab('specs')}
            className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${activeTab === 'specs' ? 'text-brand-700 border-brand-600' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
            Specifications
          </button>
          <button type="button" onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${activeTab === 'upload' ? 'text-brand-700 border-brand-600' : 'text-brand-400 border-transparent hover:text-brand-600'}`}>
            Attachments
            {totalAttachments > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-black flex items-center justify-center">{totalAttachments}</span>
            )}
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* ── Specifications Tab ── */}
        {activeTab === 'specs' && (
          <div className="space-y-4">

            {/* Static Artwork Design */}
            {isStatic && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Size <span className="text-red-500">*</span></label>
                  <select value={values.dsw_paperSize} onChange={e => onChange('dsw_paperSize', e.target.value)} className={selectCls}>
                    <option value="">Select size…</option>
                    {fieldOpts('Static Artwork Design', 'dsw_paperSize', PAPER_SIZES_FB).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Orientation <span className="text-red-500">*</span></label>
                  <select value={values.dsw_orientation} onChange={e => onChange('dsw_orientation', e.target.value)} className={selectCls}>
                    <option value="">Select…</option>
                    {fieldOpts('Static Artwork Design', 'dsw_orientation', ORIENTATIONS_FB).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Material Type <span className="text-red-500">*</span></label>
                  <select value={values.dsw_material} onChange={e => onChange('dsw_material', e.target.value)} className={selectCls}>
                    <option value="">Select material…</option>
                    {fieldOpts('Static Artwork Design', 'dsw_material', MATERIAL_TYPES_FB).map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Additional Specifications / Notes <span className="text-red-500">*</span></label>
                  <textarea rows={3} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Brand guidelines, special instructions, number of copies, reference files…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* Digital Design */}
            {isDigital && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Platform / Usage <span className="text-red-500">*</span></label>
                  <input type="text" value={values.dsw_paperSize} onChange={e => onChange('dsw_paperSize', e.target.value)} placeholder="e.g. Facebook, Instagram, Website" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Asset Type <span className="text-red-500">*</span></label>
                  <select value={values.dsw_orientation} onChange={e => onChange('dsw_orientation', e.target.value)} className={selectCls}>
                    <option value="">Select type…</option>
                    {fieldOpts('Digital Design', 'dsw_orientation', ['Social Media Graphic', 'Motion Graphic / GIF', 'Digital Banner', 'Website Creative', 'Email Header', 'Other']).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Output Dimensions <span className="text-red-500">*</span></label>
                  <input type="text" value={values.dsw_dimensions} onChange={e => onChange('dsw_dimensions', e.target.value)} placeholder="e.g. 1080×1080 px" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Additional Notes <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Brand guidelines, reference links, special instructions…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* Graphics */}
            {isGraphics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Row 1: Project Category (left) | Dimensions (right) */}
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Project Category <span className="text-red-500">*</span></label>
                  <select
                    value={values.dsw_paperSize}
                    onChange={e => {
                      const project = e.target.value
                      const process = graphicsProjectToProcess[project] || ''
                      onChange('dsw_paperSize', project)
                      onChange('dsw_colorMode', process)
                      onChange('dsw_material', '')
                    }}
                    className={selectCls}>
                    <option value="">Select project category…</option>
                    {fieldOpts('Graphics', 'dsw_paperSize', Object.keys(graphicsProjectToProcess)).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Output Dimensions <span className="text-red-500">*</span></label>
                  <input type="text" value={values.dsw_dimensions} onChange={e => onChange('dsw_dimensions', e.target.value)} placeholder="e.g. 20×30 in, A2, 1920×1080 px" className={inputCls} />
                </div>
                {/* Row 2: Printing Process (auto, left) | Material Type (right) */}
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Printing Process <span className="text-red-500">*</span></label>
                  <div className={`${selectCls} flex items-center gap-2 ${values.dsw_colorMode ? 'bg-brand-50' : 'bg-white'}`} style={{ cursor: 'default' }}>
                    {values.dsw_colorMode
                      ? <><span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" /><span className="text-brand-700 font-semibold">{values.dsw_colorMode}</span><span className="ml-auto text-[10px] text-brand-400">auto-selected</span></>
                      : <span className="text-slate-400">Select a project category first…</span>
                    }
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Material Type <span className="text-red-500">*</span></label>
                  <select
                    value={values.dsw_material}
                    onChange={e => onChange('dsw_material', e.target.value)}
                    disabled={!values.dsw_colorMode}
                    className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <option value="">{values.dsw_colorMode ? 'Select material…' : 'Select a project category first…'}</option>
                    {values.dsw_colorMode && fieldOpts(`Graphics-${values.dsw_colorMode}`, 'dsw_material', GRAPHICS_MATERIALS_FB[values.dsw_colorMode] ?? []).map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Additional Notes <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Brand guidelines, special instructions, reference files…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* Printing */}
            {isPrinting && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Paper Size <span className="text-red-500">*</span></label>
                  <select value={values.dsw_paperSize} onChange={e => onChange('dsw_paperSize', e.target.value)} className={selectCls}>
                    <option value="">Select size…</option>
                    {fieldOpts('Printing', 'dsw_paperSize', PAPER_SIZES_FB).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Color <span className="text-red-500">*</span></label>
                  <select value={values.dsw_colorMode} onChange={e => onChange('dsw_colorMode', e.target.value)} className={selectCls}>
                    <option value="">Select…</option>
                    {fieldOpts('Printing', 'dsw_colorMode', ['Colored', 'B&W']).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Orientation <span className="text-red-500">*</span></label>
                  <select value={values.dsw_orientation} onChange={e => onChange('dsw_orientation', e.target.value)} className={selectCls}>
                    <option value="">Select…</option>
                    {fieldOpts('Printing', 'dsw_orientation', ORIENTATIONS_FB).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Material Type <span className="text-red-500">*</span></label>
                  <select value={values.dsw_material} onChange={e => onChange('dsw_material', e.target.value)} className={selectCls}>
                    <option value="">Select material…</option>
                    {fieldOpts('Printing', 'dsw_material', MATERIAL_TYPES_FB).map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Additional Notes <span className="text-red-500">*</span></label>
                  <textarea rows={2} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Quantity, finishing (lamination, binding), delivery instructions…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* ASC */}
            {isASC && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Ad Type <span className="text-red-500">*</span></label>
                  <select value={values.dsw_paperSize} onChange={e => onChange('dsw_paperSize', e.target.value)} className={selectCls}>
                    <option value="">Select advertisement type…</option>
                    {fieldOpts('ASC', 'dsw_paperSize', ['TVC (TV Commercial)', 'Radio Ad', 'Print Ad', 'Out-of-Home (OOH)', 'Online Ad / Digital', 'Social Media Content', 'Other']).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Project Brief / Notes <span className="text-red-500">*</span></label>
                  <textarea rows={4} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Describe the advertisement, target audience, message, compliance requirements, and any other relevant details for ASC submission…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* Audio Services */}
            {activityType === 'Audio Services' && (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-2.5 bg-brand-100/60 border border-brand-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-brand-700">Upload your script or voice-over brief in the <strong>Attachments</strong> tab. You may also paste a link to a shared document.</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Script / Production Brief <span className="text-red-500">*</span></label>
                  <textarea rows={4} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Describe the content: tone, target audience, key messages, reading style, estimated duration, and any special instructions for the voice talent or audio team…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}

            {/* Video Editing */}
            {isVideoEditing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Platform <span className="text-red-500">*</span></label>
                  <select value={values.dsw_platform} onChange={e => onChange('dsw_platform', e.target.value)} className={selectCls}>
                    <option value="">Select platform…</option>
                    {fieldOpts('Video Editing', 'dsw_platform', ['Broadcast', 'TVCX', 'Social Media']).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Resolution <span className="text-red-500">*</span></label>
                  <select value={values.dsw_dimensions} onChange={e => onChange('dsw_dimensions', e.target.value)} className={selectCls}>
                    <option value="">Select resolution…</option>
                    {fieldOpts('Video Editing', 'dsw_dimensions', ['720p (HD)', '1080p (Full HD)', '1440p (2K)', '2160p (4K)', 'Custom']).map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Orientation <span className="text-red-500">*</span></label>
                  <select value={values.dsw_orientation} onChange={e => onChange('dsw_orientation', e.target.value)} className={selectCls}>
                    <option value="">Select orientation…</option>
                    {fieldOpts('Video Editing', 'dsw_orientation', ['Landscape (16:9)', 'Portrait (9:16)', 'Square (1:1)']).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Output Format <span className="text-red-500">*</span></label>
                  <select value={values.dsw_paperSize} onChange={e => onChange('dsw_paperSize', e.target.value)} className={selectCls}>
                    <option value="">Select format…</option>
                    {fieldOpts('Video Editing', 'dsw_paperSize', ['MP4', 'MOV', 'AVI', 'MKV', 'WebM']).map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Duration <span className="text-red-500">*</span></label>
                  <input type="text" value={values.dsw_colorMode} onChange={e => onChange('dsw_colorMode', e.target.value)}
                    placeholder="e.g. 2 mins, 30 sec, 1:30"
                    className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Style / Tone</label>
                  <select value={values.dsw_material} onChange={e => onChange('dsw_material', e.target.value)} className={selectCls}>
                    <option value="">Select style…</option>
                    {fieldOpts('Video Editing', 'dsw_material', ['Promotional', 'Documentary', 'Cinematic', 'Social Media Reel', 'Tutorial / How-To', 'Event Coverage', 'Music Video', 'Other']).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide block mb-1">Additional Notes <span className="text-red-500">*</span></label>
                  <textarea rows={3} value={values.dsw_additionalNotes} onChange={e => onChange('dsw_additionalNotes', e.target.value)}
                    placeholder="Raw footage location, editing style references, music/audio preferences, deadline, and any special instructions…"
                    className="w-full border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Attachments Tab ── */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <p className="text-[11px] text-brand-600">
              Attach files or paste links to shared drives / videos. Max 3 files (up to 2 GB each).
            </p>

            {/* File upload */}
            {attachments.length < 3 && (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-brand-300 rounded-xl py-6 px-4 cursor-pointer hover:border-brand-500 hover:bg-brand-100/50 transition-all">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-brand-700">Click to upload files</p>
                  <p className="text-[11px] text-brand-400 mt-0.5">{3 - attachments.length} slot{3 - attachments.length !== 1 ? 's' : ''} remaining · any file type</p>
                </div>
                <input type="file" multiple className="sr-only" onChange={handleFileChange} />
              </label>
            )}
            {attachments.length === 3 && (
              <p className="text-[11px] text-amber-600 font-semibold text-center">Maximum of 3 files reached.</p>
            )}

            {/* File list */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white border border-brand-100 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 text-[9px] font-black text-brand-600 uppercase">
                      {file.name.split('.').pop()?.slice(0, 4) || 'FILE'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-400">{fmtSize(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-slate-300 hover:text-red-400 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Divider + Link section */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-brand-200" />
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wide">Or paste a link</span>
              <div className="flex-1 h-px bg-brand-200" />
            </div>
            <p className="text-[11px] text-brand-500">File too large? Share via Google Drive, Dropbox, YouTube, or any link.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkDraft}
                onChange={e => setLinkDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                placeholder="https://drive.google.com/…"
                className="flex-1 border border-brand-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
              />
              <button type="button" onClick={addLink}
                disabled={!linkDraft.trim()}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shrink-0">
                Add
              </button>
            </div>

            {/* Link list */}
            {fileLinks.length > 0 && (
              <div className="space-y-2">
                {fileLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-brand-100 rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-brand-700 truncate hover:underline">{link}</a>
                    <button type="button" onClick={() => removeLink(i)} className="text-slate-300 hover:text-red-400 transition-colors p-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tracking ──────────────────────────────────────────────────────────────────
interface TrackedRequest {
  status: string
  activity_type: string
  prepared_by: string
  created_at: string
  jo_id?: string | null
  jo_number?: string | null
  jo_status?: string | null
}

// ── Main Component ────────────────────────────────────────────────────────────
export function BookingRequestForm() {
  const [page,     setPage]     = useState<1 | 2 | 3>(1)
  const [form,     setForm]     = useState<FormState>(EMPTY)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [submitted,    setSubmitted]    = useState<{
    id: string; refId: string; email: string; activity: string; approverName: string
  } | null>(null)
  const [liveStatus, setLiveStatus] = useState<string>('Pending Approval')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Shoot type sub-selection on page 1
  const [pendingActivity, setPendingActivity] = useState<ActivityType | ''>('')

  const [trackRef,     setTrackRef]     = useState('')
  const [trackResult,  setTrackResult]  = useState<TrackedRequest | null>(null)
  const [trackError,   setTrackError]   = useState('')
  const [trackLoading, setTrackLoading] = useState(false)

  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [attachedLinks, setAttachedLinks] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPTS])
  const { approvers, initApprovers, initFormOptions, formOptions } = useAppStore()

  // Helper: get active option labels for a service + field combo, with static fallback
  const opts = (service: string, fieldKey: string, fallback: string[] = []): string[] => {
    const dynamic = formOptions
      .filter(o => o.service === service && o.fieldKey === fieldKey && o.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(o => o.optionLabel)
    return dynamic.length > 0 ? dynamic : fallback
  }

  const serviceTypes = formOptions
    .filter(o => o.service === '__services__' && o.fieldKey === 'activityType' && o.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(o => o.optionValue as ActivityType)

  const displayActivityTypes: ActivityType[] = serviceTypes.length > 0 ? serviceTypes : ACTIVITY_TYPES

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await supabase.from('booking_departments').select('name').order('created_at', { ascending: true })
        if (data && data.length > 0) {
          setDepartments([...(data as { name: string }[]).map(d => d.name), 'Other'])
        } else {
          setDepartments([...DEFAULT_DEPTS, 'Other'])
        }
      } catch { setDepartments([...DEFAULT_DEPTS, 'Other']) }

      // Sync approvers from Supabase into the shared store so emails are always current
      await initApprovers()
      // Load booking-form options (categories, materials, etc.) from Supabase.
      // The public /request route skips App.tsx's init effect, so without this
      // the form falls back to hardcoded defaults and misses options added in Settings.
      await initFormOptions()
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!submitted) return
    const poll = async () => {
      try {
        const { data } = await supabase.from('booking_requests').select('status').eq('id', submitted.id).single()
        if (data?.status) {
          setLiveStatus(data.status as string)
          if (['Assigned','Approved','Rejected','Completed','Cancelled'].includes(data.status as string)) {
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 6000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [submitted])

  const todayIso           = new Date().toISOString().split('T')[0]
  const effectiveDepartment = form.department === 'Other' ? form.departmentOther.trim() : form.department
  const isStaticArtwork    = form.activityType === 'Static Artwork Design'
  const isDateOnlyService  = DATE_ONLY_ACTIVITIES.includes(form.activityType as ActivityType)
  const isNoVenueService   = DESIGN_ACTIVITIES.includes(form.activityType as ActivityType)
  const isShootService     = SHOOT_ACTIVITIES.includes(form.activityType as ActivityType)

  const isPage2Valid = isDateOnlyService
    ? form.neededDate !== ''
    : (form.neededDate !== '' && form.endDate !== '' && form.startTime !== '' && form.endTime !== '')

  const isDesignActivity = DESIGN_ACTIVITIES.includes(form.activityType as ActivityType)

  function designSpecsValid(): boolean {
    const f = form
    switch (f.activityType) {
      case 'Static Artwork Design':
        return f.dsw_paperSize !== '' && f.dsw_orientation !== '' && f.dsw_material !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'Digital Design':
        return f.dsw_paperSize.trim() !== '' && f.dsw_orientation !== '' && f.dsw_dimensions.trim() !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'Graphics':
        return f.dsw_paperSize !== '' && f.dsw_colorMode !== '' && f.dsw_dimensions.trim() !== '' && f.dsw_material !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'Printing':
        return f.dsw_paperSize !== '' && f.dsw_colorMode !== '' && f.dsw_orientation !== '' && f.dsw_material !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'ASC':
        return f.dsw_paperSize !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'Video Editing':
        return f.dsw_platform !== '' && f.dsw_dimensions !== '' && f.dsw_orientation !== '' && f.dsw_paperSize !== '' && f.dsw_colorMode.trim() !== '' && f.dsw_additionalNotes.trim() !== ''
      case 'Audio Services':
        return f.dsw_additionalNotes.trim() !== ''
      default:
        return true
    }
  }

  const isPage3Valid =
    form.department    !== '' &&
    (form.department !== 'Other' || form.departmentOther.trim() !== '') &&
    form.departmentLocal.trim()   !== '' &&
    form.requestorName.trim()      !== '' &&
    form.requestorEmail.trim()     !== '' &&
    form.preparedBy.trim()         !== '' &&
    form.selectedApproverId       !== '' &&
    form.approverName.trim()      !== '' &&
    form.approverEmail.trim()     !== '' &&
    form.projectName.trim()       !== '' &&
    (isShootService ? form.venue.trim() !== '' : true) &&
    (form.activityType === 'Video Shoot' ? form.dsw_shootTypeDetail !== '' : true) &&
    (!isDesignActivity ? form.notes.trim() !== '' : true) &&
    (!isDesignActivity || designSpecsValid())

  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setForm(prev => ({
        ...prev,
        [key]: value,
        ...(key === 'department' && value !== 'Other' ? { departmentOther: '' } : {}),
      }))
    }
  }

  function setSpecField(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const [selectionStage, setSelectionStage] = useState<'start' | 'end'>('start')

  const handleCalendarSelect = useCallback((iso: string) => {
    if (selectionStage === 'start') {
      setForm(prev => ({ ...prev, neededDate: iso, endDate: '' }))
      setSelectionStage('end')
    } else {
      setForm(prev => {
        const start = prev.neededDate
        const [newStart, newEnd] = iso < start ? [iso, start] : [start, iso]
        return { ...prev, neededDate: newStart, endDate: newEnd }
      })
      setSelectionStage('start')
    }
  }, [selectionStage])

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    const ref = trackRef.trim().toUpperCase()
    if (ref.length < 6) { setTrackError('Please enter at least 6 characters of your reference number.'); return }
    setTrackLoading(true); setTrackError(''); setTrackResult(null)
    try {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('status, activity_type, prepared_by, created_at, jo_id')
        .ilike('id', `${ref}%`).limit(1).single()
      if (error || !data) { setTrackError('No request found with that reference number.'); return }
      const result = data as TrackedRequest
      if (result.jo_id) {
        const { data: joData } = await supabase
          .from('job_orders').select('jo_number, status').eq('id', result.jo_id).single()
        if (joData) {
          const jo = joData as { jo_number: string; status: string }
          result.jo_number = jo.jo_number
          result.jo_status = jo.status
        }
      }
      setTrackResult(result)
    } catch { setTrackError('Could not connect. Please try again.') }
    finally { setTrackLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isPage3Valid || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const id  = generateId()
      const now = new Date().toISOString()

      // Upload attachments (all design activities)
      let attachmentUrls: string[] = []
      if (isDesignActivity && attachedFiles.length > 0) {
        const uploads = await Promise.all(
          attachedFiles.map((file, i) => uploadBookingFile(id, file, i))
        )
        attachmentUrls = uploads.filter(Boolean) as string[]
      }

      // Build design specs if applicable
      const designSpecs: DesignSpecs | undefined = isDesignActivity
        ? {
            paperSize:       form.dsw_paperSize,
            orientation:     form.dsw_orientation,
            colorMode:       form.dsw_colorMode,
            dimensions:      form.dsw_dimensions,
            material:        form.dsw_material,
            additionalNotes: form.dsw_additionalNotes,
            ...(form.activityType === 'Video Editing' && form.dsw_platform ? { platform: form.dsw_platform } : {}),
            ...(attachmentUrls.length > 0 ? { attachmentUrls } : {}),
            ...(attachedLinks.length > 0  ? { fileLinks: attachedLinks } : {}),
          }
        : form.activityType === 'Video Shoot' && form.dsw_shootTypeDetail
          ? { paperSize: '', orientation: '', colorMode: '', dimensions: '', material: '', additionalNotes: '', shootTypeDetail: form.dsw_shootTypeDetail }
          : undefined

      const req: BookingRequest = {
        id,
        activityType:  form.activityType as ActivityType,
        shootType:     SHOOT_ACTIVITIES.includes(form.activityType as ActivityType) ? (form.shootType as ShootType) || undefined : undefined,
        projectScale:  form.projectScale ? (form.projectScale as ProjectScale) : undefined,
        designSpecs,
        department:    effectiveDepartment,
        departmentLocal: form.departmentLocal.trim(),
        requestorName:   form.requestorName.trim(),
        requestorEmail:  form.requestorEmail.trim(),
        preparedBy:      form.preparedBy.trim(),
        approverName:    form.approverName.trim(),
        approverEmail:   form.approverEmail.trim(),
        projectName:     form.projectName.trim(),
        encodedAt:  now,
        neededDate: form.neededDate,
        endDate:    isDateOnlyService ? form.neededDate : form.endDate,
        startTime:  isDateOnlyService ? '' : form.startTime,
        endTime:    isDateOnlyService ? '' : form.endTime,
        venue:  isShootService ? form.venue.trim() : '',
        notes:  form.notes.trim(),
        status: 'Pending Approval',
        assignedMemberIds: [],
        createdAt: now,
      }

      const row = requestToRow(req)
      let { error } = await supabase.from('booking_requests').insert(row)
      if (error && error.message?.includes('requestor_name')) {
        // Column not yet migrated — retry without it
        const { requestor_name: _drop, ...rowFallback } = row as Record<string, unknown>
        const res2 = await supabase.from('booking_requests').insert(rowFallback)
        error = res2.error
      }
      if (error) throw error

      fetch('https://dap-flow-tau.vercel.app/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalRequest: true,
          approverEmail: form.approverEmail.trim(), approverName: form.approverName.trim(),
          preparedBy:    form.preparedBy.trim(),    activityType: form.activityType,
          projectName:   form.projectName.trim(),   department: effectiveDepartment,
          neededDate:    form.neededDate,            endDate:    form.endDate,
          venue:         form.venue.trim(),          refId:      id.slice(0, 8).toUpperCase(),
          fullId: id,
          ...(form.activityType === 'Video Editing' && form.dsw_platform ? { platform: form.dsw_platform } : {}),
          ...(form.activityType === 'Video Shoot' && form.dsw_shootTypeDetail ? { shootTypeDetail: form.dsw_shootTypeDetail } : {}),
        }),
      }).catch(console.error)

      setSubmitted({ id, refId: id.slice(0, 8).toUpperCase(), email: form.requestorEmail.trim(), activity: form.activityType, approverName: form.approverName.trim() })
      setLiveStatus('Pending Approval')
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(msg || 'Something went wrong. Please try again.')
    }
    finally { setSubmitting(false) }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    const step2Done = liveStatus !== 'Pending Approval'
    const step3Done = ['Assigned','Approved','Completed'].includes(liveStatus)
    const rejected  = liveStatus === 'Rejected' || liveStatus === 'Cancelled'
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#1B2F5E 0%,#3C4C9C 60%,#6F84DB 100%)' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Successfully Submitted</p>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Booking Request Received</h2>
            <p className="text-slate-500 text-sm mb-6">Your request has been sent to <span className="font-semibold text-slate-700">{submitted.approverName}</span> for approval.</p>
            <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Reference Number</p>
              <p className="font-mono font-black text-2xl text-brand-700 tracking-widest">{submitted.refId}</p>
              <p className="text-xs text-slate-400 mt-1">Save this for tracking your request</p>
            </div>
            <div className="mb-6 text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Request Status</p>
              <div className="space-y-0">
                {[
                  { done: true, color: 'bg-emerald-500', label: 'Request Submitted', sub: 'Your booking was received' },
                  { done: step2Done && !rejected, color: step2Done && !rejected ? 'bg-emerald-500' : rejected ? 'bg-red-400' : 'bg-amber-400',
                    label: rejected ? 'Request Declined' : step2Done ? 'Approved by Approver' : 'Waiting for Approval',
                    sub: rejected ? 'The approver did not approve this request' : step2Done ? `${submitted.approverName} has approved` : `Pending review by ${submitted.approverName}` },
                  { done: step3Done, color: step3Done ? 'bg-emerald-500' : 'bg-slate-200',
                    label: step3Done ? 'Assigned to DAP Team' : 'Waiting to be Assigned',
                    sub: step3Done ? 'A DAP team member has been assigned' : 'The DAP team will assign once approved' },
                ].map((step, i, arr) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${step.color}`}>
                        {step.done
                          ? <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : rejected && i === 1
                            ? <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            : <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />}
                      </div>
                      {i < arr.length - 1 && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pt-1">
                      <p className={`text-sm font-bold ${step.done ? 'text-emerald-700' : rejected && i === 1 ? 'text-red-600' : i === 1 ? 'text-amber-700' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="text-xs text-slate-400">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-300 mt-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Live status · updates every 6 seconds
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <span className="text-lg">{SERVICE_ICONS[submitted.activity]}</span>
              <div>
                <span className="font-semibold text-slate-700">{submitted.activity}</span>
                <p className="text-xs text-slate-400">Updates sent to {submitted.email}</p>
              </div>
            </div>
            <button
              onClick={() => { setForm(EMPTY); setSubmitted(null); setLiveStatus('Pending Approval'); setPage(1); setSelectionStage('start'); setPendingActivity(''); setAttachedFiles([]); setAttachedLinks([]) }}
              className="w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#1B2F5E,#6F84DB)' }}>
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  const BG = 'linear-gradient(160deg,#1B2F5E 0%,#3C4C9C 60%,#6F84DB 100%)'

  // ── Page 1: Select Service ─────────────────────────────────────────────────
  if (page === 1) {
    // Sub-step: Shoot Type selection
    if (pendingActivity && SHOOT_ACTIVITIES.includes(pendingActivity as ActivityType)) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: BG }}>
          <Header />
          <StepBar page={1} />

          <div className="px-6 sm:px-10 pt-4 pb-2">
            <div className="max-w-lg mx-auto">
              <button type="button" onClick={() => setPendingActivity('')}
                className="flex items-center gap-1.5 text-brand-200 hover:text-white text-xs font-semibold transition-colors mb-4">
                <ArrowLeft size={14} /> Back to services
              </button>
              <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-4 py-2.5 mb-6">
                <span className="text-xl">{SERVICE_ICONS[pendingActivity]}</span>
                <div>
                  <p className="text-white font-bold text-sm">{pendingActivity}</p>
                  <p className="text-brand-200 text-xs">{SERVICE_DESC[pendingActivity]}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 py-3 text-center">
            <h1 className="text-2xl font-black text-white mb-1">What type of {pendingActivity === 'Photo Shoot' ? 'photo' : 'video'} shoot?</h1>
            <p className="text-brand-200 text-sm max-w-md mx-auto">This determines crew requirements and booking capacity.</p>
          </div>

          <div className="flex-1 px-6 sm:px-10 pb-10">
            <div className="max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Minor Shoot */}
              <button type="button"
                onClick={() => {
                  setForm(prev => ({ ...prev, activityType: pendingActivity as ActivityType, shootType: 'Minor' }))
                  setPendingActivity('')
                  setPage(2)
                }}
                className="group flex flex-col gap-3 p-6 rounded-2xl border-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/50 transition-all text-left hover:scale-[1.02]">
                <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-2xl">
                  🎯
                </div>
                <div>
                  <p className="font-black text-lg">Minor</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">Partial crew · suitable for smaller scoped shoots, quick content, or focused sessions</p>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-amber-300">Partial Crew Required</span>
                </div>
              </button>

              {/* Major Shoot */}
              <button type="button"
                onClick={() => {
                  setForm(prev => ({ ...prev, activityType: pendingActivity as ActivityType, shootType: 'Major' }))
                  setPendingActivity('')
                  setPage(2)
                }}
                className="group flex flex-col gap-3 p-6 rounded-2xl border-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/50 transition-all text-left hover:scale-[1.02]">
                <div className="w-12 h-12 rounded-xl bg-red-400/20 border border-red-300/30 flex items-center justify-center text-2xl">
                  🚀
                </div>
                <div>
                  <p className="font-black text-lg">Major</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">Full crew · campaign-level or large-scale production requiring all available members</p>
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs font-bold text-red-300">Full Crew Required · Blocks date for major shoots</span>
                </div>
              </button>
            </div>

            {/* Info box */}
            <div className="max-w-lg mx-auto mt-4 flex items-start gap-2.5 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
              <Info size={14} className="text-brand-200 shrink-0 mt-0.5" />
              <p className="text-brand-200 text-xs leading-relaxed">
                <span className="font-semibold text-white">Major</span> shoots block the date for other Major bookings on the same day.{' '}
                <span className="font-semibold text-white">Minor</span> shoots may share availability depending on remaining capacity.
              </p>
            </div>
          </div>

          <div className="text-center py-4 border-t border-white/10">
            <p className="text-brand-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
          </div>
        </div>
      )
    }

    // Main page 1: Service grid
    return (
      <div className="min-h-screen flex flex-col" style={{ background: BG }}>
        <Header />
        <StepBar page={1} />
        <div className="px-6 sm:px-10 py-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">What service do you need?</h1>
          <p className="text-brand-200 text-sm max-w-md mx-auto">Click a service to check availability and continue.</p>
        </div>
        <div className="flex-1 px-6 sm:px-10 pb-10">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {displayActivityTypes.map(type => (
                <button key={type} type="button"
                  onClick={() => {
                    if (SHOOT_ACTIVITIES.includes(type)) {
                      // Sub-step: ask shoot type first
                      setPendingActivity(type)
                    } else {
                      setForm(prev => ({ ...prev, activityType: type, shootType: '' }))
                      setPage(2)
                    }
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 hover:scale-[1.02]">
                  <span className="text-3xl shrink-0">{SERVICE_ICONS[type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight">{type}</p>
                    <p className="text-xs mt-0.5 leading-snug text-white/60">{SERVICE_DESC[type]}</p>
                  </div>
                  {SHOOT_ACTIVITIES.includes(type) && (
                    <span className="shrink-0 text-[9px] font-bold bg-white/20 text-white/80 px-2 py-0.5 rounded-full">
                      Minor / Major
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Request tracker */}
            <div className="mt-2 bg-white/10 border border-white/20 rounded-2xl p-5">
              <p className="text-white font-bold text-sm mb-1">Track your request</p>
              <p className="text-brand-200 text-xs mb-4">Enter your reference number to see the current status.</p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <input value={trackRef}
                  onChange={e => { setTrackRef(e.target.value.toUpperCase()); setTrackError(''); setTrackResult(null) }}
                  placeholder="e.g. A1B2C3D4" maxLength={8}
                  className="flex-1 bg-white/20 border border-white/30 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-white/60 transition-colors" />
                <button type="submit" disabled={trackLoading}
                  className="px-4 py-2.5 bg-white text-brand-800 font-bold text-sm rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-60">
                  {trackLoading ? '...' : 'Track'}
                </button>
              </form>
              {trackError && <p className="text-red-300 text-xs mt-2">{trackError}</p>}
              {trackResult && (() => {
                const JO_MAP: Record<string, string> = { 'Pending':'Assigned','Approved':'Assigned','Scheduled':'Scheduled','For Review':'For Review','Completed':'Completed','Delayed':'Assigned','Cancelled':'Cancelled' }
                const joStatus   = trackResult.jo_status ?? null
                const isDelayed  = joStatus === 'Delayed'
                const isRejected = trackResult.status === 'Rejected'
                const isCancelled = trackResult.status === 'Cancelled' || joStatus === 'Cancelled'
                const isTerminal  = isCancelled || isRejected
                const effectiveKey = joStatus && JO_MAP[joStatus] ? JO_MAP[joStatus] : trackResult.status
                const STEPS = [
                  { key: 'Pending Approval', label: 'Submitted' },
                  { key: 'Pending Review',   label: 'Approved' },
                  { key: 'Assigned',         label: 'Assigned' },
                  { key: 'Scheduled',        label: 'Scheduled' },
                  { key: 'For Review',       label: 'For Review' },
                  { key: 'Completed',        label: 'Completed' },
                ]
                const curIdx     = isTerminal ? -1 : STEPS.findIndex(s => s.key === effectiveKey)
                const reachedIdx = isTerminal ? -1 : (curIdx === -1 ? STEPS.length - 1 : curIdx)
                const displayStatus = joStatus && !['Pending','Approved'].includes(joStatus) ? joStatus : trackResult.status
                const badgeCls = isTerminal || isDelayed
                  ? isDelayed ? 'bg-amber-500/30 text-amber-200' : 'bg-red-500/30 text-red-200'
                  : 'bg-emerald-500/20 text-emerald-300'
                return (
                  <div className="mt-4 bg-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <p className="text-white text-xs font-bold uppercase tracking-wide">{trackResult.activity_type}</p>
                        {trackResult.jo_number && <p className="text-brand-200 text-[10px] mt-0.5">Job Order: <span className="font-mono font-bold text-white">{trackResult.jo_number}</span></p>}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>{displayStatus}</span>
                    </div>
                    <div className="flex items-start">
                      {STEPS.map((step, i) => {
                        const done   = !isTerminal && i <= reachedIdx
                        const active = !isTerminal && i === curIdx
                        const delayed = isDelayed && active
                        return (
                          <div key={step.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                            <div className="flex items-center w-full">
                              {i > 0 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black
                                ${delayed ? 'bg-amber-400 text-white ring-2 ring-amber-300/60 scale-110'
                                : done ? 'bg-emerald-400 text-white' : 'bg-white/20 text-white/40'}
                                ${active && !delayed ? 'ring-2 ring-white/70 scale-110' : ''}`}>
                                {delayed ? '!' : done ? '✓' : i + 1}
                              </div>
                              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < reachedIdx ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                            </div>
                            <p className={`text-[9px] font-bold mt-1 leading-tight px-0.5 ${delayed ? 'text-amber-300' : done ? 'text-white' : 'text-white/35'}`}>{step.label}</p>
                          </div>
                        )
                      })}
                    </div>
                    {isDelayed && (
                      <div className="mt-3 flex items-center gap-2 bg-amber-500/20 rounded-xl px-3 py-2.5">
                        <span className="text-base">⚠️</span>
                        <div><p className="text-xs font-bold text-amber-200">Job Order Delayed</p><p className="text-[10px] text-white/50">Assigned but past due date.</p></div>
                      </div>
                    )}
                    {isTerminal && (
                      <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 ${isCancelled ? 'bg-slate-500/20' : 'bg-red-500/20'}`}>
                        <span className="text-base">{isCancelled ? '🚫' : '❌'}</span>
                        <div>
                          <p className={`text-xs font-bold ${isCancelled ? 'text-slate-200' : 'text-red-200'}`}>{isCancelled ? 'Cancelled' : 'Request Rejected'}</p>
                          <p className="text-[10px] text-white/50">{isRejected ? 'Not approved by your manager.' : 'This request or job order was cancelled.'}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-white/40 text-[10px] text-center mt-3">Prepared by {trackResult.prepared_by}</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        <div className="text-center py-4 border-t border-white/10">
          <p className="text-brand-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
        </div>
      </div>
    )
  }

  // ── Page 2: Date-only services — SimpleDatePicker ────────────────────────
  if (page === 2 && isDateOnlyService) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: BG }}>
        <Header />
        <StepBar page={2} />

        <div className="px-6 sm:px-10 pt-4 pb-2">
          <div className="max-w-xl mx-auto flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => setPage(1)}
              className="flex items-center gap-1.5 text-brand-200 hover:text-white text-xs font-semibold transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-3 py-1.5">
              <span className="text-base">{SERVICE_ICONS[form.activityType]}</span>
              <span className="text-white text-xs font-bold">{form.activityType}</span>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 py-3 text-center">
          <h1 className="text-xl sm:text-2xl font-black text-white mb-1">When do you need it?</h1>
          <p className="text-brand-200 text-xs">Select the date you need this artwork by.</p>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-10">
          <div className="max-w-xl mx-auto space-y-4">
            <SimpleDatePicker
              value={form.neededDate}
              onChange={iso => setForm(prev => ({ ...prev, neededDate: iso }))}
            />

            <button type="button" disabled={!isPage2Valid}
              onClick={() => setPage(3)}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: isPage2Valid ? 'linear-gradient(135deg,#1B2F5E 0%,#6F84DB 100%)' : '#94a3b8' }}>
              Continue to Details →
            </button>
          </div>
        </div>

        <div className="text-center py-4 border-t border-white/10">
          <p className="text-brand-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
        </div>
      </div>
    )
  }

  // ── Page 2: Choose Date ───────────────────────────────────────────────────
  if (page === 2) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: BG }}>
        <Header />
        <StepBar page={2} />

        <div className="px-6 sm:px-10 pt-4 pb-2">
          <div className="max-w-xl mx-auto flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => {
              setPage(1)
              setSelectionStage('start')
              // If it was a shoot activity, go back to shoot-type selector
              if (SHOOT_ACTIVITIES.includes(form.activityType as ActivityType)) {
                setPendingActivity(form.activityType as ActivityType)
              }
            }}
              className="flex items-center gap-1.5 text-brand-200 hover:text-white text-xs font-semibold transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-3 py-1.5">
              <span className="text-base">{SERVICE_ICONS[form.activityType]}</span>
              <span className="text-white text-xs font-bold">{form.activityType}</span>
              {form.shootType && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  form.shootType === 'Major' ? 'bg-red-400/30 text-red-200' : 'bg-amber-400/30 text-amber-200'
                }`}>{form.shootType}</span>
              )}
            </div>
            {/* Crew badge */}
            <CrewBadge activity={form.activityType} shootType={form.shootType as ShootType | ''} />
          </div>
        </div>

        <div className="px-6 sm:px-10 py-3 text-center">
          <h1 className="text-xl sm:text-2xl font-black text-white mb-1">When do you need it?</h1>
          <p className="text-brand-200 text-xs">Pick your preferred dates from the calendar below.</p>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-10">
          <div className="max-w-xl mx-auto space-y-4">

            {/* Full Crew warning */}
            {form.shootType === 'Major' && (
              <div className="flex items-start gap-2.5 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3">
                <AlertTriangle size={14} className="text-red-200 shrink-0 mt-0.5" />
                <p className="text-red-100 text-xs leading-relaxed">
                  <span className="font-bold">Major Shoot</span> — This booking requires Full Crew. Dates already occupied by another Major booking are blocked and cannot be selected.
                </p>
              </div>
            )}

            <AvailabilityCalendar
              activityType={form.activityType}
              shootType={form.shootType || undefined}
              selectedStart={form.neededDate}
              selectedEnd={form.endDate}
              selectionStage={selectionStage}
              onSelectDate={handleCalendarSelect}
            />

            {/* Date & time inputs */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={14} className="text-brand-500" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Schedule Details</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input type="date"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={form.neededDate} onChange={field('neededDate')} min={todayIso} required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input type="date"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={form.endDate} onChange={field('endDate')} min={form.neededDate || todayIso} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <TimePicker value={form.startTime} onChange={v => setForm(prev => ({ ...prev, startTime: v }))} placeholder="Pick start time" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <TimePicker value={form.endTime} onChange={v => setForm(prev => ({ ...prev, endTime: v }))} placeholder="Pick end time" />
                </div>
              </div>

              {form.neededDate && form.endDate && (
                <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5">
                  <CalendarDays size={13} className="text-brand-500 shrink-0" />
                  <p className="text-xs text-brand-700">
                    <span className="font-semibold">{new Date(form.neededDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {form.endDate !== form.neededDate && (
                      <> → <span className="font-semibold">{new Date(form.endDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span></>
                    )}
                    {form.startTime && form.endTime && (
                      <span className="text-brand-500 ml-1">· {(() => {
                        const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}` }
                        return `${fmt(form.startTime)} – ${fmt(form.endTime)}`
                      })()}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <button type="button" disabled={!isPage2Valid}
              onClick={() => setPage(3)}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: isPage2Valid ? 'linear-gradient(135deg,#1B2F5E 0%,#6F84DB 100%)' : '#94a3b8' }}>
              Continue to Details →
            </button>
          </div>
        </div>

        <div className="text-center py-4 border-t border-white/10">
          <p className="text-brand-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
        </div>
      </div>
    )
  }

  // ── Page 3: Fill Details ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      <Header />
      <StepBar page={3} />

      <div className="px-6 sm:px-10 pt-4 pb-2">
        <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => setPage(2)}
            className="flex items-center gap-1.5 text-brand-200 hover:text-white text-xs font-semibold transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-3 py-1.5">
            <span className="text-base">{SERVICE_ICONS[form.activityType]}</span>
            <span className="text-white text-xs font-bold">{form.activityType}</span>
            {form.shootType && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${form.shootType === 'Major' ? 'bg-red-400/30 text-red-200' : 'bg-amber-400/30 text-amber-200'}`}>
                {form.shootType}
              </span>
            )}
          </div>
          {form.neededDate && (
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
              <CalendarDays size={11} className="text-brand-200" />
              <span className="text-white text-xs font-semibold">
                {new Date(form.neededDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                {form.endDate && form.endDate !== form.neededDate && ` → ${new Date(form.endDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 sm:px-10 pb-10 pt-3">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#1B2F5E,#6F84DB,#10b981)' }} />

          <form onSubmit={handleSubmit} className="p-7 space-y-5">

            {/* Date encoded */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date Encoded</p>
                <p className="text-sm font-semibold text-slate-700">
                  {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {/* Crew info pill */}
              {form.activityType && (
                <div className="ml-auto">
                  <CrewBadge activity={form.activityType} shootType={form.shootType as ShootType | ''} />
                </div>
              )}
            </div>

            {/* Project name + scale */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                  placeholder="Name or title of your project / activity"
                  value={form.projectName} onChange={field('projectName')} autoFocus required />
                {form.activityType === 'Video Editing' && (
                  <p className="mt-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <span className="font-semibold">Note:</span> If this is a same-day edit, please indicate it in the Project Name (e.g., &ldquo;Same-Day Edit – Product Launch&rdquo;).
                  </p>
                )}
              </div>

            </div>

            {/* Design specs — only for design activities */}
            {DESIGN_ACTIVITIES.includes(form.activityType as ActivityType) && (
              <DesignSpecsForm
                values={form}
                onChange={setSpecField}
                activityType={form.activityType as ActivityType}
                attachments={attachedFiles}
                onAttachmentsChange={setAttachedFiles}
                fileLinks={attachedLinks}
                onFileLinksChange={setAttachedLinks}
              />
            )}

            {/* Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Requesting Department <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  value={form.department} onChange={field('department')} required>
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {form.department === 'Other' && (
                  <input type="text"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                    placeholder="Enter your department name"
                    value={form.departmentOther} onChange={field('departmentOther')} required />
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Department Local <span className="text-red-500">*</span>
                </label>
                <input type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                  placeholder="e.g. local 1234"
                  value={form.departmentLocal} onChange={field('departmentLocal')} required />
              </div>
            </div>

            {/* Requestor info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Requestor Name <span className="text-red-500">*</span>
                </label>
                <input type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                  placeholder="Full name of the requestor"
                  value={form.requestorName} onChange={field('requestorName')} required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Requestor Email <span className="text-red-500">*</span>
                </label>
                <input type="email"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                  placeholder="requestor@company.com"
                  value={form.requestorEmail} onChange={field('requestorEmail')} required />
              </div>
            </div>

            {/* Prepared by */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Prepared By <span className="text-red-500">*</span>
                <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400">— name of the person encoding this form</span>
              </label>
              <input type="text"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                placeholder="Full name of encoder"
                value={form.preparedBy} onChange={field('preparedBy')} required />
            </div>

            {/* Approver */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Approver <span className="text-red-500">*</span>
                <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400">— must be selected from the official list</span>
              </label>
              {approvers.filter(a => a.isActive !== false && (a.approverType ?? 'booking') === 'booking').length === 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  ⚠️ No active approvers configured. Please contact your administrator.
                </div>
              ) : (
                <ApproverDropdown
                  approvers={approvers}
                  selectedId={form.selectedApproverId}
                  selectedName={form.approverName}
                  approverEmail={form.approverEmail}
                  onSelect={(id, name, email, position) =>
                    setForm(prev => ({ ...prev, selectedApproverId: id, approverName: name, approverEmail: email, approverPosition: position }))
                  }
                  onClear={() =>
                    setForm(prev => ({ ...prev, selectedApproverId: '', approverName: '', approverEmail: '', approverPosition: '' }))
                  }
                  onEmailChange={email =>
                    setForm(prev => ({ ...prev, approverEmail: email }))
                  }
                />
              )}
              <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mt-2">
                <Info size={13} className="text-brand-500 shrink-0 mt-0.5" />
                <p className="text-xs text-brand-700 leading-relaxed">
                  Your request will first be sent to{' '}
                  <span className="font-semibold">{form.approverName || 'your selected approver'}</span> for confirmation before the DAP team proceeds.
                </p>
              </div>
            </div>

            {/* Venue — shown only for Photo Shoot and Video Shoot */}
            {isShootService && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Venue / Location <span className="text-red-500">*</span>
                </label>
                <input type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400"
                  placeholder="Where will the activity be held?"
                  value={form.venue} onChange={field('venue')} required />
              </div>
            )}

            {/* Type of Shoot — only for Video Shoot */}
            {form.activityType === 'Video Shoot' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Type of Shoot <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  value={form.dsw_shootTypeDetail} onChange={field('dsw_shootTypeDetail')} required>
                  <option value="">Select type of shoot…</option>
                  {opts('Video Shoot', 'dsw_shootTypeDetail', ['Stream', 'BTS (Behind the Scenes)']).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}

            {/* Notes — only shown for non-design services; design activities have this inside the specs form */}
            {!isDesignActivity && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Additional Notes <span className="text-red-500">*</span>
                </label>
                <textarea rows={4}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 placeholder-slate-400 resize-none"
                  placeholder="Special requirements, expected deliverables, creative direction, reference materials, or any details the DAP team should know…"
                  value={form.notes} onChange={field('notes')} required />
                <p className="text-[10px] text-slate-400 mt-1">Be as specific as possible to reduce clarification rounds.</p>
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span><strong>Submission failed:</strong> {submitError}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={!isPage3Valid || submitting}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: !isPage3Valid || submitting ? '#94a3b8' : 'linear-gradient(135deg,#1B2F5E 0%,#6F84DB 100%)' }}>
              {submitting ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Submitting Request…</>
              ) : 'Submit for Approval →'}
            </button>
            <p className="text-center text-xs text-slate-400">
              Your request will be sent to your approver first before the DAP team is notified.
            </p>
          </form>
        </div>
      </div>

      <div className="text-center py-4 border-t border-white/10">
        <p className="text-brand-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
