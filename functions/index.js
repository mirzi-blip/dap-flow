const functions = require('firebase-functions')
const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')
const cors = require('cors')({ origin: true })

// ── Env helpers ────────────────────────────────────────────────────────────────
// Firebase Functions env vars are set via:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD
//   firebase functions:secrets:set VITE_SUPABASE_URL
//   firebase functions:secrets:set VITE_SUPABASE_ANON_KEY
// They are then available as process.env.VAR_NAME in the function at runtime.

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )
}

const APP_URL = 'https://dap-app-c348e.web.app'

// ═══════════════════════════════════════════════════════════════════════════════
//  send-email helpers (copied from api/send-email.js)
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  Assigned: {
    subject: 'Booking Request Assigned',
    heading: 'Booking Request Assigned',
    headingColor: '#1d4ed8',
    body: 'Your booking request has been reviewed and is now <strong style="color:#1d4ed8">Assigned</strong>. A Job Order has been created and the D&AP team will reach out to you shortly.',
  },
  Approved: {
    subject: 'Booking Request Approved',
    heading: 'Booking Request Approved ✓',
    headingColor: '#059669',
    body: 'Great news! Your booking request has been <strong style="color:#059669">Approved</strong>. The D&AP team is now scheduling your activity and will be in touch with the details.',
  },
  Rejected: {
    subject: 'Booking Request Status Update',
    heading: 'Booking Request Update',
    headingColor: '#64748b',
    body: 'Thank you for your request. After careful review, we regret that we are unable to accommodate this request at this time. Please contact our team directly if you have any questions.',
  },
  Scheduled: {
    subject: 'Your Request Has Been Scheduled',
    heading: 'Request Scheduled 📅',
    headingColor: '#4f46e5',
    body: 'Great news! Your request has been <strong style="color:#4f46e5">Scheduled</strong>. The D&AP team will begin work on the date indicated.',
  },
  Completed: {
    subject: 'Your Request Has Been Completed',
    heading: 'Request Completed ✓',
    headingColor: '#059669',
    body: 'Your request has been <strong style="color:#059669">completed</strong> by the D&AP team. Please reach out if you need any revisions or have questions about the output.',
  },
  Delayed: {
    subject: 'Update on Your Request',
    heading: 'Request Delayed',
    headingColor: '#d97706',
    body: "We're writing to inform you that your request has encountered a delay. Our team will reach out to provide more details and a revised timeline.",
  },
  Cancelled: {
    subject: 'Your Request Has Been Cancelled',
    heading: 'Request Cancelled',
    headingColor: '#64748b',
    body: "Your request has been cancelled. Please contact our team directly if you believe this was in error or if you'd like to submit a new request.",
  },
}

const PRIORITY_COLOR = { High: '#dc2626', Medium: '#d97706', Low: '#16a34a' }

const STATUS_LABEL = {
  Pending:      { color: '#64748b', icon: '🕐' },
  Approved:     { color: '#1d4ed8', icon: '✅' },
  Scheduled:    { color: '#4f46e5', icon: '📅' },
  'For Review': { color: '#d97706', icon: '🔍' },
  Completed:    { color: '#059669', icon: '✓'  },
  Delayed:      { color: '#d97706', icon: '⚠️' },
  Cancelled:    { color: '#64748b', icon: '🚫' },
}

function buildJOTable(joNumber, project, activity, priority, deadline, status, headingColor) {
  const statusInfo = STATUS_LABEL[status] || { color: headingColor, icon: '' }
  return `<table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
    <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px">${project}</td></tr>
    <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activity}</td></tr>
    <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Priority</td><td style="padding:8px 12px;font-weight:700;color:${PRIORITY_COLOR[priority] || '#64748b'}">${priority}</td></tr>
    <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Deadline</td><td style="padding:8px 12px;font-weight:700;color:#dc2626">${deadline}</td></tr>
    ${status ? `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Status</td><td style="padding:8px 12px;font-weight:700;color:${statusInfo.color}">${statusInfo.icon} ${status}</td></tr>` : ''}
  </table>`
}

