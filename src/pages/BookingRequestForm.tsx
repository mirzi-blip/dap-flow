import { useState } from 'react'
import { Camera, Aperture, ArrowLeft } from 'lucide-react'
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

export function BookingRequestForm() {
  const [page, setPage] = useState<1 | 2>(1)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ refId: string; email: string; activity: string; approverName: string } | null>(null)

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

      // Notify approver by email
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
        }),
      }).catch(console.error)

      setSubmitted({
        refId: id.slice(0, 8).toUpperCase(),
        email: form.requestorEmail.trim(),
        activity: form.activityType,
        approverName: form.approverName.trim(),
      })
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
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-700">Next Step</p>
              <p className="text-xs text-amber-600 mt-0.5">
                An approval request has been sent to <span className="font-semibold">{submitted.approverName}</span>. Once approved, the DAP team will be notified to proceed.
              </p>
            </div>
            <div className="text-left space-y-2 mb-8">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-lg">{SERVICE_ICONS[submitted.activity]}</span>
                <span className="font-semibold">{submitted.activity}</span>
              </div>
              <p className="text-xs text-slate-500 pl-8">
                Status updates will be sent to <span className="font-semibold text-slate-700">{submitted.email}</span>
              </p>
            </div>
            <button
              onClick={() => { setForm(EMPTY); setSubmitted(null); setPage(1) }}
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

            {/* Approver */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Approver Name <span className="text-red-500">*</span>
                </label>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Approver Email <span className="text-red-500">*</span>
                </label>
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
