import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  return (
    <div className="w-full max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold text-gradient">Settings</h1>
      <GlassPanel>
        <p className="label-tracked mb-1">Name</p>
        <p className="text-silver mb-4">{user?.name}</p>
        <p className="label-tracked mb-1">Email</p>
        <p className="text-silver">{user?.email}</p>
      </GlassPanel>
    </div>
  )
}