function buildJOEmailHtml(heading, headingColor, bodyHtml) {
  return `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
    <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
      <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
      <h2 style="color:#fff;margin:0;font-size:20px">${heading}</h2>
    </div>
    ${bodyHtml}
    <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
      — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
    </p>
  </div>`
}

const MEMBER_CONFIG = {
  assigned: {
    subject: 'You Have Been Assigned to a Job Order',
    heading: 'New Assignment 📋',
    headingColor: '#1d4ed8',
    intro: (name) => `Hi <strong>${name}</strong>,<br><br>You have been assigned to a Job Order. Please review the details below and coordinate with the team.`,
  },
  reassigned: {
    subject: 'Job Order Reassignment',
    heading: 'You Have Been Reassigned 🔄',
    headingColor: '#4f46e5',
    intro: (name) => `Hi <strong>${name}</strong>,<br><br>You have been reassigned to the following Job Order. Please take note of the updated details.`,
  },
  removed: {
    subject: 'Removed from Job Order',
    heading: 'Assignment Update',
    headingColor: '#64748b',
    intro: (name) => `Hi <strong>${name}</strong>,<br><br>You have been removed from the following Job Order. No further action is required on your part.`,
  },
  scheduled: {
    subject: 'Your Job Order Has Been Scheduled',
    heading: 'Job Order Scheduled 📅',
    headingColor: '#4f46e5',
    intro: (name) => `Hi <strong>${name}</strong>,<br><br>The following Job Order has been scheduled. Please make sure you are available on the indicated date.`,
  },
  status_update: {
    subject: 'Job Order Status Update',
    heading: 'Job Order Updated',
    headingColor: '#1d4ed8',
    intro: (name) => `Hi <strong>${name}</strong>,<br><br>The status of a Job Order you are assigned to has been updated. Please review the details below.`,
  },
}

function buildStatusHtml(config, preparedBy, refId, activityType, neededDate, status) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
        <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
        <h2 style="color:#fff;margin:0;font-size:20px">${config.heading}</h2>
      </div>
      <p>Hi <strong>${preparedBy}</strong>,</p>
      <p>${config.body}</p>
      <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Reference</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">#${refId}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Service Type</td><td style="padding:8px 12px">${activityType}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Date Needed</td><td style="padding:8px 12px">${neededDate}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Status</td><td style="padding:8px 12px;font-weight:700;color:${config.headingColor}">${status}</td></tr>
      </table>
      <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
        — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
      </p>
    </div>`
}

function buildApprovalHtml(approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId) {
  const approveUrl = `${APP_URL}/api/approve?id=${fullId}&action=approve`
  const rejectUrl  = `${APP_URL}/api/approve?id=${fullId}&action=reject`
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
        <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
        <h2 style="color:#fff;margin:0;font-size:20px">Booking Approval Required</h2>
      </div>
      <p>Hi <strong>${approverName}</strong>,</p>
      <p><strong>${preparedBy}</strong> has submitted a studio booking request that requires your approval before it proceeds to the DAP team.</p>
      <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Reference</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">#${refId}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Service Type</td><td style="padding:8px 12px">${activityType}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Project</td><td style="padding:8px 12px">${projectName || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Department</td><td style="padding:8px 12px">${department}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Start Date</td><td style="padding:8px 12px">${neededDate}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">End Date</td><td style="padding:8px 12px">${endDate || neededDate}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Venue</td><td style="padding:8px 12px">${venue}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Prepared By</td><td style="padding:8px 12px">${preparedBy}</td></tr>
      </table>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0;font-weight:700;color:#854d0e;font-size:14px">⚠ Action Required</p>
        <p style="margin:8px 0 0;color:#713f12;font-size:13px">Please review the details above and click one of the buttons below to approve or decline this booking request.</p>
      </div>
      <div style="display:flex;gap:12px;margin:20px 0">
        <a href="${approveUrl}" style="flex:1;display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:8px;text-align:center">✓ Approve Request</a>
        <a href="${rejectUrl}" style="flex:1;display:inline-block;background:#f1f5f9;color:#64748b;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:8px;text-align:center;border:1px solid #e2e8f0">✗ Decline Request</a>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:12px 0">You can also manage this request by logging into the DAP Flow app under <strong>Job Orders → Requests</strong>.</p>
      <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
        — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
      </p>
    </div>`
}

