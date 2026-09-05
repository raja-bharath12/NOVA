import { useEffect, useState } from 'react'
import {
  CheckSquare,
  CalendarClock,
  MessageSquare,
  FileText,
  Video,
  Palette,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Zap,
  Plus,
  Play,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GlassPanel from '../components/dashboard/GlassPanel'
import AnimatedCounter from '../components/dashboard/AnimatedCounter'
import { useAuth } from '../context/AuthContext'
import { taskService } from '../services/taskService'
import { eventService } from '../services/eventService'
import { meetingService } from '../services/meetingService'
import { whiteboardService } from '../services/whiteboardService'
import aiService from '../services/aiService'
import type { Task, EventItem, Meeting, WhiteboardItem, AiProductivityAnalytics } from '../types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [whiteboards, setWhiteboards] = useState<WhiteboardItem[]>([])
  const [analytics, setAnalytics] = useState<AiProductivityAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      taskService.list().catch(() => []),
      eventService.list().catch(() => []),
      meetingService.getUserMeetings().catch(() => []),
      whiteboardService.getAll().catch(() => []),
      aiService.getAnalytics().catch(() => null),
    ])
      .then(([t, e, m, w, a]) => {
        setTasks(t)
        setEvents(e)
        setMeetings(m)
        setWhiteboards(w)
        setAnalytics(a)
      })
      .finally(() => setLoading(false))
  }, [])

  const completed = tasks.filter((t) => t.completed).length
  const upcomingEvents = events.filter((e) => new Date(e.startTime) > new Date())
  const activeMeetings = meetings.filter((m) => m.status === 'ACTIVE' || m.status === 'WAITING')
  const deadlinesToday = tasks.filter(
    (t) => t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString()
  ).length

  return (
    <div className="w-full space-y-8">
      {/* Greeting & Date Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="label-tracked mb-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            <span className="text-gradient">{greeting()},</span>{' '}
            <span className="text-silver">{user?.name?.split(' ')[0] ?? 'there'}</span>
          </h1>
        </div>

        {/* Quick Launch Action Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/meetings')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <Video className="w-3.5 h-3.5 text-purple-400" />
            <span>Start Meeting</span>
          </button>
          <button
            onClick={() => navigate('/whiteboard')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all hover:scale-105"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Canvas</span>
          </button>
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel tilt>
          <CheckSquare className="text-violet-400 mb-3" size={20} />
          <p className="text-3xl font-display font-semibold">
            <AnimatedCounter value={tasks.length} />
          </p>
          <p className="label-tracked mt-1">Total Tasks</p>
        </GlassPanel>

        <GlassPanel tilt>
          <CheckSquare className="text-emerald-400 mb-3" size={20} />
          <p className="text-3xl font-display font-semibold">
            <AnimatedCounter value={completed} />
          </p>
          <p className="label-tracked mt-1">Completed</p>
        </GlassPanel>

        <GlassPanel tilt>
          <Video className="text-purple-400 mb-3" size={20} />
          <p className="text-3xl font-display font-semibold">
            <AnimatedCounter value={meetings.length} />
          </p>
          <p className="label-tracked mt-1">Meeting Rooms</p>
        </GlassPanel>

        <GlassPanel tilt>
          <Palette className="text-pink-400 mb-3" size={20} />
          <p className="text-3xl font-display font-semibold">
            <AnimatedCounter value={whiteboards.length} />
          </p>
          <p className="label-tracked mt-1">Whiteboards</p>
        </GlassPanel>
      </div>

      {/* AI Intelligence Insight Banner */}
      {analytics?.productivityInsight && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-transparent border border-purple-500/20 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">NOVA AI Workspace Summary</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  {Math.round(analytics.completionRate)}% Velocity
                </span>
              </div>
              <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
                {analytics.productivityInsight}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Multi-Column Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <GlassPanel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-lavender flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-purple-400" />
              <span>Today's Tasks</span>
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-muted text-sm">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted text-sm">No tasks yet. Create one with the + button.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasks.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <span className={t.completed ? 'text-muted line-through' : 'text-silver'}>
                    {t.title}
                  </span>
                  <span
                    className={`label-tracked ${
                      t.priority === 'HIGH'
                        ? 'text-rose-400 font-bold'
                        : t.priority === 'LOW'
                        ? 'text-muted'
                        : 'text-lavender'
                    }`}
                  >
                    {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        {/* Active & Scheduled Meetings */}
        <GlassPanel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-lavender flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Conference Rooms</span>
            </h2>
            <button
              onClick={() => navigate('/meetings')}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-muted text-sm">Loading...</p>
          ) : meetings.length === 0 ? (
            <p className="text-muted text-sm">No meeting rooms created yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {meetings.slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between text-sm p-2 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <span className="text-silver font-medium block">{m.title}</span>
                    <span className="text-[11px] font-mono text-white/40">Room: {m.roomCode}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/meetings/room/${m.roomCode}`)}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Join</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        {/* Collaborative Whiteboards */}
        <GlassPanel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-lavender flex items-center gap-2">
              <Palette className="w-4 h-4 text-pink-400" />
              <span>Quantum Whiteboards</span>
            </h2>
            <button
              onClick={() => navigate('/whiteboard')}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Explore</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-muted text-sm">Loading...</p>
          ) : whiteboards.length === 0 ? (
            <p className="text-muted text-sm">No whiteboards created yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {whiteboards.slice(0, 4).map((w) => (
                <li
                  key={w.id}
                  onClick={() => navigate('/whiteboard')}
                  className="cursor-pointer flex items-center justify-between text-sm p-2 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-silver font-medium">{w.title}</span>
                  <span className="text-xs text-white/40">
                    {new Date(w.updatedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        {/* Upcoming Calendar Events */}
        <GlassPanel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-lavender flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <span>Upcoming Calendar</span>
            </h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Open Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <p className="text-muted text-sm">Loading...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-muted text-sm">Nothing scheduled. Add an event from the calendar.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcomingEvents.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm p-2">
                  <span className="text-silver">{e.title}</span>
                  <span className="label-tracked">
                    {new Date(e.startTime).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  )
}
