const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://uohhloqkikemvustxnpa.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaGhsb3FraWtlbXZ1c3R4bnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODM1MzAsImV4cCI6MjA5MjM1OTUzMH0.DnJBh2wTSesPRTojPQb_xk8ZbI40AgzTl-6spM22bAs'
const APP_URL = 'https://dap-flow-tau.vercel.app'

async function dbGet(id) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/booking_requests?id=eq.${id}&select=id,status,prepared_by,activity_type`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  const rows = await r.json()
  return rows[0] || null
}

async function dbUpdate(id, status) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/booking_requests?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status }),
    }
  )
}

function page(title, emoji, heading, body, bgColor) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title} — DAP Flow</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#fff;border-radius:20px;padding:48px 40px;max-width:460px;width:100%;text-align:center;box-shadow:0 4px 32px rgba(0,0,0,.10)}.icon{width:80px;height:80px;border-radius:50%;background:${bgColor};display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 24px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:10px}h1{font-size:22px;font-weight:900;color:#0f172a;margin-bottom:14px}p{font-size:14px;color:#64748b;line-height:1.7;margin-bottom:28px}a.btn{display:inline-block;background:linear-gradient(135deg,#0f4c81,#2389d7);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px}.footer{margin-top:28px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:20px}</style>
</head><body><div class="card">
<div class="icon">${emoji}</div>
<p class="eyebrow">DAP Flow · Booking System</p>
<h1>${heading}</h1>
<p>${body}</p>
<a class="btn" href="${APP_URL}">Go to DAP Flow →</a>
<div class="footer">Digital &amp; Arts Production (DAP) Team · Booking &amp; Workload Management</div>
</div></body></html>`
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html')

  const { id, action } = req.query

  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).send(page('Invalid Link', '⚠️', 'Invalid Approval Link',
      'This link is missing required parameters. Please ask the requester to resubmit.', '#fee2e2'))
  }

  let data
  try {
    data = await dbGet(id)
  } catch (e) {
    return res.status(500).send(page('Error', '⚠️', 'Connection Error',
      'Could not connect to the database. Please try again in a moment.', '#fee2e2'))
  }

  if (!data) {
    return res.status(404).send(page('Not Found', '❓', 'Request Not Found',
      'We could not find this booking request. It may have been deleted or the link is invalid.', '#fef9c3'))
  }

  if (data.status !== 'Pending Approval') {
    const wasApproved = ['Pending Review', 'Assigned', 'Approved', 'Completed'].includes(data.status)
    return res.status(200).send(page(
      'Already Actioned', wasApproved ? '✅' : 'ℹ️',
      wasApproved ? 'Already Approved' : 'Already Actioned',
      `This request has already been <strong>${wasApproved ? 'approved and forwarded to the DAP team' : data.status.toLowerCase()}</strong>. No further action is needed.`,
      wasApproved ? '#d1fae5' : '#f1f5f9'
    ))
  }

  if (action === 'approve') {
    await dbUpdate(id, 'Pending Review')
    return res.status(200).send(page('Approved', '✅', 'Request Approved!',
      `You have approved the booking request from <strong>${data.prepared_by}</strong> for <strong>${data.activity_type}</strong>.<br><br>The DAP team has been notified and will proceed with the job order.`,
      '#d1fae5'))
  }

  await dbUpdate(id, 'Rejected')
  return res.status(200).send(page('Declined', '❌', 'Request Declined',
    `You have declined the booking request from <strong>${data.prepared_by}</strong> for <strong>${data.activity_type}</strong>.<br><br>The requester will be notified.`,
    '#fee2e2'))
}
