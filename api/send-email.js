const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const STATUS_CONFIG = {
  Assigned: {
    subject: 'Booking Request Assigned',
    heading: 'Booking Request Assigned',
    headingColor: '#1d4ed8',
    body: 'Your booking request has been reviewed and is now <strong style="color:#1d4ed8">Assigned</strong>. A Job Order has been created and the D&amp;AP team will reach out to you shortly.',
  },
  Approved: {
    subject: 'Booking Request Approved',
    heading: 'Booking Request Approved ✓',
    headingColor: '#059669',
    body: 'Great news! Your booking request has been <strong style="color:#059669">Approved</strong>. The D&amp;AP team is now scheduling your activity and will be in touch with the details.',
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
    body: 'Great news! Your request has been <strong style="color:#4f46e5">Scheduled</strong>. The D&amp;AP team will begin work on the date indicated.',
  },
  Completed: {
    subject: 'Your Request Has Been Completed',
    heading: 'Request Completed ✓',
    headingColor: '#059669',
    body: 'Your request has been <strong style="color:#059669">completed</strong> by the D&amp;AP team. Please reach out if you need any revisions or have questions about the output.',
  },
  Delayed: {
    subject: 'Update on Your Request',
    heading: 'Request Delayed',
    headingColor: '#d97706',
    body: 'We\'re writing to inform you that your request has encountered a delay. Our team will reach out to provide more details and a revised timeline.',
  },
  Cancelled: {
    subject: 'Your Request Has Been Cancelled',
    heading: 'Request Cancelled',
    headingColor: '#64748b',
    body: 'Your request has been cancelled. Please contact our team directly if you believe this was in error or if you\'d like to submit a new request.',
  },
}

const PRIORITY_COLOR = { High: '#dc2626', Medium: '#d97706', Low: '#16a34a' }

