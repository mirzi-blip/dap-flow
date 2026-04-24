import { useState } from 'react'
import { Camera, Aperture } from 'lucide-react'
import { supabase, requestToRow } from '../lib/supabase'
import type { ActivityType, BookingRequest } from '../types'
import { generateId } from '../utils/helpers'

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot',
  'Video Shoot',
  'Static Artwork Design',
  'Video Editing',
  'Audio Recording',
  'Audio Editing',
]

const DEPARTMENTS = ['BMG', 'MOD', 'MTO', 'CBE', 'Other']

interface FormState {
  activityType: ActivityType | ''
  department: string
  departmentOther: string
  departmentLocal: string
  requestorEmail: string
  preparedBy: string
  projectName: string
  neededDate: string
  startTime: string
  endTime: string
  venue: string
  notes: string
}

const EMPTY: FormState = {
  activityType: '', department: '', departmentOther: '', departmentLocal: '',
  requestorEmail: '', preparedBy: '', projectName: '',
  neededDate: '', startTime: '', endTime: '', venue: '', notes: '',
}

const SERVICE_ICONS: Record<string, string> = {
  'Photo Shoot': '📷',
  'Video Shoot': '🎬',
  'Static Artwork Design': '🎨',
  'Video Editing': '✂️',
  'Audio Recording': '🎙️',
  'Audio Editing': '🎧',
}

export function BookingRequestForm() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ refId: string; email: string; activity: string } | null>(null)

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const effectiveDepartment = form.department === 'Other' ? form.departmentOther.trim() : form.department

  const isValid =
    form.activityType !== '' && form.department !== '' &&
    (form.department !== 'Other' || form.departmentOther.trim() !== '') &&
    form.departmentLocal.trim() !== '' && form.requestorEmail.trim() !== '' &&
    form.preparedBy.trim() !== '' && form.projectName.trim() !== '' &&
    form.neededDate !== '' && form.startTime !== '' && form.endTime !== '' &&
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return
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
        projectName: form.projectName.trim(),
        encodedAt: now,
        neededDate: form.neededDate,
        startTime: form.startTime,
        endTime: form.endTime,
        venue: form.venue.trim(),
        notes: form.notes.trim(),
        status: 'Pending Review',
        assignedMemberIds: [],
        createdAt: now,
      }
      const { error } = await supabase.from('booking_requests').insert(requestToRow(req))
      if (error) throw error
      setSubmitted({ refId: id.slice(0, 8).toUpperCase(), email: form.requestorEmail.trim(), activity: form.activityType })
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f4c81 0%,#1a6fb5 60%,#2389d7 100%)' }}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-8 py-4 border-b border-white/10">
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

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center">
            {/* Success icon */}
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Successfully Submitted</p>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Booking Request Received</h2>
            <p className="text-slate-500 text-sm mb-6">Your request has been forwarded to the D&amp;AP team for review.</p>

            {/* Reference card */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Reference Number</p>
              <p className="font-mono font-black text-2xl text-blue-700 tracking-widest">{submitted.refId}</p>
              <p className="text-xs text-slate-400 mt-1">Save this for tracking your request</p>
            </div>

            <div className="text-left space-y-2 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-lg">{SERVICE_ICONS[submitted.activity]}</span>
                <span className="font-semibold">{submitted.activity}</span>
              </div>
              <p className="text-xs text-slate-500 pl-8">
                A confirmation and status updates will be sent to{' '}
                <span className="font-semibold text-slate-700">{submitted.email}</span>
              </p>
            </div>

            <button
              onClick={() => { setForm(EMPTY); setSubmitted(null) }}
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

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0f4c81 0%,#1a6fb5 60%,#2389d7 100%)' }}>

      {/* Portal header */}
      <div className="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
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
        <p className="hidden sm:block text-blue-200 text-xs">{today}</p>
      </div>

      {/* Hero text */}
      <div className="px-6 sm:px-10 py-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Book a Studio Service</h1>
        <p className="text-blue-200 text-sm max-w-md mx-auto">
          Fill in the form below to request a production service from the D&amp;AP team.
          You'll receive email updates on the status of your booking.
        </p>
      </div>

      {/* Service type selector — visual cards */}
      <div className="px-6 sm:px-10 pb-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-3">
            Select Service Type <span className="text-red-300">*</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ACTIVITY_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, activityType: type }))}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                  form.activityType === type
                    ? 'bg-white border-white text-blue-800 shadow-lg'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-xl">{SERVICE_ICONS[type]}</span>
                <span className="text-xs font-semibold leading-tight">{type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 px-6 sm:px-10 pb-10">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Card header stripe */}
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#0f4c81,#2389d7,#10b981)' }} />

          <form onSubmit={handleSubmit} className="p-7 space-y-5">

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
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {form.department === 'Other' && (
                  <input
                    type="text"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
                    placeholder="Enter your department name"
                    value={form.departmentOther}
                    onChange={field('departmentOther')}
                    required
                    autoFocus
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

            {/* Date encoded (read-only) + needed date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Date Encoded
                </label>
                <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-500 font-medium">
                  {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Date Needed <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.neededDate}
                  onChange={field('neededDate')}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Time: start - end */}
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

            {/* Summary strip */}
            {form.activityType && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <span className="text-2xl">{SERVICE_ICONS[form.activityType]}</span>
                <div>
                  <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Selected Service</p>
                  <p className="text-sm font-bold text-blue-800">{form.activityType}</p>
                </div>
              </div>
            )}

            {/* Availability note */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-base mt-0.5">ℹ️</span>
              <p className="text-xs text-amber-700 leading-relaxed">
                Team availability is reviewed by the D&amp;AP admin before assignment.
                You'll receive an email notification at each stage of your request.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ background: !isValid || submitting ? '#94a3b8' : 'linear-gradient(135deg,#0f4c81 0%,#2389d7 100%)' }}
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
                'Submit Booking Request →'
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              By submitting, your request will be reviewed by the D&amp;AP admin team.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-white/10">
        <p className="text-blue-300 text-xs">
          Digital &amp; Arts Production (DAP) · Booking &amp; Workload Management App · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
