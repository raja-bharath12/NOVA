import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Film,
  Plus,
  Upload,
  Play,
  Trash2,
  Users,
  Sparkles,
  Link2,
  Copy,
  Check,
  X,
  AlertCircle,
  FileVideo,
  Clock,
  Layers,
  Search
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { watchService } from '../services/watchService'
import { useToast } from '../context/ToastContext'
import type { WatchMedia, WatchRoom } from '../types'

export default function WatchTogetherHome() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [mediaList, setMediaList] = useState<WatchMedia[]>([])
  const [loading, setLoading] = useState(true)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  // Create Room modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)
  const [roomTitle, setRoomTitle] = useState('')
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)

  // Join Room modal state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadMedia()
  }, [])

  function loadMedia() {
    setLoading(true)
    watchService
      .getMyMedia()
      .then((data) => setMediaList(data))
      .catch(() => showToast('Could not load videos. Is backend running?', 'warning'))
      .finally(() => setLoading(false))
  }

  // Handle Video Upload (Up to 5 GB Direct S3 Upload)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || isUploading) return

    const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024 // 5 GB
    if (uploadFile.size > MAX_VIDEO_SIZE) {
      const sizeGb = (uploadFile.size / (1024 * 1024 * 1024)).toFixed(2)
      showToast(`Selected file (${sizeGb} GB) exceeds the 5.00 GB maximum limit.`, 'warning')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const created = await watchService.uploadMedia(
        uploadFile,
        uploadTitle.trim() || undefined,
        (pct) => setUploadProgress(pct)
      )
      setMediaList((prev) => [created, ...prev])
      showToast('Video uploaded successfully and ready for streaming!', 'success')
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadProgress(0)
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Failed to upload video'
      showToast(errorMsg, 'warning')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle Create Room
  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMediaId || isCreatingRoom) return

    setIsCreatingRoom(true)
    try {
      const room = await watchService.createRoom(selectedMediaId, roomTitle.trim() || undefined)
      showToast('Watch Room created!')
      navigate(`/watch/${room.roomCode}`)
    } catch (err: any) {
      showToast('Failed to create Watch Room', 'warning')
    } finally {
      setIsCreatingRoom(false)
    }
  }

  // Handle Join Room
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return

    let raw = joinCodeInput.trim()
    try {
      raw = decodeURIComponent(raw).trim()
    } catch {}
    if (raw.includes('?')) raw = raw.split('?')[0]
    if (raw.includes('#')) raw = raw.split('#')[0]
    if (raw.includes('/')) {
      const parts = raw.split('/').filter(Boolean)
      if (parts.length > 0) raw = parts[parts.length - 1]
    }
    raw = raw.replace(/^[\s.,/\\:;!?'"()[\]{}<>~`@#$%^&*+=]+|[\s.,/\\:;!?'"()[\]{}<>~`@#$%^&*+=]+$/g, '')
    const normalized = raw.toLowerCase().replace(/[\s_]+/g, '-')
    const match = normalized.match(/(?:nova[-_]?watch[-_]?)([a-z0-9]+)/)
    const suffixMatch = normalized.match(/([a-z0-9]{4,10})/)
    const code = match ? `nova-watch-${match[1]}` : (suffixMatch ? `nova-watch-${suffixMatch[1]}` : normalized)

    if (!code) return
    navigate(`/watch/${code}`)
  }

  // Handle Delete Video
  const handleDeleteMedia = async (id: number) => {
    try {
      await watchService.deleteMedia(id)
      setMediaList((prev) => prev.filter((m) => m.id !== id))
      showToast('Video deleted')
    } catch {
      showToast('Could not delete video', 'warning')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const filteredMedia = mediaList.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
              Synchronized Streaming
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-silver mt-1">
            <span className="text-gradient">Watch</span> Together
          </h1>
          <p className="text-xs text-muted mt-1">
            Watch authorized videos with friends in real time with synchronized playback and live chat.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-silver border border-white/[0.1] text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Link2 size={15} className="text-cyan-400" />
            <span>Join Room</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2 transition-all shadow-glow"
          >
            <Upload size={15} />
            <span>Upload Video</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (mediaList.length > 0) {
                setSelectedMediaId(mediaList[0].id)
              }
              setShowCreateModal(true)
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow flex items-center gap-2 hover:opacity-95 transition-all"
          >
            <Plus size={16} />
            <span>Create Room</span>
          </motion.button>
        </div>
      </div>

      {/* Search Bar */}
      {mediaList.length > 0 && (
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-2.5 max-w-md focus-within:border-cyan-400/50 transition-all">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search your video library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-silver placeholder:text-muted/60 focus:outline-none flex-1"
          />
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-panel p-5 animate-pulse space-y-3">
              <div className="h-36 bg-white/10 rounded-xl" />
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : mediaList.length === 0 ? (
        /* Empty State for New Users */
        <GlassPanel className="p-8 sm:p-14 text-center border border-white/[0.08] shadow-glass relative overflow-hidden">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-cyan-400/40 mx-auto flex items-center justify-center text-cyan-300 shadow-glow">
              <Film size={32} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-display font-bold text-silver">
                Watch Together
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Watch videos with your friends in real time. You haven't uploaded any videos yet.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow flex items-center justify-center gap-2 hover:opacity-95 transition-all"
              >
                <Upload size={15} />
                <span>Upload Video</span>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-silver border border-white/[0.1] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Link2 size={15} className="text-cyan-400" />
                <span>Join Room</span>
              </button>
            </div>
          </div>
        </GlassPanel>
      ) : (
        /* Video Library Grid */
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-silver uppercase tracking-wider flex items-center gap-2">
            <FileVideo size={16} className="text-cyan-400" />
            <span>Your Authorized Video Library ({filteredMedia.length})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredMedia.map((media) => (
              <GlassPanel key={media.id} className="p-4 flex flex-col justify-between group hover:border-cyan-500/30 transition-all">
                <div className="space-y-3">
                  {/* Thumbnail / Video Banner Preview */}
                  <div className="relative h-40 rounded-xl bg-void-900 border border-white/[0.08] overflow-hidden flex items-center justify-center group-hover:shadow-glow transition-all">
                    <div className="h-12 w-12 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                      <Film size={24} />
                    </div>

                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-white/[0.1]">
                      {formatFileSize(media.fileSize)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-silver truncate" title={media.title}>
                      {media.title}
                    </h3>
                    <p className="text-[11px] text-muted font-mono mt-0.5 truncate">
                      {media.originalFilename}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleDeleteMedia(media.id)}
                    className="p-2 rounded-xl text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Video"
                  >
                    <Trash2 size={15} />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedMediaId(media.id)
                      setRoomTitle(media.title + ' Watch Party')
                      setShowCreateModal(true)
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-glow transition-all"
                  >
                    <Play size={13} className="fill-current" />
                    <span>Watch in Room</span>
                  </button>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      )}

      {/* ===== 1. UPLOAD VIDEO MODAL ===== */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-lg p-6 border border-cyan-500/30 shadow-2xl relative flex flex-col gap-4 bg-void-950/95"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                    <Upload size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-silver">Upload Video for Streaming</h3>
                    <p className="text-[11px] text-muted">Upload an authorized MP4, WebM, or HLS video</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  className="p-1.5 rounded-lg text-muted hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] text-muted block mb-1 font-semibold">Video Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Product Demo Walkthrough, Team Retrospective..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-muted font-semibold">Select Video File</label>
                    <span className="text-[10px] text-cyan-400 font-mono">Max 5.0 GB • Direct S3 Upload</span>
                  </div>
                  <input
                    type="file"
                    required
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0]
                        const MAX_SIZE = 5 * 1024 * 1024 * 1024
                        if (file.size > MAX_SIZE) {
                          const sizeGb = (file.size / (1024 * 1024 * 1024)).toFixed(2)
                          showToast(`Selected file (${sizeGb} GB) exceeds 5 GB. Please choose a video up to 5 GB.`, 'warning')
                          e.target.value = ''
                          setUploadFile(null)
                          return
                        }
                        setUploadFile(file)
                        if (!uploadTitle) {
                          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
                        }
                      }
                    }}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30"
                  />
                  {uploadFile && (
                    <p className="text-[10px] text-muted font-mono mt-1 flex items-center justify-between">
                      <span className="truncate max-w-[240px]">{uploadFile.name}</span>
                      <span className="text-silver font-semibold">{formatFileSize(uploadFile.size)}</span>
                    </p>
                  )}
                </div>

                {/* Upload Progress Bar */}
                {isUploading && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted">Uploading & Processing...</span>
                      <span className="text-cyan-300 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden border border-white/[0.1]">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={isUploading}
                    className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-silver"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!uploadFile || isUploading}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Upload size={14} />
                    <span>{isUploading ? 'Uploading...' : 'Start Upload'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== 2. CREATE WATCH ROOM MODAL ===== */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-6 border border-cyan-500/30 shadow-2xl relative flex flex-col gap-4 bg-void-950/95"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-silver">Create Watch Room</h3>
                    <p className="text-[11px] text-muted">Generate private room & invite participants</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleCreateRoomSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] text-muted block mb-1 font-semibold">Select Video</label>
                  <select
                    value={selectedMediaId || ''}
                    onChange={(e) => setSelectedMediaId(Number(e.target.value))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                  >
                    {mediaList.map((m) => (
                      <option key={m.id} value={m.id} className="bg-void-950 text-silver">
                        {m.title} ({formatFileSize(m.fileSize)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted block mb-1 font-semibold">Room Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Friday Movie Night, Code Review Stream..."
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-silver focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-silver"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedMediaId || isCreatingRoom}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Play size={14} className="fill-current" />
                    <span>{isCreatingRoom ? 'Launching...' : 'Launch Watch Room'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== 3. JOIN WATCH ROOM MODAL ===== */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md p-6 border border-cyan-500/30 shadow-2xl relative flex flex-col gap-4 bg-void-950/95"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                    <Link2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-silver">Join Watch Room</h3>
                    <p className="text-[11px] text-muted">Enter 5-character code or paste shareable URL</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] text-muted block mb-1 font-semibold">Room Code or Link</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. nova-watch-7xk92 or full URL"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-silver focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-silver"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!joinCodeInput.trim()}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <span>Join Session</span>
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
