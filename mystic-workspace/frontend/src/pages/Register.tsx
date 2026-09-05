import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel w-full max-w-sm p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400 shadow-glow" />
          <h1 className="text-2xl text-gradient font-semibold tracking-tight">Mystic Workspace</h1>
          <p className="label-tracked mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label-tracked block mb-1.5">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="Ada Lovelace"
            />
          </div>
          <div>
            <label className="label-tracked block mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-silver focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label-tracked block mb-1.5">Password</label>
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-2.5 text-sm font-medium text-void-950 shadow-glow disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-lavender hover:text-cyan-400 transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
