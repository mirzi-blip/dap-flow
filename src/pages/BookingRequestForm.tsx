import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Aperture, ArrowLeft, ChevronLeft, ChevronRight, Search, ChevronDown } from 'lucide-react'
import { supabase, requestToRow, rowToApprover } from '../lib/supabase'
import type { ActivityType, BookingRequest, Approver } from '../types'
import { generateId } from '../utils/helpers'

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot',
  'Video Shoot',
  'Static Artwork Design',
  'Video Editing',
  'Audio Recording',
  'Audio Editing',
]

// Fallback departments if Supabase is unavailable
const DEFAULT_DEPTS = ['BMG', 'MOD', 'MTO', 'CBE', 'Sales', 'HR']
const MAX_CONCURRENT = 3 // bookings per service per day before "fully booked"

interface FormState {
  activityType: ActivityType | ''
  department: string
  departmentOther: string
  departmentLocal: string
  requestorEmail: string
  preparedBy: string
  approverName: string
  approverEmail: string
  projectName: string
  neededDate: string
  endDate: string
  startTime: string
  endTime: string
  venue: string
  notes: string
}

const EMPTY: FormState = {
  activityType: '', department: '', departmentOther: '', departmentLocal: '',
  requestorEmail: '', preparedBy: '', approverName: '', approverEmail: '',
  projectName: '', neededDate: '', endDate: '', startTime: '', endTime: '',
  venue: '', notes: '',
}

const SERVICE_ICONS: Record<string, string> = {
  'Photo Shoot': '📷',
  'Video Shoot': '🎬',
  'Static Artwork Design': '🎨',
  'Video Editing': '✂️',
  'Audio Recording': '🎙️',
  'Audio Editing': '🎧',
}

const SERVICE_DESC: Record<string, string> = {
  'Photo Shoot': 'Product, event, or portrait photography',
  'Video Shoot': 'Video production & filming',
  'Static Artwork Design': 'Graphics, layouts & print-ready assets',
  'Video Editing': 'Post-production & video assembly',
  'Audio Recording': 'Voice-over, podcast & recording sessions',
  'Audio Editing': 'Mixing, mastering & audio cleanup',
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Availability Calendar ────────────────────────────────────────────────────
interface AvailabilityCalendarProps {
  activityType: string
  selectedStart: string
  selectedEnd: string
  onSelectDate: (iso: string) => void
}

function AvailabilityCalendar({ activityType, selectedStart, selectedEnd, onSelectDate }: AvailabilityCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<{ neededDate: string; endDate: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activityType) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('booking_requests')
      .select('needed_date, end_date')
      .eq('activity_type', activityType)
      .not('status', 'in', '("Rejected","Cancelled")')
      .then(({ data }) => {
        if (!cancelled && data) {
          setBookings(
            data.map(r => ({
              neededDate: r.needed_date as string,
              endDate: (r.end_date || r.needed_date) as string,
            }))
          )
        }
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activityType])

  function countForDay(isoDate: string): number {
    return bookings.filter(b => b.neededDate <= isoDate && b.endDate >= isoDate).length
  }

  const todayIso = today.toISOString().split('T')[0]
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Prevent navigating to past months
  const isPrevDisabled = viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth())

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Service Availability</p>
          {loading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Loading…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isPrevDisabled}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-bold text-slate-700 min-w-[110px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <p key={d} className="text-center text-[10px] font-bold text-slate-400 py-0.5">{d}</p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Offset cells */}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = countForDay(iso)
          const isPast = iso < todayIso
          const isFull = count >= MAX_CONCURRENT
          const isPartial2 = count === MAX_CONCURRENT - 1
          const isPartial1 = count > 0 && count < MAX_CONCURRENT - 1
          const isSelectedStart = iso === selectedStart
          const isSelectedEnd = iso === selectedEnd
          const isInRange = selectedStart && selectedEnd && iso > selectedStart && iso < selectedEnd
          const disabled = isPast || isFull

          let cellClass = ''
          if (isSelectedStart || isSelectedEnd) {
            cellClass = 'bg-blue-600 text-white ring-2 ring-blue-600 shadow-sm'
          } else if (isInRange) {
            cellClass = 'bg-blue-100 text-blue-700'
          } else if (isPast) {
            cellClass = 'bg-slate-100 text-slate-300 cursor-not-allowed'
          } else if (isFull) {
            cellClass = 'bg-red-100 text-red-400 cursor-not-allowed line-through'
          } else if (isPartial2) {
            cellClass = 'bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer'
          } else if (isPartial1) {
            cellClass = 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 cursor-pointer'
          } else {
            cellClass = 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer border border-slate-100'
          }

          const isToday = iso === todayIso
          const todayRing = isToday && !isSelectedStart && !isSelectedEnd ? 'ring-2 ring-blue-400 ring-offset-1' : ''

          const tooltip = isPast
            ? 'Past date'
            : isFull
              ? 'Fully booked'
              : count > 0
                ? `${count} booking${count > 1 ? 's' : ''} — limited slots`
                : 'Available'

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(iso)}
              title={tooltip}
              className={`h-8 rounded-lg text-xs font-semibold transition-all ${cellClass} ${todayRing}`}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
          <span className="text-[10px] text-slate-500">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100" />
          <span className="text-[10px] text-slate-500">Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100" />
          <span className="text-[10px] text-slate-500">Fully Booked</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded-sm bg-blue-600" />
          <span className="text-[10px] text-slate-500">Selected</span>
        </div>
      </div>
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div className="flex items-center gap-3 px-6 sm:px-10 py-4 border-b border-white/10">
      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
        <Camera size={16} className="text-white" strokeWidth={2.5} />
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-400 rounded-full flex items-center justify-center">
          <Aperture size={8} className="text-white" strokeWidth={3} />
        </span>
      </div>
      <div>
        <p className="text-white font-bold text-sm leading-none">DAP Flow</p>
        <p className="text-blue-200 text-[10px] uppercase tracking-widest mt-0.5">Studio Booking Portal</p>
      </div>
    </div>
  )
}

