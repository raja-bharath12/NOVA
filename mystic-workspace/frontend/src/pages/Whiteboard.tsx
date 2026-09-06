import React, { useEffect, useState } from 'react'
import {
  Sparkles,
  Plus,
  Trash2,
  Share2,
  ArrowLeft,
  LayoutGrid,
  Clock,
  Palette,
  ExternalLink,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas'
import whiteboardService from '../services/whiteboardService'
import type { WhiteboardItem } from '../types'
import { useAuth } from '../context/AuthContext'

export default function Whiteboard() {
  const { user } = useAuth()
  const [boards, setBoards] = useState<WhiteboardItem[]>([])
  const [activeBoard, setActiveBoard] = useState<WhiteboardItem | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [newTitle, setNewTitle] = useState<string>('')
  const [creating, setCreating] = useState<boolean>(false)

  // Load all user whiteboards
  const loadWhiteboards = async () => {
    try {
      setLoading(true)
      const data = await whiteboardService.getAll()
      setBoards(data)
    } catch (err) {
      console.error('Failed to load whiteboards', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWhiteboards()
  }, [])

  // Create Whiteboard
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setCreating(true)
      const created = await whiteboardService.create(newTitle.trim())
      setBoards((prev) => [created, ...prev])
      setActiveBoard(created)
      setShowCreateModal(false)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to create whiteboard', err)
    } finally {
      setCreating(false)
    }
  }

  // Delete Whiteboard
  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this whiteboard?')) return

    try {
      await whiteboardService.delete(id)
      setBoards((prev) => prev.filter((b) => b.id !== id))
      if (activeBoard?.id === id) {
        setActiveBoard(null)
      }
    } catch (err) {
      console.error('Failed to delete whiteboard', err)
    }
  }

  // Save Canvas data to backend
  const handleSaveCanvas = async (canvasData: string, snapshotUrl: string) => {
    if (!activeBoard) return
    try {
      const updated = await whiteboardService.save(activeBoard.id, {
        canvasData,
        snapshotUrl,
      })
      setActiveBoard(updated)
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (err) {
      console.error('Failed to save whiteboard', err)
    }
  }

  return (
    <div className="w-full relative flex flex-col space-y-6">
      {/* Aurora Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {activeBoard ? (
        /* Active Board Canvas View */
        <div className="flex-1 flex flex-col gap-4 relative z-10 max-w-7xl w-full mx-auto h-[calc(100vh-125px)] md:h-[calc(100vh-100px)]">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-xl flex-wrap gap-2">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setActiveBoard(null)
                  loadWhiteboards()
                }}
                className="flex items-center gap-2 text-xs sm:text-sm text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/20 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>All Boards</span>
              </button>

              <div className="h-5 w-px bg-white/10" />

              <div>
                <h1 className="text-sm sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <span>{activeBoard.title}</span>
                  {activeBoard.meetingRoomCode && (
                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Linked: {activeBoard.meetingRoomCode}
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-white/40">
                  Last updated: {new Date(activeBoard.updatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  const url = window.location.href
                  navigator.clipboard.writeText(url)
                  alert('Board link copied to clipboard!')
                }}
                className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Collaborative Canvas Engine */}
          <div className="flex-1 w-full relative">
            <WhiteboardCanvas
              boardId={activeBoard.id}
              initialData={activeBoard.canvasData}
              title={activeBoard.title}
              onSave={handleSaveCanvas}
            />
          </div>
        </div>
      ) : (
        /* Whiteboard Gallery & Hub */
        <div className="w-full relative z-10 flex-1 flex flex-col">
          {/* Top Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-transparent p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/20 backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-2 text-purple-400 font-mono text-xs uppercase tracking-widest mb-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Stage 4 • Real-Time Spatial Collaboration</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Quantum Whiteboards
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-1 max-w-xl">
                Collaborate simultaneously with infinite vectors, low-latency delta synchronization,
                and real-time cursor presence.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-lg shadow-purple-600/30 transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>New Whiteboard</span>
            </button>
          </div>

          {/* Whiteboards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-white/5 border border-white/10"
                />
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/[0.02] border border-white/10 rounded-3xl">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Palette className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No Whiteboards Yet</h3>
              <p className="text-sm text-white/50 max-w-md mb-6">
                Create your first collaborative canvas to brainstorm architecture, diagram workflows,
                or sketch ideas in real time.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Canvas</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boards.map((b) => (
                <motion.div
                  key={b.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setActiveBoard(b)}
                  className="group cursor-pointer bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-500/40 rounded-2xl overflow-hidden transition-all shadow-xl flex flex-col"
                >
                  {/* Canvas Preview / Decorative Header */}
                  <div className="h-36 bg-[#0a0914] relative overflow-hidden flex items-center justify-center border-b border-white/5">
                    {b.snapshotUrl ? (
                      <img
                        src={b.snapshotUrl}
                        alt={b.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-white/30 group-hover:text-purple-400 transition-colors">
                        <LayoutGrid className="w-8 h-8" />
                        <span className="text-xs font-mono">Vector Canvas</span>
                      </div>
                    )}

                    {/* Subtle Overlay Badge */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="flex items-center gap-1 text-[11px] bg-purple-600/90 text-white px-2.5 py-1 rounded-lg backdrop-blur-md shadow-lg font-medium">
                        <span>Open Canvas</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors truncate">
                        {b.title}
                      </h3>
                      {b.meetingRoomCode && (
                        <p className="text-xs text-indigo-400 font-mono mt-0.5">
                          Room: {b.meetingRoomCode}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-white/40">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(b.updatedAt).toLocaleDateString()}</span>
                      </div>

                      <button
                        onClick={(e) => handleDelete(e, b.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Whiteboard"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Whiteboard Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121024] border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Create New Whiteboard</span>
              </h2>
              <p className="text-xs text-white/50 mb-5">
                Start a fresh canvas for high-resolution vector sketches and live multi-user sync.
              </p>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Whiteboard Title
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Architecture Roadmap 2026"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newTitle.trim()}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow-lg shadow-purple-600/30 transition-all"
                  >
                    {creating ? 'Creating...' : 'Create Whiteboard'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
