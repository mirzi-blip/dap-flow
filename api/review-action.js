const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const APP_URL = 'https://dap-flow-tau.vercel.app'

function page(title, icon, color, heading, body) {
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
  return page(heading, icon, color, heading, body)
}

function alreadyActedPage(status, projectName, joNumber) {
  const isApproved = status === 'approved'
  const body = `
    <div class="meta"><strong>Project:</strong> ${projectName}<br><strong>JO Number:</strong> ${joNumber}</div>
    <p>This review has already been <strong>${isApproved ? 'approved' : 'actioned'}</strong>. No further action is needed from this link.</p>
    <p>You can view the current status in the DAP Flow app.</p>`
  return page('Already Actioned', '🔒', '#64748b', 'Already Actioned', body)
}

function errorPage(message) {
  const body = `<p>${message}</p><p>If you believe this is an error, please contact the DAP team directly.</p>`
  return page('Error', '⚠️', '#d97706', 'Something went wrong', body)
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html')

  const { reviewId, slot, action } = req.query

  if (!reviewId || !['req', 'dap'].includes(slot) || !['approve', 'disapprove'].includes(action)) {
    return res.status(400).send(errorPage('Invalid or missing link parameters. This link may be malformed or expired.'))
  }

  // Fetch review record
  const { data: review, error } = await supabase
    .from('jo_reviews')
    .select('*')
    .eq('id', reviewId)
    .maybeSingle()

  if (error || !review) {
    return res.status(404).send(errorPage('Review record not found. This link may have expired or already been processed.'))
  }

  // Check if this slot has already been acted on
  const currentStatus = slot === 'req' ? review.req_approver_status : review.dap_approver_status
  if (currentStatus !== 'pending') {
    return res.status(200).send(alreadyActedPage(currentStatus, review.project_name, review.jo_number))
  }

  // Check if overall already resolved
  if (review.overall_status !== 'pending') {
    return res.status(200).send(alreadyActedPage(review.overall_status, review.project_name, review.jo_number))
  }

  // Apply the action
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

  // Determine new overall status
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

  // Persist to jo_reviews
  const { error: updateError } = await supabase
    .from('jo_reviews')
    .update(updates)
    .eq('id', reviewId)

  if (updateError) {
    console.error('review-action update error:', updateError.message)
    return res.status(500).send(errorPage('Failed to save your response. Please try again or contact the DAP team.'))
  }

  const isResolved = newOverallStatus !== null
  const actorName = slot === 'req' ? review.req_approver_name : review.dap_approver_name

  // Notify the other approver that a decision was made (if not yet resolved)
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

  // If resolved, notify submitter + both approvers
  if (isResolved) {
    const outcome = newOverallStatus === 'approved' ? 'approved' : 'needs revision'
    const outcomeColor = newOverallStatus === 'approved' ? '#059669' : '#dc2626'
    const outcomeEmoji = newOverallStatus === 'approved' ? '✅' : '↩️'
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
}
