/** Where this app lives.
 *
 *  The app and its serverless functions are served from the same origin, so in
 *  a browser we simply use the origin the app was loaded from. That means the
 *  app follows its own domain: moving it again needs no code change, and the
 *  booking link people copy always points at the host they are actually using.
 *
 *  Local dev is the exception. `vite dev` serves the UI but not the functions
 *  in `api/`, so a same-origin call there would 404; local dev talks to the
 *  deployed app instead. Set VITE_APP_URL to override either case.
 */
const DEPLOYED_ORIGIN = 'https://dapflow.ipihq.com'

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])$/

function resolveAppUrl(): string {
  const configured = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/+$/, '')
  if (configured) return configured
  if (typeof window === 'undefined') return DEPLOYED_ORIGIN
  return LOCAL_HOSTS.test(window.location.hostname) ? DEPLOYED_ORIGIN : window.location.origin
}

/** Base URL of the running app, without a trailing slash. */
export const APP_URL = resolveAppUrl()

/** The notification endpoint every page posts to. */
export const EMAIL_API = `${APP_URL}/api/send-email`

/** The public booking form, shared with requestors outside the team. */
export const BOOKING_URL = `${APP_URL}/request`
