import Dexie, { type Table } from 'dexie'
import type {
  JobOrder,
  CalendarEvent,
  Notification,
  StatusLog,
  SyncQueueItem,
  BookingRequest,
} from '../types'

export class DAPFlowDB extends Dexie {
  jobOrders!: Table<JobOrder>
  calendarEvents!: Table<CalendarEvent>
  notifications!: Table<Notification>
  statusLogs!: Table<StatusLog>
  syncQueue!: Table<SyncQueueItem>
  bookingRequests!: Table<BookingRequest>

  constructor() {
    super('DAPFlowDB')
    this.version(1).stores({
      jobOrders:
        'id, joNumber, status, activityType, requestingTeam, priority, deadline, createdAt, createdBy',
      calendarEvents: 'id, joId, activityType, startDate, endDate',
      notifications: 'id, targetUserId, read, createdAt',
      statusLogs: 'id, joId, changedAt',
      syncQueue: '++id, entityType, entityId, synced, timestamp',
    })
    this.version(2).stores({
      bookingRequests: 'id, status, activityType, createdAt',
    })
  }
}

export const db = new DAPFlowDB()
