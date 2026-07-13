import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Lock, Mail, AlertCircle, Camera, ArrowRight, Eye, EyeOff } from 'lucide-react'


export function LoginPage() {
  const login = useAppStore(s => s.login)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email, password)
    if (!ok) setError('Invalid email or password.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col lg:flex-row">

      {/* ── Left panel (brand) — hidden on small screens ─────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-8 w-48 h-48 rounded-full bg-blue-400/10" />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="DAP Flow" className="w-10 h-10 rounded-xl" />
            <div>
              <p className="text-white font-black text-lg leading-none tracking-tight">DAP Flow</p>
              <p className="text-blue-300 text-[11px] mt-0.5 uppercase tracking-widest">Booking &amp; Workload</p>
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative">
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight">
            Booking &<br />Workload<br />
            <span className="text-sky-300">Management</span>
          </h1>
          <p className="text-blue-200 mt-4 text-base leading-relaxed max-w-xs">
            Plan, schedule, and execute studio productions with full team visibility — even offline.
          </p>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Offline-ready PWA','Role-based access','Real-time workload','Kanban pipeline'].map(f => (
              <span key={f} className="text-xs bg-white/10 border border-white/15 text-white px-3 py-1.5 rounded-full font-medium">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-blue-400 text-xs">DAP Booking &amp; Workload System · Working Title: DAP Flow · v1.0</p>
      </div>

      {/* ── Right panel (form) ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <img src="/favicon.svg" alt="DAP Flow" className="w-10 h-10 rounded-xl shadow-lg" />
          <div>
            <p className="font-black text-slate-900 text-base leading-none">DAP Flow</p>
            <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-widest">Booking &amp; Workload</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Sign in</h2>
            <p className="text-slate-400 text-sm mt-1">Access your studio operations dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@dapflow.com"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pl-10 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pl-10 pr-10 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 font-medium">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">Sign In <ArrowRight size={15} /></span>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-300 mt-6">DAP Booking &amp; Workload System · Offline-capable PWA · v1.0</p>
        </div>
      </div>
    </div>
  )
}

