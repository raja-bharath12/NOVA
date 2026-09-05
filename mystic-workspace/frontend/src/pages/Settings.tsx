import GlassPanel from '../components/dashboard/GlassPanel'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gradient mb-6">Settings</h1>
      <GlassPanel>
        <p className="label-tracked mb-1">Name</p>
        <p className="text-silver mb-4">{user?.name}</p>
        <p className="label-tracked mb-1">Email</p>
        <p className="text-silver">{user?.email}</p>
      </GlassPanel>
    </div>
  )
}
