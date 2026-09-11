import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, X, Loader2, AtSign, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { checkUsernameAvailability } from '../services/authService'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Username validation & availability states
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available?: boolean
    validFormat?: boolean
    message?: string
  }>({ checking: false })

  const debounceTimer = useRef<any>(null)

  const searchParams = new URLSearchParams(location.search)
  const redirectTarget = searchParams.get('redirect') || (location.state as any)?.from?.pathname || '/'

  // Clean username on change: strictly lowercase, strip @ prefix, remove invalid characters
  function handleUsernameChange(val: string) {
    // Remove leading @ and convert to lowercase
    let cleaned = val.toLowerCase().replace(/^@+/, '').replace(/\s+/g, '')
    // Allow only lowercase a-z, 0-9, underscore, dot
    cleaned = cleaned.replace(/[^a-z0-9_.]/g, '')
    setUsername(cleaned)

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (!cleaned) {
      setUsernameStatus({ checking: false })
      return
    }

    if (cleaned.length < 3) {
      setUsernameStatus({
        checking: false,
        validFormat: false,
        available: false,
        message: 'Must be at least 3 characters',
      })
      return
    }

    if (cleaned.length > 30) {
      setUsernameStatus({
        checking: false,
        validFormat: false,
        available: false,
        message: 'Max 30 characters',
      })
      return
    }

    // Check basic regex format: letters, numbers, _, . but no leading/trailing dot or double dot
    if (cleaned.startsWith('.') || cleaned.endsWith('.') || cleaned.includes('..')) {
      setUsernameStatus({
        checking: false,
        validFormat: false,
        available: false,
        message: 'Cannot start/end with dot or contain ".."',
      })
      return
    }

    setUsernameStatus({ checking: true })

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(cleaned)
        setUsernameStatus({
          checking: false,
          available: res.available,
          validFormat: res.validFormat,
          message: res.message,
        })
      } catch {
        setUsernameStatus({
          checking: false,
          available: true,
          validFormat: true,
          message: 'Available',
        })
      }
    }, 350)
  }

  // Suggest username when name changes if user hasn't typed a username yet
  useEffect(() => {
    if (!username && name.trim()) {
      const suggested = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)
      if (suggested.length >= 3) {
        handleUsernameChange(suggested)
      }
    }
  }, [name])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (username && usernameStatus.available === false) {
      setError(usernameStatus.message || 'Please choose an available username.')
      return
    }

    setLoading(true)
    try {
      await register(name, email, password, username || undefined)
      navigate(redirectTarget, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-md p-6 sm:p-8 border border-white/[0.08] shadow-2xl rounded-3xl"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-0.5 shadow-[0_0_24px_rgba(168,85,247,0.4)] flex items-center justify-center">
            <div className="h-full w-full bg-void-950 rounded-[14px] flex items-center justify-center">
              <Sparkles size={20} className="text-cyan-300" />
            </div>
          </div>
          <h1 className="text-2xl text-gradient font-bold tracking-tight font-display">Mystic Workspace</h1>
          <p className="text-xs text-muted mt-1">Create your handle & join teammates</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Full Name */}
          <div>
            <label className="label-tracked block mb-1 text-xs">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="Ada Lovelace"
            />
          </div>

          {/* Instagram-style Username Handle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label-tracked text-xs flex items-center gap-1">
                <AtSign size={12} className="text-violet-400" />
                <span>Username Handle</span>
              </label>
              {username && (
                <span className="text-[11px] font-mono text-cyan-300/80">
                  @{username}
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-muted font-mono text-sm font-semibold select-none">
                @
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={30}
                className={`w-full bg-white/[0.03] border rounded-xl pl-8 pr-10 py-2.5 text-sm font-mono text-silver focus:outline-none transition-all ${
                  usernameStatus.checking
                    ? 'border-white/[0.1]'
                    : usernameStatus.available === true
                    ? 'border-emerald-500/60 focus:border-emerald-400 focus:shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                    : usernameStatus.available === false
                    ? 'border-rose-500/60 focus:border-rose-400'
                    : 'border-white/[0.08] focus:border-violet-400/50 focus:shadow-glow'
                }`}
                placeholder="username (e.g. ada_lovelace)"
              />
              <div className="absolute right-3 flex items-center">
                {usernameStatus.checking ? (
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                ) : usernameStatus.available === true ? (
                  <div className="flex items-center text-emerald-400" title="Username is available">
                    <Check size={16} />
                  </div>
                ) : usernameStatus.available === false ? (
                  <div className="flex items-center text-rose-400" title="Username unavailable">
                    <X size={16} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Live Username Feedback & Preview */}
            <div className="mt-1 flex items-center justify-between text-[11px]">
              {usernameStatus.message ? (
                <span
                  className={
                    usernameStatus.available
                      ? 'text-emerald-400 font-medium'
                      : 'text-rose-400'
                  }
                >
                  {usernameStatus.message}
                </span>
              ) : (
                <span className="text-muted/70">
                  Letters, numbers, underscores, dots (3-30 chars)
                </span>
              )}
              {username && usernameStatus.available && (
                <span className="text-[10px] text-muted/60 font-mono hidden sm:inline truncate max-w-[170px]">
                  chat/u/{username}
                </span>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label-tracked block mb-1 text-xs">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="label-tracked block mb-1 text-xs">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <X size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || usernameStatus.checking || usernameStatus.available === false}
            className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 py-2.5 text-sm font-semibold text-void-950 shadow-glow disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </motion.button>
        </form>

        <p className="text-center text-xs text-muted mt-5">
          Already have an account?{' '}
          <Link
            to={location.search ? `/login${location.search}` : '/login'}
            state={location.state}
            className="text-lavender hover:text-cyan-400 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