// ── Approver Dropdown ─────────────────────────────────────────────────────────
interface ApproverDropdownProps {
  approvers: Approver[]
  selectedName: string
  onSelect: (name: string, email: string) => void
}

function ApproverDropdown({ approvers, selectedName, onSelect }: ApproverDropdownProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = search
    ? approvers.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
    : approvers

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-left hover:border-blue-300 transition-colors"
      >
        <span className="flex-1 truncate">{selectedName || <span className="text-slate-400">Select approver…</span>}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {approvers.length === 0 ? 'No approvers configured yet' : 'No matches found'}
              </div>
            ) : filtered.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => { onSelect(a.name, a.email); setSearch(''); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors ${a.name === selectedName ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.name}</p>
                  {a.position && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{a.position}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{a.email}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tracking types ────────────────────────────────────────────────────────────
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
  const [page, setPage] = useState<1 | 2>(1)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string; refId: string; email: string; activity: string; approverName: string } | null>(null)
  const [liveStatus, setLiveStatus] = useState<string>('Pending Approval')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [trackRef, setTrackRef] = useState('')
  const [trackResult, setTrackResult] = useState<TrackedRequest | null>(null)
  const [trackError, setTrackError] = useState('')
  const [trackLoading, setTrackLoading] = useState(false)

  // Dynamic data
  const [departments, setDepartments] = useState<string[]>([...DEFAULT_DEPTS])
  const [approvers, setApprovers] = useState<Approver[]>([])

  // Fetch dynamic departments and approvers from Supabase on mount
  useEffect(() => {
    async function loadData() {
      // Departments
      try {
        const { data } = await supabase
          .from('booking_departments')
          .select('name')
          .order('created_at', { ascending: true })
        if (data && data.length > 0) {
          setDepartments([...(data as { name: string }[]).map(d => d.name), 'Other'])
        } else {
          setDepartments([...DEFAULT_DEPTS, 'Other'])
        }
      } catch {
        setDepartments([...DEFAULT_DEPTS, 'Other'])
      }
      // Approvers
      try {
        const { data } = await supabase
          .from('approvers')
          .select('id, name, email, position, created_at')
          .order('name', { ascending: true })
        if (data) setApprovers((data as Record<string, unknown>[]).map(rowToApprover))
      } catch { /* offline — leave empty */ }
    }
    loadData()
  }, [])

  // Poll live status after submission
  useEffect(() => {
    if (!submitted) return
    const poll = async () => {
      try {
        const { data } = await supabase
          .from('booking_requests')
          .select('status')
          .eq('id', submitted.id)
          .single()
        if (data?.status) {
          setLiveStatus(data.status as string)
          if (['Assigned', 'Approved', 'Rejected', 'Completed', 'Cancelled'].includes(data.status as string)) {
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 6000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [submitted])

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const effectiveDepartment = form.department === 'Other' ? form.departmentOther.trim() : form.department
  const todayIso = new Date().toISOString().split('T')[0]

  const isPage2Valid =
    form.department !== '' &&
    (form.department !== 'Other' || form.departmentOther.trim() !== '') &&
    form.departmentLocal.trim() !== '' &&
    form.requestorEmail.trim() !== '' &&
    form.preparedBy.trim() !== '' &&
    form.approverName.trim() !== '' &&
    form.approverEmail.trim() !== '' &&
    form.projectName.trim() !== '' &&
    form.neededDate !== '' &&
    form.endDate !== '' &&
    form.startTime !== '' &&
    form.endTime !== '' &&
    form.venue.trim() !== ''

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

  // Calendar date selection — fills start date, optionally end date if not set
  const handleCalendarSelect = useCallback((iso: string) => {
    setForm(prev => ({
      ...prev,
      neededDate: iso,
      // If end date is empty or before the new start, update it too
      endDate: !prev.endDate || prev.endDate < iso ? iso : prev.endDate,
    }))
  }, [])

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    const ref = trackRef.trim().toUpperCase()
    if (ref.length < 6) { setTrackError('Please enter at least 6 characters of your reference number.'); return }
    setTrackLoading(true)
    setTrackError('')
    setTrackResult(null)
    try {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('status, activity_type, prepared_by, created_at, jo_id')
        .ilike('id', `${ref}%`)
        .limit(1)
        .single()
      if (error || !data) { setTrackError('No request found with that reference number. Please check and try again.'); return }
      const result = data as TrackedRequest
      if (result.jo_id) {
        const { data: joData } = await supabase
          .from('job_orders')
          .select('jo_number, status')
          .eq('id', result.jo_id)
          .single()
        if (joData) {
          const jo = joData as { jo_number: string; status: string }
          result.jo_number = jo.jo_number
          result.jo_status  = jo.status
        }
      }
      setTrackResult(result)
    } catch {
      setTrackError('Could not connect. Please try again.')
    } finally {
      setTrackLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isPage2Valid || submitting) return
    setSubmitting(true)
    try {
      const id = generateId()
      const now = new Date().toISOString()
      const req: BookingRequest = {
        id,
        activityType: form.activityType as ActivityType,
        department: effectiveDepartment,
        departmentLocal: form.departmentLocal.trim(),
        requestorEmail: form.requestorEmail.trim(),
        preparedBy: form.preparedBy.trim(),
        approverName: form.approverName.trim(),
        approverEmail: form.approverEmail.trim(),
        projectName: form.projectName.trim(),
        encodedAt: now,
        neededDate: form.neededDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        venue: form.venue.trim(),
        notes: form.notes.trim(),
        status: 'Pending Approval',
        assignedMemberIds: [],
        createdAt: now,
      }
      const { error } = await supabase.from('booking_requests').insert(requestToRow(req))
      if (error) throw error

      // Notify approver by email (fire-and-forget)
      fetch('https://dap-flow-tau.vercel.app/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalRequest: true,
          approverEmail: form.approverEmail.trim(),
          approverName: form.approverName.trim(),
          preparedBy: form.preparedBy.trim(),
          activityType: form.activityType,
          projectName: form.projectName.trim(),
          department: effectiveDepartment,
          neededDate: form.neededDate,
          endDate: form.endDate,
          venue: form.venue.trim(),
          refId: id.slice(0, 8).toUpperCase(),
          fullId: id,
        }),
      }).catch(console.error)

      setSubmitted({
        id,
        refId: id.slice(0, 8).toUpperCase(),
        email: form.requestorEmail.trim(),
        activity: form.activityType,
        approverName: form.approverName.trim(),
      })
      setLiveStatus('Pending Approval')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f4c81 0%,#1a6fb5 60%,#2389d7 100%)' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Successfully Submitted</p>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Booking Request Received</h2>
            <p className="text-slate-500 text-sm mb-6">Your request has been sent to <span className="font-semibold text-slate-700">{submitted.approverName}</span> for approval.</p>
            <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Reference Number</p>
              <p className="font-mono font-black text-2xl text-blue-700 tracking-widest">{submitted.refId}</p>
              <p className="text-xs text-slate-400 mt-1">Save this for tracking your request</p>
            </div>
            {/* Live status tracker */}
            {(() => {
              const step2Done = liveStatus !== 'Pending Approval'
              const step3Done = ['Assigned', 'Approved', 'Completed'].includes(liveStatus)
              const rejected = liveStatus === 'Rejected' || liveStatus === 'Cancelled'
              return (
                <div className="mb-6 text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Request Status</p>
                  <div className="space-y-0">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className="w-0.5 h-6 bg-slate-200 mt-1" />
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-bold text-emerald-700">Request Submitted</p>
                        <p className="text-xs text-slate-400">Your booking was received</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${step2Done && !rejected ? 'bg-emerald-500' : rejected ? 'bg-red-400' : 'bg-amber-400'}`}>
                          {step2Done && !rejected ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : rejected ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
                          )}
                        </div>
                        <div className="w-0.5 h-6 bg-slate-200 mt-1" />
                      </div>
                      <div className="pt-1">
                        <p className={`text-sm font-bold ${step2Done && !rejected ? 'text-emerald-700' : rejected ? 'text-red-600' : 'text-amber-700'}`}>
                          {rejected ? 'Request Declined' : step2Done ? 'Approved by Approver' : 'Waiting for Approval'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {rejected ? 'The approver did not approve this request' : step2Done ? `${submitted.approverName} has approved your request` : `Pending review by ${submitted.approverName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${step3Done ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {step3Done ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                          )}
                        </div>
                      </div>
                      <div className="pt-1">
                        <p className={`text-sm font-bold ${step3Done ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {step3Done ? 'Assigned to DAP Team' : 'Waiting to be Assigned'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {step3Done ? 'A DAP team member has been assigned' : 'The DAP team will assign a member once approved'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    Live status · updates every 6 seconds
                  </p>
                </div>
              )
            })()}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <span className="text-lg">{SERVICE_ICONS[submitted.activity]}</span>
              <div>
                <span className="font-semibold text-slate-700">{submitted.activity}</span>
                <p className="text-xs text-slate-400">Updates sent to {submitted.email}</p>
              </div>
            </div>
            <button
              onClick={() => { setForm(EMPTY); setSubmitted(null); setLiveStatus('Pending Approval'); setPage(1) }}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
              style={{ background: 'linear-gradient(135deg,#0f4c81,#2389d7)' }}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Page 1: Service Type ────────────────────────────────────────────────────
  if (page === 1) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f4c81 0%,#1a6fb5 60%,#2389d7 100%)' }}>
        <Header />
        <div className="flex items-center justify-center gap-3 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white text-blue-800 text-xs font-black flex items-center justify-center shadow">1</div>
            <span className="text-white text-xs font-semibold">Select Service</span>
          </div>
          <div className="w-8 h-px bg-white/30" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 text-white/60 text-xs font-black flex items-center justify-center">2</div>
            <span className="text-white/50 text-xs font-semibold">Fill Details</span>
          </div>
        </div>
        <div className="px-6 sm:px-10 py-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">What service do you need?</h1>
          <p className="text-blue-200 text-sm max-w-md mx-auto">Click a service to continue to the booking form.</p>
        </div>
        <div className="flex-1 px-6 sm:px-10 pb-10">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {ACTIVITY_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, activityType: type })); setPage(2) }}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 hover:scale-[1.02]"
                >
                  <span className="text-3xl shrink-0">{SERVICE_ICONS[type]}</span>
                  <div>
                    <p className="text-sm font-bold leading-tight">{type}</p>
                    <p className="text-xs mt-0.5 leading-snug text-white/60">{SERVICE_DESC[type]}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-blue-200/60 text-xs">Click a service to continue</p>

            {/* Request tracker */}
            <div className="mt-6 bg-white/10 border border-white/20 rounded-2xl p-5">
              <p className="text-white font-bold text-sm mb-1">Track your request</p>
              <p className="text-blue-200 text-xs mb-4">Enter your reference number to see the current status of your booking request.</p>
              <form onSubmit={handleTrack} className="flex gap-2">
                <input
                  value={trackRef}
                  onChange={e => { setTrackRef(e.target.value.toUpperCase()); setTrackError(''); setTrackResult(null) }}
                  placeholder="e.g. A1B2C3D4"
                  maxLength={8}
                  className="flex-1 bg-white/20 border border-white/30 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-white/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="px-4 py-2.5 bg-white text-blue-800 font-bold text-sm rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60"
                >
                  {trackLoading ? '...' : 'Track'}
                </button>
              </form>
              {trackError && <p className="text-red-300 text-xs mt-2">{trackError}</p>}
              {trackResult && (() => {
                const JO_STATUS_TO_STEP: Record<string, string> = {
                  'Pending':   'Assigned',
                  'Approved':  'Assigned',
                  'Scheduled': 'Scheduled',
                  'For Review':'For Review',
                  'Completed': 'Completed',
                  'Delayed':   'Assigned',
                  'Cancelled': 'Cancelled',
                }
                const joStatus = trackResult.jo_status ?? null
                const isDelayed   = joStatus === 'Delayed'
                const isJOCancelled = joStatus === 'Cancelled'
                const isRejected  = trackResult.status === 'Rejected'
                const isCancelled = trackResult.status === 'Cancelled' || isJOCancelled
                const isTerminal  = isCancelled || isRejected
                const effectiveStepKey = joStatus && JO_STATUS_TO_STEP[joStatus]
                  ? JO_STATUS_TO_STEP[joStatus]
                  : trackResult.status
                const STATUS_STEPS = [
                  { key: 'Pending Approval', label: 'Submitted' },
                  { key: 'Pending Review',   label: 'Approved' },
                  { key: 'Assigned',         label: 'Assigned' },
                  { key: 'Scheduled',        label: 'Scheduled' },
                  { key: 'For Review',       label: 'For Review' },
                  { key: 'Completed',        label: 'Completed' },
                ]
                const currentIdx = isTerminal ? -1 : STATUS_STEPS.findIndex(s => s.key === effectiveStepKey)
                const reachedIdx = isTerminal ? -1 : (currentIdx === -1 ? STATUS_STEPS.length - 1 : currentIdx)
                const displayStatus = joStatus && !['Pending', 'Approved'].includes(joStatus)
                  ? joStatus
                  : trackResult.status
                const badgeClass = isTerminal || isDelayed
                  ? isDelayed ? 'bg-amber-500/30 text-amber-200' : 'bg-red-500/30 text-red-200'
                  : 'bg-emerald-500/20 text-emerald-300'
                return (
                  <div className="mt-4 bg-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <p className="text-white text-xs font-bold uppercase tracking-wide">{trackResult.activity_type}</p>
                        {trackResult.jo_number && (
                          <p className="text-blue-200 text-[10px] mt-0.5">
                            Job Order: <span className="font-mono font-bold text-white">{trackResult.jo_number}</span>
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                        {displayStatus}
                      </span>
                    </div>
                    <div className="flex items-start">
                      {STATUS_STEPS.map((step, i) => {
                        const done   = !isTerminal && i <= reachedIdx
                        const active = !isTerminal && i === currentIdx
                        const delayedStep = isDelayed && active
                        return (
                          <div key={step.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                            <div className="flex items-center w-full">
                              {i > 0 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black transition-all
                                ${delayedStep ? 'bg-amber-400 text-white ring-2 ring-amber-300/60 scale-110'
                                  : done   ? 'bg-emerald-400 text-white'
                                  : 'bg-white/20 text-white/40'}
                                ${active && !delayedStep ? 'ring-2 ring-white/70 scale-110' : ''}`}>
                                {delayedStep ? '!' : done ? '✓' : i + 1}
                              </div>
                              {i < STATUS_STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < reachedIdx ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                            </div>
                            <p className={`text-[9px] font-bold mt-1 leading-tight px-0.5 ${delayedStep ? 'text-amber-300' : done ? 'text-white' : 'text-white/35'}`}>
                              {step.label}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    {isDelayed && (
                      <div className="mt-3 flex items-center gap-2 bg-amber-500/20 rounded-xl px-3 py-2.5">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="text-xs font-bold text-amber-200">Job Order Delayed</p>
                          <p className="text-[10px] text-white/50">This request has been assigned but the job order is past its due date.</p>
                        </div>
                      </div>
                    )}
                    {isTerminal && (
                      <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 ${isCancelled ? 'bg-slate-500/20' : 'bg-red-500/20'}`}>
                        <span className="text-base">{isCancelled ? '🚫' : '❌'}</span>
                        <div>
                          <p className={`text-xs font-bold ${isCancelled ? 'text-slate-200' : 'text-red-200'}`}>
                            {isCancelled ? 'Cancelled' : 'Request Rejected'}
                          </p>
                          <p className="text-[10px] text-white/50">
                            {isRejected
                              ? 'This booking request was not approved by your manager.'
                              : 'This request or its job order has been cancelled.'}
                          </p>
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
          <p className="text-blue-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
        </div>
      </div>
    )
  }

  // ── Page 2: Details ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f4c81 0%,#1a6fb5 60%,#2389d7 100%)' }}>
      <Header />

      <div className="flex items-center justify-center gap-3 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/30 text-white text-xs font-black flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-white/60 text-xs font-semibold">Select Service</span>
        </div>
        <div className="w-8 h-px bg-white/30" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white text-blue-800 text-xs font-black flex items-center justify-center shadow">2</div>
          <span className="text-white text-xs font-semibold">Fill Details</span>
        </div>
      </div>

      <div className="px-6 sm:px-10 pt-5 pb-2">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => setPage(1)} className="flex items-center gap-1.5 text-blue-200 hover:text-white text-xs font-semibold transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-3 py-1.5">
            <span className="text-base">{SERVICE_ICONS[form.activityType]}</span>
            <span className="text-white text-xs font-bold">{form.activityType}</span>
          </div>
          <p className="hidden sm:block text-blue-200 text-xs ml-auto">{today}</p>
        </div>
      </div>

      <div className="flex-1 px-6 sm:px-10 pb-10 pt-3">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#0f4c81,#2389d7,#10b981)' }} />

          <form onSubmit={handleSubmit} className="p-7 space-y-5">

            {/* Date Encoded (top, read-only) */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date Encoded</p>
                <p className="text-sm font-semibold text-slate-700">
                  {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Availability Calendar */}
            <AvailabilityCalendar
              activityType={form.activityType}
              selectedStart={form.neededDate}
              selectedEnd={form.endDate}
              onSelectDate={handleCalendarSelect}
            />

            {/* Project name */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                placeholder="Name or title of your project / activity"
                value={form.projectName}
                onChange={field('projectName')}
                autoFocus
                required
              />
            </div>

            {/* Department row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Requesting Department <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  value={form.department}
                  onChange={field('department')}
                  required
                >
                  <option value="">Select department…</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {form.department === 'Other' && (
                  <input
                    type="text"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                    placeholder="Enter your department name"
                    value={form.departmentOther}
                    onChange={field('departmentOther')}
                    required
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Department Local <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                  placeholder="e.g. local 1234"
                  value={form.departmentLocal}
                  onChange={field('departmentLocal')}
                  required
                />
              </div>
            </div>

            {/* Prepared by + email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Prepared By <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                  placeholder="Full name of encoder"
                  value={form.preparedBy}
                  onChange={field('preparedBy')}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Requestor Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                  placeholder="email@company.com"
                  value={form.requestorEmail}
                  onChange={field('requestorEmail')}
                  required
                />
              </div>
            </div>

            {/* Approver — dropdown if approvers list available, otherwise free-text */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Approver <span className="text-red-500">*</span>
                {approvers.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400">— select from list or type manually</span>
                )}
              </label>
              {approvers.length > 0 ? (
                <div className="space-y-2">
                  <ApproverDropdown
                    approvers={approvers}
                    selectedName={form.approverName}
                    onSelect={(name, email) => setForm(prev => ({ ...prev, approverName: name, approverEmail: email }))}
                  />
                  {/* Show email field (read-only when auto-filled, editable otherwise) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Approver Name</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 bg-slate-50"
                        placeholder="Auto-filled from selection"
                        value={form.approverName}
                        onChange={field('approverName')}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Approver Email</label>
                      <input
                        type="email"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 bg-slate-50"
                        placeholder="Auto-filled from selection"
                        value={form.approverEmail}
                        onChange={field('approverEmail')}
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Approver Name</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                      placeholder="Manager / supervisor name"
                      value={form.approverName}
                      onChange={field('approverName')}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Approver Email</label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                      placeholder="manager@company.com"
                      value={form.approverEmail}
                      onChange={field('approverEmail')}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Approver note */}
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <span className="text-blue-500 text-sm mt-0.5">ℹ️</span>
              <p className="text-xs text-blue-700 leading-relaxed">
                Your request will first be sent to <span className="font-semibold">{form.approverName || 'your approver'}</span> for confirmation before the DAP team proceeds.
              </p>
            </div>

            {/* Start date + End date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.neededDate}
                  onChange={field('neededDate')}
                  min={todayIso}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.endDate}
                  onChange={field('endDate')}
                  min={form.neededDate || todayIso}
                  required
                />
              </div>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.startTime}
                  onChange={field('startTime')}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.endTime}
                  onChange={field('endTime')}
                  required
                />
              </div>
            </div>

            {/* Venue */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Venue / Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                placeholder="Where will the activity be held?"
                value={form.venue}
                onChange={field('venue')}
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Additional Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 resize-none"
                placeholder="Special requirements, deliverables, or additional details…"
                value={form.notes}
                onChange={field('notes')}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isPage2Valid || submitting}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: !isPage2Valid || submitting ? '#94a3b8' : 'linear-gradient(135deg,#0f4c81 0%,#2389d7 100%)' }}
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Submitting Request…
                </>
              ) : (
                'Submit for Approval →'
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              Your request will be sent to your approver first before the DAP team is notified.
            </p>
          </form>
        </div>
      </div>

      <div className="text-center py-4 border-t border-white/10">
        <p className="text-blue-300 text-xs">Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
