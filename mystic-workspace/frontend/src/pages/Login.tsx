import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Sparkles, X, AtSign } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const searchParams = new URLSearchParams(location.search)
  const redirectTarget = searchParams.get('redirect') || (location.state as any)?.from?.pathname || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      navigate(redirectTarget, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not sign in. Check your email/username or password.')
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
          <p className="text-xs text-muted mt-1">Sign in with your Email or @username</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label-tracked block mb-1 text-xs flex items-center gap-1">
              <AtSign size={12} className="text-violet-400" />
              <span>Email or @username</span>
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="you@example.com or @username"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label className="label-tracked block mb-1 text-xs">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="••••••••"
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
            disabled={loading}
            className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 py-2.5 text-sm font-semibold text-void-950 shadow-glow disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        <p className="text-center text-xs text-muted mt-5">
          New here?{' '}
          <Link
            to={location.search ? `/register${location.search}` : '/register'}
            state={location.state}
            className="text-lavender hover:text-cyan-400 font-medium transition-colors"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
