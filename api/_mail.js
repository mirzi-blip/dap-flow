// ── Sender identity for every DAP Flow notification ─────────────────────────
// One place defines who the app sends as. Each mail function imports MAIL_FROM
// rather than rebuilding the From line, so the sender can never drift between
// notification types.
//
// MAIL_FROM_ADDRESS is what recipients see in the From line. It is deliberately
// separate from GMAIL_USER (the SMTP account the app authenticates with) so the
// app can send as a Google "Send mail as" alias without needing that alias to
// have its own app password. When it is unset the sender falls back to the
// authenticated account, so behaviour is unchanged until it is configured.
//
// Gmail only honours a From address that is either the authenticated account
// itself or an alias verified on it under Settings → Accounts → "Send mail as".
// An unverified address is silently rewritten back to the account address.

const FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || process.env.GMAIL_USER
const FROM_NAME    = process.env.MAIL_FROM_NAME    || 'DAP Flow (No Reply)'

/** The From header used by every email the app sends. */
const MAIL_FROM = `"${FROM_NAME}" <${FROM_ADDRESS}>`

/** Replies are not monitored; kept configurable for the same reason. */
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || 'no-reply@dap-flow.noreply'

module.exports = { MAIL_FROM, MAIL_REPLY_TO, FROM_ADDRESS, FROM_NAME }