// ═══════════════════════════════════════════════════════════════════════════════
//  review-action helpers (copied from api/review-action.js)
// ═══════════════════════════════════════════════════════════════════════════════

function reviewPage(title, icon, color, heading, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — DAP Flow</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 480px; width: 100%; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f4c81, #2389d7); padding: 24px 28px; }
    .header p { color: #bfdbfe; font-size: 11px; font-weight: 700; letter-spacing: .1em; margin-bottom: 4px; }
    .header h1 { color: #fff; font-size: 18px; font-weight: 800; }
    .body { padding: 28px; }
    .icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; background: ${color}18; }
    h2 { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    p { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 12px; }
    .meta { background: #f8fafc; border-radius: 10px; padding: 14px 16px; margin: 16px 0; font-size: 13px; color: #334155; }
    .meta strong { color: #0f172a; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0f4c81, #2389d7); color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; margin-top: 8px; }
    .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p>DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
      <h1>DAP Flow — Review Action</h1>
    </div>
    <div class="body">
      <div class="icon" style="background:${color}18">${icon}</div>
      <h2>${heading}</h2>
      ${body}
      <a href="${APP_URL}" class="btn">Open DAP Flow App →</a>
      <p class="footer">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
    </div>
  </div>
</body>
</html>`
}

function successPage(action, projectName, joNumber, isResolved) {
  const isApprove = action === 'approve'
  const icon = isApprove ? '✅' : '↩️'
  const color = isApprove ? '#059669' : '#dc2626'
  const heading = isApprove ? 'Approval Recorded' : 'Revision Requested'
  const resolvedNote = isResolved
    ? isApprove
      ? '<p style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;color:#065f46;font-weight:600">🎉 Both approvers have approved — the Job Order has been moved to <strong>Completed</strong>.</p>'
      : '<p style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px;color:#991b1b;font-weight:600">The Job Order has been moved to <strong>Needs Revision</strong>. The DAP team will be notified.</p>'
    : '<p>Your response has been saved. The other approver still needs to act on this review.</p>'
  const body = `
    <div class="meta"><strong>Project:</strong> ${projectName}<br><strong>JO Number:</strong> ${joNumber}</div>
    ${resolvedNote}
    <p>You can view the full review status by logging into the DAP Flow app.</p>`
  return reviewPage(heading, icon, color, heading, body)
}

function alreadyActedPage(status, projectName, joNumber) {
  const isApproved = status === 'approved'
  const body = `
    <div class="meta"><strong>Project:</strong> ${projectName}<br><strong>JO Number:</strong> ${joNumber}</div>
    <p>This review has already been <strong>${isApproved ? 'approved' : 'actioned'}</strong>. No further action is needed from this link.</p>
    <p>You can view the current status in the DAP Flow app.</p>`
  return reviewPage('Already Actioned', '🔒', '#64748b', 'Already Actioned', body)
}

function errorPage(message) {
  const body = `<p>${message}</p><p>If you believe this is an error, please contact the DAP team directly.</p>`
  return reviewPage('Error', '⚠️', '#d97706', 'Something went wrong', body)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Cloud Function: sendEmail  (replaces api/send-email.js)
// ═══════════════════════════════════════════════════════════════════════════════

exports.sendEmail = functions
  .runWith({ secrets: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'] })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(200).json({ status: 'DAP email function is running ✓' })
      }

      const body = req.body || {}
      const transporter = getTransporter()

      // ── Approval request email to manager ──────────────────────────────────
      if (body.approvalRequest) {
        const { approverEmail, approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId } = body
        if (!approverEmail) return res.status(200).json({ ok: true })
        try {
          await transporter.sendMail({
            from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
            replyTo: 'no-reply@dap-flow.noreply',
            to: approverEmail,
            subject: `[DAP] Approval Required: ${activityType} from ${preparedBy} — #${refId}`,
            html: buildApprovalHtml(approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId),
          })
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Approval email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send approval email' })
        }
      }

      // ── Member notification ─────────────────────────────────────────────────
      if (body.memberNotification) {
        const { mode, memberEmail, memberName, joNumber, projectName, activityType, priority, deadline, status } = body
        const mc = MEMBER_CONFIG[mode]
        if (!mc || !memberEmail) return res.status(200).json({ ok: true })
        try {
          const tableHtml = buildJOTable(joNumber, projectName, activityType, priority || 'N/A', deadline, status || '', mc.headingColor)
          const bodyHtml = `<p style="margin:0 0 16px">${mc.intro(memberName)}</p>${tableHtml}`
          await transporter.sendMail({
            from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
            replyTo: 'no-reply@dap-flow.noreply',
            to: memberEmail,
            subject: `[DAP] ${mc.subject} — ${joNumber}`,
            html: buildJOEmailHtml(mc.heading, mc.headingColor, bodyHtml),
          })
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Member email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send email' })
        }
      }

      // ── Completion notification to requestor ───────────────────────────────
      if (body.completionNotification) {
        const { requestorEmail, preparedBy, joNumber, projectName, activityType, priority, deadline, completedBy, completedAt, remarks, refId } = body
        if (!requestorEmail) return res.status(200).json({ ok: true })
        const completionDateStr = completedAt
          ? new Date(completedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
          : 'N/A'
        const priorityColor = PRIORITY_COLOR[priority] || '#64748b'
        const remarksRow = remarks
          ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;vertical-align:top">Remarks</td><td style="padding:8px 12px;color:#475569;line-height:1.5">${remarks}</td></tr>`
          : ''
        const refRow = refId
          ? `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Booking Ref</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">#${refId}</td></tr>`
          : ''
        const completionHtml = `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
            <div style="background:linear-gradient(135deg,#065f46,#059669);padding:20px 24px;border-radius:8px;margin-bottom:24px">
              <p style="color:#a7f3d0;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
              <h2 style="color:#fff;margin:0;font-size:20px">Job Order Completed ✓</h2>
            </div>
            <p style="margin:0 0 8px">Hi <strong>${preparedBy || 'Requestor'}</strong>,</p>
            <p style="margin:0 0 20px;color:#475569">We are pleased to inform you that your Job Order has been successfully <strong style="color:#059669">completed</strong> by the D&amp;AP team.</p>
            <table style="margin:0 0 24px;border-collapse:collapse;width:100%;font-size:14px">
              ${refRow}
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
              <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px;font-weight:600">${projectName}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activityType}</td></tr>
              <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Priority</td><td style="padding:8px 12px;font-weight:700;color:${priorityColor}">${priority}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Deadline</td><td style="padding:8px 12px">${deadline}</td></tr>
              <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Completed By</td><td style="padding:8px 12px;font-weight:700;color:#059669">${completedBy}</td></tr>
              <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Completed On</td><td style="padding:8px 12px;font-weight:600">${completionDateStr}</td></tr>
              ${remarksRow}
            </table>
            <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
          </div>`
        try {
          await transporter.sendMail({
            from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
            replyTo: 'no-reply@dap-flow.noreply',
            to: requestorEmail,
            subject: `[DAP] Job Order Completed — ${joNumber}`,
            html: completionHtml,
          })
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Completion email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send completion email' })
        }
      }

      // ── Output-for-review notification to approver ─────────────────────────
      if (body.reviewNotification) {
        const { approverEmail, approverName, approverRole, submittedBy, joNumber, projectName, activityType, comment, attachmentUrl, attachmentName, reviewId, slot } = body
        if (!approverEmail) return res.status(200).json({ ok: true })
        const attachmentRow = attachmentUrl
          ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Output File</td><td style="padding:8px 12px"><a href="${attachmentUrl}" style="color:#1d4ed8;font-weight:700">${attachmentName || 'View Attachment'}</a></td></tr>`
          : ''
        const roleRow = approverRole
          ? `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Your Role</td><td style="padding:8px 12px;font-weight:700;color:#4f46e5">${approverRole}</td></tr>`
          : ''
        const commentBlock = comment
          ? `<div style="background:#f8fafc;border-left:3px solid #6366f1;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#374151;font-style:italic">"${comment}"</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">— ${submittedBy || 'Submitter'}</p></div>`
          : ''
        const actionSection = reviewId && slot
          ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
              <p style="margin:0;font-weight:700;color:#854d0e;font-size:14px">📋 Action Required</p>
              <p style="margin:8px 0 0;color:#713f12;font-size:13px">Use the buttons below to respond directly from your email, or open the DAP Flow app to review with additional context.</p>
            </div>
            <div style="display:flex;gap:12px;margin:16px 0">
              <a href="${APP_URL}/api/review-action?reviewId=${reviewId}&slot=${slot}&action=approve" style="flex:1;display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:8px;text-align:center">✓ Approve</a>
              <a href="${APP_URL}/api/review-action?reviewId=${reviewId}&slot=${slot}&action=disapprove" style="flex:1;display:inline-block;background:#f1f5f9;color:#64748b;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:8px;text-align:center;border:1px solid #e2e8f0">↩ Request Revision</a>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin:4px 0 16px">Clicking "Request Revision" will use a default comment. Log in to DAP Flow to provide specific feedback.</p>`
          : `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
              <p style="margin:0;font-weight:700;color:#854d0e;font-size:14px">📋 Action Required</p>
              <p style="margin:8px 0 0;color:#713f12;font-size:13px">Log in to DAP Flow, open the Job Order, and go to the <strong>Review Status</strong> tab to Approve or Request Revision.</p>
            </div>`
        const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
            <h2 style="color:#fff;margin:0;font-size:20px">Output Submitted for Review 🔍</h2>
          </div>
          <p>Hi <strong>${approverName || 'Approver'}</strong>,</p>
          <p style="color:#475569"><strong>${submittedBy}</strong> has submitted their output for your review.</p>
          <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px;font-weight:600">${projectName}</td></tr>
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activityType}</td></tr>
            ${roleRow}${attachmentRow}
          </table>
          ${commentBlock}${actionSection}
          <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0">Open DAP Flow App →</a>
          <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
        </div>`
        try {
          await transporter.sendMail({
            from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
            replyTo: 'no-reply@dap-flow.noreply',
            to: approverEmail,
            subject: `[DAP] Output for Review: ${projectName} — ${joNumber}`,
            html,
          })
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Review notification email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send review notification email' })
        }
      }

      // ── Review approved — notify assigned members ──────────────────────────
      if (body.reviewApprovedNotification) {
        const { recipientEmails, joNumber, projectName, activityType, approverName, approverComment, outputFileUrl } = body
        if (!recipientEmails || !recipientEmails.length) return res.status(200).json({ ok: true })
        const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <div style="background:linear-gradient(135deg,#065f46,#059669);padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <p style="color:#a7f3d0;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
            <h2 style="color:#fff;margin:0;font-size:20px">Job Order Approved — Ready to Complete ✓</h2>
          </div>
          <p>Both approvers have reviewed and <strong style="color:#059669">approved</strong> the output for this Job Order.</p>
          <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px;font-weight:600">${projectName}</td></tr>
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activityType}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Approver</td><td style="padding:8px 12px">${approverName || '—'}</td></tr>
            ${outputFileUrl ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Output</td><td style="padding:8px 12px"><a href="${outputFileUrl}" style="color:#1d4ed8;font-weight:700">View Output File</a></td></tr>` : ''}
          </table>
          ${approverComment ? `<div style="background:#ecfdf5;border-left:3px solid #10b981;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#374151;font-style:italic">"${approverComment}"</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">— ${approverName || 'Approver'}</p></div>` : ''}
          <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
        </div>`
        try {
          for (const email of recipientEmails) {
            await transporter.sendMail({ from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`, replyTo: 'no-reply@dap-flow.noreply', to: email, subject: `[DAP] Output Approved — ${joNumber}`, html })
          }
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Review approved email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send approval notification' })
        }
      }

      // ── Review disapproved — notify assigned members ───────────────────────
      if (body.reviewDisapprovedNotification) {
        const { recipientEmails, joNumber, projectName, activityType, approverName, approverComment } = body
        if (!recipientEmails || !recipientEmails.length) return res.status(200).json({ ok: true })
        const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <div style="background:linear-gradient(135deg,#991b1b,#dc2626);padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <p style="color:#fecaca;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
            <h2 style="color:#fff;margin:0;font-size:20px">Revision Requested ↩</h2>
          </div>
          <p>An approver has reviewed the output and is requesting revisions for this Job Order.</p>
          <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px;font-weight:600">${projectName}</td></tr>
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activityType}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Reviewed By</td><td style="padding:8px 12px">${approverName || '—'}</td></tr>
          </table>
          ${approverComment ? `<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0"><p style="margin:0;font-weight:600;font-size:12px;color:#991b1b">Revision Notes:</p><p style="margin:6px 0 0;font-size:13px;color:#374151;font-style:italic">"${approverComment}"</p><p style="margin:6px 0 0;font-size:11px;color:#94a3b8">— ${approverName || 'Approver'}</p></div>` : ''}
          <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0">Open DAP Flow App →</a>
          <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
        </div>`
        try {
          for (const email of recipientEmails) {
            await transporter.sendMail({ from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`, replyTo: 'no-reply@dap-flow.noreply', to: email, subject: `[DAP] Revision Requested — ${joNumber}`, html })
          }
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('Review disapproved email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send disapproval notification' })
        }
      }

      // ── JO notification to requestor ────────────────────────────────────────
      if (body.joNotification) {
        const { requestorEmail, preparedBy, joNumber, projectName, activityType, priority, deadline, status, refId } = body
        if (!requestorEmail || !status) return res.status(200).json({ ok: true })
        const statusInfo = STATUS_LABEL[status] || { color: '#64748b', icon: '' }
        try {
          const tableHtml = buildJOTable(joNumber, projectName, activityType, priority || 'N/A', deadline, status, statusInfo.color)
          const refLine = refId ? `<p style="font-size:13px;color:#64748b;margin-top:8px">Booking Reference: <strong style="font-family:monospace;color:#1d4ed8">#${refId}</strong></p>` : ''
          const bodyHtml = `<p style="margin:0 0 8px">Hi <strong>${preparedBy}</strong>,</p><p style="margin:0 0 16px;color:#475569">The Job Order linked to your booking request has been updated.</p>${tableHtml}${refLine}`
          await transporter.sendMail({
            from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
            replyTo: 'no-reply@dap-flow.noreply',
            to: requestorEmail,
            subject: `[DAP] Job Order Update — ${joNumber}`,
            html: buildJOEmailHtml(`Job Order Updated ${statusInfo.icon}`, statusInfo.color, bodyHtml),
          })
          return res.status(200).json({ ok: true })
        } catch (err) {
          console.error('JO notification email error:', err?.message || err)
          return res.status(500).json({ error: err?.message || 'Failed to send email' })
        }
      }

      // ── Direct call from app for JO / booking status changes ────────────────
      let to, preparedBy, refId, activityType, neededDate, status, config

      if (body.direct) {
        const { requestorEmail, preparedBy: pb, activityType: at, neededDate: nd, status: st, id } = body
        if (!requestorEmail || !st) return res.status(200).json({ ok: true })
        config = STATUS_CONFIG[st]
        if (!config) return res.status(200).json({ ok: true })
        to = requestorEmail
        preparedBy = pb || 'Requestor'
        refId = (id || '').slice(0, 8).toUpperCase()
        activityType = at || 'N/A'
        neededDate = nd || 'N/A'
        status = st
      } else {
        // Supabase webhook
        const { type, record, old_record } = body
        if (type !== 'UPDATE') return res.status(200).json({ ok: true })
        if (!record || record.status === old_record?.status) return res.status(200).json({ ok: true })
        config = STATUS_CONFIG[record.status]
        if (!config) return res.status(200).json({ ok: true })
        to = record.requestor_email
        preparedBy = record.prepared_by
        refId = (record.id || '').slice(0, 8).toUpperCase()
        activityType = record.activity_type
        neededDate = record.needed_date
        status = record.status
      }

      try {
        await transporter.sendMail({
          from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
          replyTo: 'no-reply@dap-flow.noreply',
          to,
          subject: `[DAP] ${config.subject} — #${refId}`,
          html: buildStatusHtml(config, preparedBy, refId, activityType, neededDate, status),
        })
        return res.status(200).json({ ok: true })
      } catch (err) {
        console.error('Email error:', err?.message || err)
        return res.status(500).json({ error: err?.message || 'Failed to send email' })
      }
    })
  })

