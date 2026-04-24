const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const STATUS_CONFIG = {
  // Booking request statuses (triggered by Supabase webhook)
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
  // JO progression statuses (triggered by direct API call from the app)
  Scheduled: {
    subject: 'Your Request Has Been Scheduled',
    heading: 'Request Scheduled 📅',
    headingColor: '#4f46e5',
    body: 'Great news! Your request has been <strong style="color:#4f46e5">Scheduled</strong>. The D&amp;AP team will begin work on the date indicated. You\'ll receive another update once work starts.',
  },
  'In Progress': {
    subject: 'Your Request is Now In Progress',
    heading: 'Work Has Started',
    headingColor: '#1d4ed8',
    body: 'The D&amp;AP team has started working on your request. We\'ll keep you updated on the progress.',
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

const MEMBER_CONFIG = {
  assigned: {
    subject: 'You Have Been Assigned to a Job Order',
    heading: 'New Assignment',
    headingColor: '#1d4ed8',
    body: (name, joNumber, project, activity, priority, deadline) =>
      `Hi <strong>${name}</strong>,<br><br>You have been assigned to a new Job Order. Please review the details below and coordinate with the team.<br><br>` +
      `<table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1d4ed8">${joNumber}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px">${project}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activity}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Priority</td><td style="padding:8px 12px;font-weight:700;color:${PRIORITY_COLOR[priority] || '#64748b'}">${priority}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Deadline</td><td style="padding:8px 12px;font-weight:700;color:#dc2626">${deadline}</td></tr>` +
      `</table>`,
  },
  scheduled: {
    subject: 'Your Job Order Has Been Scheduled',
    heading: 'Job Order Scheduled 📅',
    headingColor: '#4f46e5',
    body: (name, joNumber, project, activity, priority, deadline) =>
      `Hi <strong>${name}</strong>,<br><br>The following Job Order has been scheduled. Please make sure you are available on the indicated date.<br><br>` +
      `<table style="margin:20px 0;border-collapse:collapse;width:100%;font-size:14px">` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:140px">JO Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#4f46e5">${joNumber}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Project</td><td style="padding:8px 12px">${project}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Activity</td><td style="padding:8px 12px">${activity}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">Priority</td><td style="padding:8px 12px;font-weight:700;color:${PRIORITY_COLOR[priority] || '#64748b'}">${priority}</td></tr>` +
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600">Date</td><td style="padding:8px 12px;font-weight:700;color:#4f46e5">${deadline}</td></tr>` +
      `</table>`,
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ status: 'DAP email function is running ✓' })

  const body = req.body || {}

  let to, preparedBy, refId, activityType, neededDate, status, config

  if (body.memberNotification) {
    const { mode, memberEmail, memberName, joNumber, projectName, activityType, priority, deadline } = body
    const mc = MEMBER_CONFIG[mode]
    if (!mc || !memberEmail) return res.status(200).json({ ok: true })
    try {
      await transporter.sendMail({
        from: `"DAP Booking" <${process.env.GMAIL_USER}>`,
        to: memberEmail,
        subject: `[DAP] ${mc.subject} — ${joNumber}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px">
          <div style="background:linear-gradient(135deg,#0f4c81,#2389d7);padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <p style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:0.1em;margin:0 0 4px">DIGITAL &amp; ARTS PRODUCTION (DAP)</p>
            <h2 style="color:#fff;margin:0;font-size:20px">${mc.heading}</h2>
          </div>
          <p>${mc.body(memberName, joNumber, projectName, activityType, priority || 'N/A', deadline)}</p>
          <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
            — Digital &amp; Arts Production (DAP) Team<br>Booking &amp; Workload Management
          </p>
        </div>`,
      })
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Member email error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Failed to send email' })
    }
  }

  if (body.direct) {
    // Direct call from the app for JO status changes
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
      from: `"DAP Booking" <${process.env.GMAIL_USER}>`,
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
