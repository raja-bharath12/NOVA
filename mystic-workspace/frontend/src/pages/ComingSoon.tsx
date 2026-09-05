import GlassPanel from '../components/dashboard/GlassPanel'
import { Sparkles } from 'lucide-react'

export default function ComingSoon({ title, stage }: { title: string; stage: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gradient mb-6">{title}</h1>
      <GlassPanel className="text-center py-16">
        <Sparkles className="mx-auto mb-4 text-violet-400" size={28} />
        <p className="text-lavender mb-2">Arriving in {stage}</p>
        <p className="text-muted text-sm max-w-sm mx-auto">
          This part of the workspace is on the roadmap and will connect to the same backend and design system already in place.
        </p>
      </GlassPanel>
    </div>
  )
}