// ═══════════════════════════════════════════════════════════════════════════════
//  Cloud Function: reviewAction  (replaces api/review-action.js)
// ═══════════════════════════════════════════════════════════════════════════════

exports.reviewAction = functions
  .runWith({ secrets: ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] })
  .https.onRequest(async (req, res) => {
    res.setHeader('Content-Type', 'text/html')

    const { reviewId, slot, action } = req.query

    if (!reviewId || !['req', 'dap'].includes(slot) || !['approve', 'disapprove'].includes(action)) {
      return res.status(400).send(errorPage('Invalid or missing link parameters. This link may be malformed or expired.'))
    }

    const supabase = getSupabase()
    const transporter = getTransporter()

    const { data: review, error } = await supabase
      .from('jo_reviews')
      .select('*')
      .eq('id', reviewId)
      .maybeSingle()

    if (error || !review) {
      return res.status(404).send(errorPage('Review record not found. This link may have expired or already been processed.'))
    }

    const currentStatus = slot === 'req' ? review.req_approver_status : review.dap_approver_status
    if (currentStatus !== 'pending') {
      return res.status(200).send(alreadyActedPage(currentStatus, review.project_name, review.jo_number))
    }

    if (review.overall_status !== 'pending') {
      return res.status(200).send(alreadyActedPage(review.overall_status, review.project_name, review.jo_number))
    }

    const now = new Date().toISOString()
    const isApprove = action === 'approve'
    const defaultComment = isApprove
      ? 'Approved via email.'
      : 'Revision requested via email. Log in to DAP Flow to add specific feedback.'

    const updates = { updated_at: now }
    if (slot === 'req') {
      updates.req_approver_status = isApprove ? 'approved' : 'disapproved'
      updates.req_approver_comment = defaultComment
      updates.req_approver_action_at = now
    } else {
      updates.dap_approver_status = isApprove ? 'approved' : 'disapproved'
      updates.dap_approver_comment = defaultComment
      updates.dap_approver_action_at = now
    }

    const newReqStatus = slot === 'req' ? updates.req_approver_status : review.req_approver_status
    const newDapStatus = slot === 'dap' ? updates.dap_approver_status : review.dap_approver_status

    let newOverallStatus = null
    if (!isApprove) {
      updates.overall_status = 'needs_revision'
      newOverallStatus = 'needs_revision'
    } else if (newReqStatus === 'approved' && newDapStatus === 'approved') {
      updates.overall_status = 'approved'
      newOverallStatus = 'approved'
    }

    const { error: updateError } = await supabase.from('jo_reviews').update(updates).eq('id', reviewId)

    if (updateError) {
      console.error('review-action update error:', updateError.message)
      return res.status(500).send(errorPage('Failed to save your response. Please try again or contact the DAP team.'))
    }

    const isResolved = newOverallStatus !== null
    const actorName = slot === 'req' ? review.req_approver_name : review.dap_approver_name

    if (!isResolved) {
      const otherEmail = slot === 'req' ? review.dap_approver_email : review.req_approver_email
      const otherName  = slot === 'req' ? review.dap_approver_name  : review.req_approver_name
      if (otherEmail) {
        const actionLabel = isApprove ? 'approved' : 'requested revision on'
        transporter.sendMail({
          from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
          replyTo: 'no-reply@dap-flow.noreply',
          to: otherEmail,
          subject: `[DAP] Review Update: ${review.project_name} — ${review.jo_number}`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
            <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
              <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
              <h2 style="color:#fff;margin:0;font-size:18px">Review Update</h2>
            </div>
            <p>Hi <strong>${otherName || 'Approver'}</strong>,</p>
            <p style="color:#475569"><strong>${actorName}</strong> has <strong>${actionLabel}</strong> the output for <strong>${review.project_name}</strong> (${review.jo_number}).</p>
            <p style="color:#475569">Your review is still pending. Please use the buttons below or log in to DAP Flow to complete your review.</p>
            <div style="margin:24px 0;display:flex;gap:12px">
              <a href="${APP_URL}/api/review-action?reviewId=${reviewId}&slot=${slot === 'req' ? 'dap' : 'req'}&action=approve" style="flex:1;display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:8px;text-align:center">✓ Approve</a>
              <a href="${APP_URL}/api/review-action?reviewId=${reviewId}&slot=${slot === 'req' ? 'dap' : 'req'}&action=disapprove" style="flex:1;display:inline-block;background:#f1f5f9;color:#64748b;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:8px;text-align:center;border:1px solid #e2e8f0">↩ Request Revision</a>
            </div>
            <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team</p>
          </div>`,
        }).catch(console.error)
      }
    }

    if (isResolved) {
      const outcomeColor = newOverallStatus === 'approved' ? '#059669' : '#dc2626'
      const outcomeEmoji = newOverallStatus === 'approved' ? '✅' : '↩️'
      const outcome = newOverallStatus === 'approved' ? 'approved' : 'needs revision'
      const notifyEmails = [review.req_approver_email, review.dap_approver_email].filter(Boolean)
      const outcomeHtml = `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
        <div style="background:linear-gradient(135deg,${newOverallStatus === 'approved' ? '#065f46,#059669' : '#991b1b,#dc2626'});padding:20px 24px;border-radius:8px;margin-bottom:24px">
          <p style="color:${newOverallStatus === 'approved' ? '#a7f3d0' : '#fecaca'};font-size:11px;font-weight:700;letter-spacing:.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
          <h2 style="color:#fff;margin:0;font-size:18px">${outcomeEmoji} Review ${newOverallStatus === 'approved' ? 'Approved' : 'Needs Revision'}</h2>
        </div>
        <p>The review for <strong>${review.project_name}</strong> (${review.jo_number}) has been <strong style="color:${outcomeColor}">${outcome}</strong> by all approvers.</p>
        <p style="color:#475569">The Job Order status will be updated the next time the DAP team opens it in the app.</p>
        <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin-top:8px">Open DAP Flow App →</a>
        <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team</p>
      </div>`
      for (const email of notifyEmails) {
        transporter.sendMail({
          from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
          replyTo: 'no-reply@dap-flow.noreply',
          to: email,
          subject: `[DAP] Review ${newOverallStatus === 'approved' ? 'Approved' : 'Needs Revision'} — ${review.jo_number}`,
          html: outcomeHtml,
        }).catch(console.error)
      }
    }

    return res.status(200).send(successPage(action, review.project_name, review.jo_number, isResolved))
  })