const STATUS_LABEL = {
  Pending:    { color: '#64748b', icon: '🕐' },
  Approved:   { color: '#1d4ed8', icon: '✅' },
  Scheduled:  { color: '#4f46e5', icon: '📅' },
  'For Review': { color: '#d97706', icon: '🔍' },
  Completed:  { color: '#059669', icon: '✓'  },
  Delayed:    { color: '#d97706', icon: '⚠️' },
  Cancelled:  { color: '#64748b', icon: '🚫' },
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

function buildHtml(config, preparedBy, refId, activityType, neededDate, status) {
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

function buildApprovalHtml(approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId, platform, shootTypeDetail) {
  const appUrl = 'https://dap-flow-tau.vercel.app'
  const approveUrl = `${appUrl}/api/approve?id=${fullId}&action=approve`
  const rejectUrl  = `${appUrl}/api/approve?id=${fullId}&action=reject`
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
        ${platform ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Platform</td><td style="padding:8px 12px">${platform}</td></tr>` : ''}
        ${shootTypeDetail ? `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Type of Shoot</td><td style="padding:8px 12px">${shootTypeDetail}</td></tr>` : ''}
      </table>

      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0;font-weight:700;color:#854d0e;font-size:14px">⚠ Action Required</p>
        <p style="margin:8px 0 0;color:#713f12;font-size:13px">
          Please review the details above and click one of the buttons below to approve or decline this booking request.
        </p>
      </div>

      <div style="display:flex;gap:12px;margin:20px 0">
        <a href="${approveUrl}" style="flex:1;display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:8px;text-align:center">
          ✓ Approve Request
        </a>
        <a href="${rejectUrl}" style="flex:1;display:inline-block;background:#f1f5f9;color:#64748b;text-decoration:none;font-weight:700;font-size:14px;padding:14px 20px;border-radius:8px;text-align:center;border:1px solid #e2e8f0">
          ✗ Decline Request
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;margin:12px 0">
        You can also manage this request by logging into the DAP Flow app under <strong>Job Orders → Requests</strong>.
      </p>

      <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
        — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
      </p>
    </div>`
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ status: 'DAP email function is running ✓' })

  const body = req.body || {}

  // ── Approval request email to manager ──────────────────────────────────────
  if (body.approvalRequest) {
    const { approverEmail, approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId, platform, shootTypeDetail } = body
    if (!approverEmail) return res.status(200).json({ ok: true })
    try {
      await transporter.sendMail({
        from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
        replyTo: 'no-reply@dap-flow.noreply',
        to: approverEmail,
        subject: `[DAP] Approval Required: ${activityType} from ${preparedBy} — #${refId}`,
        html: buildApprovalHtml(approverName, preparedBy, activityType, projectName, department, neededDate, endDate, venue, refId, fullId, platform, shootTypeDetail),
      })
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Approval email error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Failed to send approval email' })
    }
  }

  // ── Coordinator notification: request approved, ready for assignment ───────
  if (body.coordinatorNotification) {
    const { coordinatorEmail, coordinatorName, preparedBy, activityType, projectName, department, neededDate, venue, refId } = body
    if (!coordinatorEmail) return res.status(200).json({ ok: true })
    const appUrl = 'https://dap-flow-tau.vercel.app'
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
      <div style="background:linear-gradient(135deg,#1B2F5E,#5164C0);padding:20px 24px;border-radius:8px;margin-bottom:24px">
        <p style="color:#c7d2f7;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
        <h2 style="color:#fff;margin:0;font-size:20px">Request Approved — Ready to Assign ✅</h2>
      </div>
      <p>Hi <strong>${coordinatorName || 'Coordinator'}</strong>,</p>
      <p style="color:#475569">A booking request has been <strong style="color:#059669">approved by the approver</strong> and is now waiting for the DAP team to assign members. Please review and assign it in DAP Flow.</p>
      <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">Reference</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#5164C0">#${refId || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Service Type</td><td style="padding:8px 12px">${activityType || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Project</td><td style="padding:8px 12px">${projectName || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Department</td><td style="padding:8px 12px">${department || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Date Needed</td><td style="padding:8px 12px">${neededDate || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Venue</td><td style="padding:8px 12px">${venue || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Prepared By</td><td style="padding:8px 12px">${preparedBy || '—'}</td></tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#1B2F5E,#5164C0);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0">Open Requests in DAP Flow →</a>
      <p style="color:#94a3b8;font-size:12px;margin:12px 0">Find it under <strong>Job Orders → Requests</strong> (status: Pending Review).</p>
      <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
    </div>`
    try {
      await transporter.sendMail({
        from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
        replyTo: 'no-reply@dap-flow.noreply',
        to: coordinatorEmail,
        subject: `[DAP] Approved — Ready to Assign: ${activityType || 'Request'} #${refId || ''}`.trim(),
        html,
      })
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Coordinator email error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Failed to send coordinator email' })
    }
  }

  // ── Member notification ─────────────────────────────────────────────────────
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

  // ── Completion notification to requestor ───────────────────────────────────
  if (body.completionNotification) {
    const {
      requestorEmail, preparedBy, joNumber, projectName, activityType,
      priority, deadline, completedBy, completedAt, remarks, refId,
    } = body
    if (!requestorEmail) return res.status(200).json({ ok: true })

    // Format the completion date/time nicely
    const completionDateStr = completedAt
      ? new Date(completedAt).toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
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
        <p style="margin:0 0 20px;color:#475569">
          We are pleased to inform you that your Job Order has been successfully <strong style="color:#059669">completed</strong> by the D&amp;AP team. Please review the completion details below.
        </p>

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

        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:0 0 24px">
          <p style="margin:0;font-size:13px;color:#065f46;line-height:1.6">
            ✅ <strong>Status: Completed</strong><br>
            If you have any questions about the output or need revisions, please contact the D&amp;AP team directly or reply to this email.
          </p>
        </div>

        <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
          — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
        </p>
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

  // ── Output-for-review notification to approver ────────────────────────────
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
    const appUrl = 'https://dap-flow-tau.vercel.app'
    const actionSection = reviewId && slot
      ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0;font-weight:700;color:#854d0e;font-size:14px">📋 Action Required</p>
          <p style="margin:8px 0 0;color:#713f12;font-size:13px">Use the buttons below to respond directly from your email, or open the DAP Flow app to review with additional context.</p>
        </div>
        <div style="display:flex;gap:12px;margin:16px 0">
          <a href="${appUrl}/api/review-action?reviewId=${reviewId}&slot=${slot}&action=approve" style="flex:1;display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:8px;text-align:center">✓ Approve</a>
          <a href="${appUrl}/api/review-action?reviewId=${reviewId}&slot=${slot}&action=disapprove" style="flex:1;display:inline-block;background:#f1f5f9;color:#64748b;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:8px;text-align:center;border:1px solid #e2e8f0">↩ Request Revision</a>
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
      <p style="color:#475569"><strong>${submittedBy}</strong> has submitted their output for your review. Please check the details below.</p>
      <table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px;font-weight:600">${projectName}</td></tr>
        <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activityType}</td></tr>
        ${roleRow}
        ${attachmentRow}
      </table>
      ${commentBlock}
      ${actionSection}
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0">Open DAP Flow App →</a>
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

  // ── Review approved — notify assigned members ──────────────────────────────
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
        await transporter.sendMail({
          from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
          replyTo: 'no-reply@dap-flow.noreply',
          to: email,
          subject: `[DAP] Output Approved — ${joNumber}`,
          html,
        })
      }
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Review approved email error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Failed to send approval notification' })
    }
  }

  // ── Review disapproved — notify assigned members ───────────────────────────
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
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:13px;color:#713f12">Please review the feedback above, make the necessary changes, and re-submit the output via DAP Flow.</p>
      </div>
      <a href="https://dap-flow-tau.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0">Open DAP Flow App →</a>
      <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">— Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management</p>
    </div>`
    try {
      for (const email of recipientEmails) {
        await transporter.sendMail({
          from: `"DAP Flow (No Reply)" <${process.env.GMAIL_USER}>`,
          replyTo: 'no-reply@dap-flow.noreply',
          to: email,
          subject: `[DAP] Revision Requested — ${joNumber}`,
          html,
        })
      }
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Review disapproved email error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Failed to send disapproval notification' })
    }
  }

  // ── JO notification to requestor ────────────────────────────────────────────
  if (body.joNotification) {
    const { requestorEmail, preparedBy, joNumber, projectName, activityType, priority, deadline, status, refId } = body
    if (!requestorEmail || !status) return res.status(200).json({ ok: true })
    const statusInfo = STATUS_LABEL[status] || { color: '#64748b', icon: '' }
    try {
      const tableHtml = buildJOTable(joNumber, projectName, activityType, priority || 'N/A', deadline, status, statusInfo.color)
      const refLine = refId ? `<p style="font-size:13px;color:#64748b;margin-top:8px">Booking Reference: <strong style="font-family:monospace;color:#1d4ed8">#${refId}</strong></p>` : ''
      const bodyHtml = `<p style="margin:0 0 8px">Hi <strong>${preparedBy}</strong>,</p><p style="margin:0 0 16px;color:#475569">The Job Order linked to your booking request has been updated. Please review the details below.</p>${tableHtml}${refLine}`
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

  // ── Direct call from app for JO / booking status changes ───────────────────
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
      html: buildHtml(config, preparedBy, refId, activityType, neededDate, status),
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Email error:', err?.message || err)
    return res.status(500).json({ error: err?.message || 'Failed to send email' })
  }
}
