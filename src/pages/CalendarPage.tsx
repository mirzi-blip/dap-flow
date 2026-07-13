import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, parseISO, getDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin, Users, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useDataStore, useAppStore } from '../store/useAppStore'
import { usePermissions } from '../hooks/usePermissions'
import { activityCalendarColors } from '../utils/colors'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ActivityBadge, StatusBadge } from '../components/ui/Badge'
import { formatDateTime, generateId } from '../utils/helpers'
import type { ActivityType, CalendarEvent } from '../types'
import { db } from '../db/database'

const ACTIVITY_TYPES: ActivityType[] = [
  'Photo Shoot', 'Video Shoot', 'Static Artwork Design',
  'Video Editing', 'Audio Recording', 'Audio Editing',
]

type ViewMode = 'month' | 'week'
type FilterTeam = 'All' | 'Photo' | 'Video' | 'Audio' | 'Design'

function EventChip({ event }: { event: CalendarEvent }) {
  const color = activityCalendarColors[event.activityType]
  return (
    <div
      className="text-white text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: color }}
      title={event.title}
    >
      {event.title}
    </div>
  )
}

export function CalendarPage() {
  const { calendarEvents, jobOrders, addCalendarEvent } = useDataStore()
  const { currentUser, resources } = useAppStore()
  const { can } = usePermissions()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [filterTeam, setFilterTeam] = useState<FilterTeam>('All')
  const [filterMember, setFilterMember] = useState<string>('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Filter events
  const filteredEvents = useMemo(() => {
    let events = calendarEvents
    if (filterMember) {
      events = events.filter((e) => e.assignedMemberIds.includes(filterMember))
    } else if (filterTeam !== 'All') {
      const teamResources = resources.filter((r) => r.team === filterTeam).map((r) => r.id)
      events = events.filter((e) => e.assignedMemberIds.some((id) => teamResources.includes(id)))
    }
    return events
  }, [calendarEvents, filterTeam, filterMember, resources])

  function eventsOnDay(date: Date) {
    return filteredEvents.filter((e) => isSameDay(parseISO(e.startDate), date))
  }

  // Month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    const days: Date[] = []
    let d = start
    while (d <= end) {
      days.push(d)
      d = addDays(d, 1)
    }
    return days
  }, [currentDate])

  // Week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  function navigate(dir: 1 | -1) {
    if (viewMode === 'month') {
      setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    } else {
      setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    }
  }

  function navigateYear(dir: 1 | -1) {
    const d = new Date(currentDate)
    d.setFullYear(d.getFullYear() + dir)
    setCurrentDate(d)
  }

  const currentYear = currentDate.getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 4 + i)

  const canCreate = can('calendar', 'create')

  // New booking form state
  const [newBooking, setNewBooking] = useState({
    joId: '',
    title: '',
    activityType: 'Photo Shoot' as ActivityType,
    startDate: '',
    endDate: '',
    location: '',
    notes: '',
    assignedMemberIds: [] as string[],
  })

  async function handleCreateBooking() {
    const ev: CalendarEvent = {
      id: generateId(),
      ...newBooking,
      createdAt: new Date().toISOString(),
    }
    await db.calendarEvents.add(ev)
    addCalendarEvent(ev)
    setShowNewBooking(false)
    setNewBooking({
      joId: '', title: '', activityType: 'Photo Shoot',
      startDate: '', endDate: '', location: '', notes: '', assignedMemberIds: [],
    })
  }

  const approvedJOs = jobOrders.filter((j) => ['Approved', 'Scheduled', 'In Progress'].includes(j.status))

  const selectedEventJO = selectedEvent
    ? jobOrders.find((j) => j.id === selectedEvent.joId)
    : null

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-2xl px-5 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {/* Year navigation */}
          <button onClick={() => navigateYear(-1)} title="Previous year" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <ChevronsLeft size={16} />
          </button>
          {/* Month navigation */}
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 min-w-[200px] justify-center">
            {viewMode === 'month' ? (
              <>
                <select
                  value={currentDate.getMonth()}
                  onChange={e => { const d = new Date(currentDate); d.setMonth(Number(e.target.value)); setCurrentDate(d) }}
                  className="font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none cursor-pointer text-sm"
                >
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
                <select
                  value={currentYear}
                  onChange={e => { const d = new Date(currentDate); d.setFullYear(Number(e.target.value)); setCurrentDate(d) }}
                  className="font-bold text-brand-600 dark:text-brand-400 bg-transparent border-none outline-none cursor-pointer text-sm"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}
              </span>
            )}
          </div>

          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => navigateYear(1)} title="Next year" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            <ChevronsRight size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs text-brand-600 dark:text-brand-400 font-semibold px-2.5 py-1 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors border border-brand-200 dark:border-brand-800"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Team filter */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            {(['All', 'Photo', 'Video', 'Audio', 'Design'] as FilterTeam[]).map((t) => (
              <button key={t} onClick={() => { setFilterTeam(t); setFilterMember('') }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterTeam === t && !filterMember ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Member filter */}
          <div className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 rounded-xl px-2 py-1">
            <Users size={12} className="text-brand-500 dark:text-brand-400 shrink-0" />
            <select
              value={filterMember}
              onChange={(e) => { setFilterMember(e.target.value); if (e.target.value) setFilterTeam('All') }}
              className="text-xs font-semibold bg-transparent text-brand-700 dark:text-brand-300 border-none outline-none cursor-pointer"
            >
              <option value="">All Members</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            {(['month', 'week'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${viewMode === v ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {v}
              </button>
            ))}
          </div>

          {canCreate && (
            <Button size="sm" onClick={() => setShowNewBooking(true)}>
              <Plus size={14} /> New Booking
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {ACTIVITY_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: activityCalendarColors[type] }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{type}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {viewMode === 'month' ? (
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              const dayEvents = eventsOnDay(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, currentDate)
              return (
                <div
                  key={i}
                  className={`min-h-[110px] border-b border-r border-slate-100 dark:border-slate-700 p-2 last:border-r-0 ${
                    !isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                  } ${isToday ? 'bg-brand-50/40 dark:bg-brand-900/20' : ''} ${canCreate ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors' : ''}`}
                  onClick={() => {
                    if (canCreate) {
                      setSelectedDay(day)
                      setNewBooking((b) => ({
                        ...b,
                        startDate: `${format(day, 'yyyy-MM-dd')}T09:00`,
                        endDate: `${format(day, 'yyyy-MM-dd')}T17:00`,
                      }))
                      setShowNewBooking(true)
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                        isToday
                          ? 'bg-brand-600 text-white'
                          : isCurrentMonth
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEvent(ev)
                        }}
                      >
                        <EventChip event={ev} />
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Week view */
          <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-700">
            {weekDays.map((day) => {
              const dayEvents = eventsOnDay(day)
              const isToday = isSameDay(day, new Date())
              return (
                <div key={day.toISOString()} className="min-h-[400px] p-3">
                  <div className="text-center mb-3">
                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      {format(day, 'EEE')}
                    </p>
                    <span
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold mx-auto mt-1 ${
                        isToday ? 'bg-brand-600 text-white' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.map((ev) => {
                      const color = activityCalendarColors[ev.activityType]
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="rounded-lg p-2 cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ background: color + '20', borderLeft: `3px solid ${color}` }}
                        >
                          <p className="text-xs font-semibold truncate" style={{ color }}>
                            {ev.title}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {format(parseISO(ev.startDate), 'h:mm a')} – {format(parseISO(ev.endDate), 'h:mm a')}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Booking Details"
        maxWidth="max-w-lg"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedEvent.title}</h3>
              <ActivityBadge type={selectedEvent.activityType} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">Start</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{formatDateTime(selectedEvent.startDate)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">End</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{formatDateTime(selectedEvent.endDate)}</p>
              </div>
            </div>

            {selectedEvent.location && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <MapPin size={15} className="text-slate-400 dark:text-slate-500" />
                {selectedEvent.location}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-2 flex items-center gap-1">
                <Users size={12} /> Assigned Team
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedEvent.assignedMemberIds.map((id) => {
                  const r = resources.find((r) => r.id === id)
                  return r ? (
                    <div key={id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
                      <span className={`w-6 h-6 rounded-full ${r.color} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {r.initials}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.role}</p>
                      </div>
                    </div>
                  ) : null
                })}
              </div>
            </div>

            {selectedEventJO && (
              <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-3 border border-brand-100 dark:border-brand-800">
                <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mb-1">Linked Job Order</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedEventJO.joNumber} · {selectedEventJO.projectName}</p>
                <StatusBadge status={selectedEventJO.status} />
              </div>
            )}

            {selectedEvent.notes && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-1">Notes</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{selectedEvent.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Booking Modal */}
      <Modal
        open={showNewBooking}
        onClose={() => setShowNewBooking(false)}
        title="New Booking"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Title *</label>
            <input
              className="form-input"
              value={newBooking.title}
              onChange={(e) => setNewBooking((b) => ({ ...b, title: e.target.value }))}
              placeholder="e.g. Summer Campaign Photo Shoot"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Activity Type *</label>
              <select
                className="form-input"
                value={newBooking.activityType}
                onChange={(e) => setNewBooking((b) => ({ ...b, activityType: e.target.value as ActivityType }))}
              >
                {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Linked JO</label>
              <select
                className="form-input"
                value={newBooking.joId}
                onChange={(e) => setNewBooking((b) => ({ ...b, joId: e.target.value }))}
              >
                <option value="">— None —</option>
                {approvedJOs.map((j) => (
                  <option key={j.id} value={j.id}>{j.joNumber} · {j.projectName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Start *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={newBooking.startDate}
                onChange={(e) => setNewBooking((b) => ({ ...b, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">End *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={newBooking.endDate}
                onChange={(e) => setNewBooking((b) => ({ ...b, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Location</label>
            <input
              className="form-input"
              value={newBooking.location}
              onChange={(e) => setNewBooking((b) => ({ ...b, location: e.target.value }))}
              placeholder="e.g. Studio B, BGC Rooftop"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Assign Team Members</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {resources.map((r) => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                  <input
                    type="checkbox"
                    checked={newBooking.assignedMemberIds.includes(r.id)}
                    onChange={(e) =>
                      setNewBooking((b) => ({
                        ...b,
                        assignedMemberIds: e.target.checked
                          ? [...b.assignedMemberIds, r.id]
                          : b.assignedMemberIds.filter((id) => id !== r.id),
                      }))
                    }
                    className="rounded"
                  />
                  <span className={`w-6 h-6 rounded-full ${r.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {r.initials}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Notes</label>
            <textarea
              rows={2}
              className="form-input resize-none"
              value={newBooking.notes}
              onChange={(e) => setNewBooking((b) => ({ ...b, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreateBooking}
              disabled={!newBooking.title || !newBooking.startDate || !newBooking.endDate}
              className="flex-1"
            >
              Create Booking
            </Button>
            <Button variant="secondary" onClick={() => setShowNewBooking(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

