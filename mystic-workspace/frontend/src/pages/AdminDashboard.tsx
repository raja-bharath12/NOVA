import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Users,
  Film,
  MessageSquare,
  HardDrive,
  Cpu,
  Activity,
  Trash2,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  Check,
  X,
  Lock,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { adminService } from '../services/adminService'
import { MASTER_ADMIN_EMAIL } from '../services/authService'
import type { AdminStats, AdminRoomItem, AdminFileItem, User } from '../types'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'ROOMS' | 'FILES'>('OVERVIEW')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<AdminRoomItem[]>([])
  const [files, setFiles] = useState<AdminFileItem[]>([])

  // Search & Filter states
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL')
  const [processingUserId, setProcessingUserId] = useState<number | null>(null)
  const [processingRoomCode, setProcessingRoomCode] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    loadAllAdminData()
  }, [])

  async function loadAllAdminData() {
    try {
      setLoading(true)
      const [statsData, usersData, roomsData, filesData] = await Promise.all([
        adminService.getStats().catch(() => null),
        adminService.getUsers().catch(() => []),
        adminService.getRooms().catch(() => []),
        adminService.getFiles().catch(() => []),
      ])
      if (statsData) setStats(statsData)
      setUsers(usersData)
      setRooms(roomsData)
      setFiles(filesData)
    } catch (err: any) {
      showToast('Failed to load admin telemetry', 'warning')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function handleManualRefresh() {
    setRefreshing(true)
    loadAllAdminData()
  }

  async function handleToggleUserRole(targetUser: User) {
    const isCurrentlyAdmin = targetUser.role === 'ADMIN'
    const newRole = isCurrentlyAdmin ? 'USER' : 'ADMIN'

    if (targetUser.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      showToast('Cannot change role of Master Administrator', 'warning')
      return
    }

    try {
      setProcessingUserId(targetUser.id)
      const updated = await adminService.updateUserRole(targetUser.id, newRole)
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: updated.role } : u)))
      showToast(`${targetUser.name} role updated to ${newRole}!`, 'success')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update role', 'warning')
    } finally {
      setProcessingUserId(null)
    }
  }

  async function handleDeleteUser(targetUser: User) {
    if (targetUser.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      showToast('Cannot delete Master Administrator', 'warning')
      return
    }

    if (!window.confirm(`Are you sure you want to permanently delete user "${targetUser.name}" (@${targetUser.userTag || targetUser.email})?\n\nAll their data (messages, files, rooms, tasks) will be permanently erased and cannot be recovered.`)) {
      return
    }

    try {
      setProcessingUserId(targetUser.id)
      await adminService.deleteUser(targetUser.id)
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id))
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        next.delete(targetUser.id)
        return next
      })
      showToast(`User ${targetUser.name} and all associated data permanently deleted.`, 'info')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete user', 'warning')
    } finally {
      setProcessingUserId(null)
    }
  }

  function handleToggleSelectUser(userId: number) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${count} selected user account(s)?\n\nAll their messages, files, meetings, tasks, and room memberships will be permanently wiped from the database. This action CANNOT be recovered.`
      )
    ) {
      return
    }

    try {
      setBulkDeleting(true)
      const idsToDelete = Array.from(selectedUserIds)
      const res = await adminService.bulkDeleteUsers(idsToDelete)
      setUsers((prev) => prev.filter((u) => !selectedUserIds.has(u.id)))
      setSelectedUserIds(new Set())
      showToast(res.message || `Deleted ${count} users permanently.`, 'success')
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete selected users', 'warning')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleTerminateWatchRoom(roomCode: string) {
    if (!window.confirm(`Terminate watch room "${roomCode}"? All connected viewers will be disconnected.`)) {
      return
    }

    try {
      setProcessingRoomCode(roomCode)
      await adminService.terminateWatchRoom(roomCode)
      setRooms((prev) => prev.filter((r) => r.roomCode !== roomCode))
      showToast(`Watch room ${roomCode} terminated.`, 'info')
    } catch (err: any) {
      showToast('Failed to terminate watch room', 'warning')
    } finally {
      setProcessingRoomCode(null)
    }
  }

  async function handleDeleteFile(fileId: number) {
    if (!window.confirm('Delete this file metadata?')) return
    try {
      await adminService.deleteFile(fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      showToast('File deleted successfully.', 'info')
    } catch (err: any) {
      showToast('Failed to delete file', 'warning')
    }
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.userTag && u.userTag.toLowerCase().includes(userSearch.toLowerCase()))

    const matchRole =
      userRoleFilter === 'ALL' ||
      (userRoleFilter === 'ADMIN' && u.role === 'ADMIN') ||
      (userRoleFilter === 'USER' && u.role !== 'ADMIN')

    return matchSearch && matchRole
  })

  return (
    <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Banner & Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 sm:p-5 border border-violet-500/20 shadow-2xl rounded-3xl bg-void-950/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px] shadow-[0_0_24px_rgba(168,85,247,0.4)] flex-shrink-0">
            <div className="h-full w-full bg-void-950 rounded-[14px] flex items-center justify-center">
              <Shield size={24} className="text-cyan-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-display text-gradient tracking-tight">
                Admin Command Center
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-400/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                Root Access
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Logged in as <b className="text-silver font-mono">{user?.email}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>EC2 LIVE (15.207.247.33)</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-violet-500/20 text-muted hover:text-cyan-300 border border-white/[0.08] transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Refresh System Data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex rounded-2xl bg-void-900/90 p-1 border border-white/[0.08] flex-shrink-0">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'OVERVIEW'
              ? 'bg-gradient-to-r from-violet-600/60 via-fuchsia-600/50 to-cyan-600/60 text-silver shadow-glow border border-violet-400/40'
              : 'text-muted hover:text-silver'
          }`}
        >
          <Activity size={15} />
          <span>System Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'USERS'
              ? 'bg-gradient-to-r from-violet-600/60 via-fuchsia-600/50 to-cyan-600/60 text-silver shadow-glow border border-violet-400/40'
              : 'text-muted hover:text-silver'
          }`}
        >
          <Users size={15} />
          <span>User Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ROOMS'
              ? 'bg-gradient-to-r from-violet-600/60 via-fuchsia-600/50 to-cyan-600/60 text-silver shadow-glow border border-violet-400/40'
              : 'text-muted hover:text-silver'
          }`}
        >
          <Film size={15} />
          <span>Watch & Meet Rooms ({rooms.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('FILES')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'FILES'
              ? 'bg-gradient-to-r from-violet-600/60 via-fuchsia-600/50 to-cyan-600/60 text-silver shadow-glow border border-violet-400/40'
              : 'text-muted hover:text-silver'
          }`}
        >
          <HardDrive size={15} />
          <span>Cloud Storage ({files.length})</span>
        </button>
      </div>

      {/* TAB CONTENT CONTAINER */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Registered Users</span>
                  <Users size={16} className="text-violet-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-silver">
                  {stats ? stats.totalUsers : users.length}
                </div>
                <div className="text-[10px] text-muted mt-1">Active on Mystic DB</div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Watch Rooms</span>
                  <Film size={16} className="text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-300">
                  {stats ? stats.totalWatchRooms : rooms.length}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  {stats ? `${stats.activeWatchRooms} Active Now` : 'Streaming'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Chat Messages</span>
                  <MessageSquare size={16} className="text-fuchsia-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-silver">
                  {stats ? stats.totalMessages : 0}
                </div>
                <div className="text-[10px] text-muted mt-1">Direct & Group chats</div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Cloud Media Files</span>
                  <HardDrive size={16} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-silver">
                  {stats ? stats.totalFiles : files.length}
                </div>
                <div className="text-[10px] text-muted mt-1">AWS S3 & Local store</div>
              </div>
            </div>

            {/* Server Memory & JVM Telemetry */}
            <div className="glass-panel p-5 border border-white/[0.08] rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-cyan-400" />
                  <h3 className="font-display font-semibold text-sm text-silver">
                    EC2 JVM Memory & Compute Metrics
                  </h3>
                </div>
                <span className="text-xs font-mono text-cyan-300">
                  {stats ? `${stats.availableProcessors} CPU Cores` : '2 Cores'}
                </span>
              </div>

              {stats && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      Allocated Heap: <b className="text-silver">{stats.totalMemoryMB} MB</b>
                    </span>
                    <span>
                      Free Heap: <b className="text-emerald-400">{stats.freeMemoryMB} MB</b> / Max:{' '}
                      <b className="text-silver">{stats.maxMemoryMB} MB</b>
                    </span>
                  </div>
                  <div className="w-full bg-void-900 h-2.5 rounded-full overflow-hidden border border-white/[0.06]">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, ((stats.totalMemoryMB - stats.freeMemoryMB) / stats.totalMemoryMB) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Admin Policy Summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-900/20 via-fuchsia-900/15 to-cyan-900/20 border border-violet-500/20 text-xs space-y-2">
              <div className="font-semibold text-silver flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <span>Super Administrator Governance</span>
              </div>
              <p className="text-muted leading-relaxed">
                As the master administrator (<code className="text-cyan-300 font-mono">{MASTER_ADMIN_EMAIL}</code>),
                you possess global authority to promote team members to Admin, terminate active streams, manage AWS S3
                video uploads, and moderate discussions across NOVA.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: USER DIRECTORY */}
        {activeTab === 'USERS' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search by name, email, or @username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-cyan-400/50"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setUserRoleFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    userRoleFilter === 'ALL'
                      ? 'bg-violet-600/40 text-silver border border-violet-400/30'
                      : 'bg-white/[0.02] text-muted hover:text-silver'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserRoleFilter('ADMIN')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    userRoleFilter === 'ADMIN'
                      ? 'bg-violet-600/40 text-silver border border-violet-400/30'
                      : 'bg-white/[0.02] text-muted hover:text-silver'
                  }`}
                >
                  Admins ({users.filter((u) => u.role === 'ADMIN').length})
                </button>
                <button
                  onClick={() => setUserRoleFilter('USER')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    userRoleFilter === 'USER'
                      ? 'bg-violet-600/40 text-silver border border-violet-400/30'
                      : 'bg-white/[0.02] text-muted hover:text-silver'
                  }`}
                >
                  Users ({users.filter((u) => u.role !== 'ADMIN').length})
                </button>
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            <AnimatePresence>
              {selectedUserIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 via-void-900 to-rose-950/80 border border-rose-500/40 shadow-[0_0_24px_rgba(244,63,94,0.2)]"
                >
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-rose-200">
                    <div className="h-7 w-7 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
                      <AlertTriangle size={15} />
                    </div>
                    <div>
                      <span className="font-bold text-white">{selectedUserIds.size}</span> user
                      {selectedUserIds.size > 1 ? 's' : ''} selected for permanent deletion
                      <p className="text-[10px] text-rose-300/80 font-normal">
                        All chats, files, stream memberships & accounts will be wiped permanently.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setSelectedUserIds(new Set())}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-muted hover:text-silver text-xs font-medium transition-all"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md shadow-rose-950/50 hover:shadow-rose-500/30 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={13} className={bulkDeleting ? 'animate-spin' : ''} />
                      <span>
                        {bulkDeleting
                          ? 'Deleting...'
                          : `Permanently Delete Selected (${selectedUserIds.size})`}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Users Table */}
            <div className="glass-panel border border-white/[0.08] rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-void-900/80 text-muted uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredUsers.filter(
                              (u) => u.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()
                            ).length > 0 &&
                            filteredUsers
                              .filter(
                                (u) => u.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()
                              )
                              .every((u) => selectedUserIds.has(u.id))
                          }
                          onChange={() => {
                            const eligible = filteredUsers.filter(
                              (u) => u.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()
                            )
                            const isAllSelected =
                              eligible.length > 0 &&
                              eligible.every((u) => selectedUserIds.has(u.id))

                            if (isAllSelected) {
                              setSelectedUserIds(new Set())
                            } else {
                              setSelectedUserIds(new Set(eligible.map((u) => u.id)))
                            }
                          }}
                          className="rounded bg-void-950 border-white/20 text-violet-500 focus:ring-violet-400 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-violet-600"
                          title="Select All Eligible Users"
                        />
                      </th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">@Username</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Joined</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredUsers.map((u) => {
                      const isMaster = u.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()
                      const isAdmin = u.role === 'ADMIN'
                      const isSelected = selectedUserIds.has(u.id)

                      return (
                        <tr
                          key={u.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-rose-500/10' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-3 px-3 w-10 text-center">
                            {!isMaster ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectUser(u.id)}
                                className="rounded bg-void-950 border-white/20 text-rose-500 focus:ring-rose-400 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-rose-600"
                              />
                            ) : (
                              <div className="flex items-center justify-center" title="Master Root Admin Protected">
                                <Lock
                                  size={13}
                                  className="text-muted/40"
                                />
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 p-[1.5px] flex-shrink-0">
                                <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center font-bold text-xs text-silver">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </div>
                              </div>
                              <span className="font-semibold text-silver">{u.name}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono text-cyan-300">
                            @{u.userTag ? u.userTag.toLowerCase() : 'user'}
                          </td>

                          <td className="py-3 px-4 text-muted">{u.email}</td>

                          <td className="py-3 px-4">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-300 font-bold text-[10px]">
                                <Shield size={10} />
                                <span>ADMIN</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-muted text-[10px]">
                                USER
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-muted">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isMaster && (
                                <>
                                  <button
                                    onClick={() => handleToggleUserRole(u)}
                                    disabled={processingUserId === u.id}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                      isAdmin
                                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                        : 'bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-400/30'
                                    }`}
                                  >
                                    {isAdmin ? 'Demote' : 'Promote Admin'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={processingUserId === u.id}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 transition-all"
                                    title="Delete User Permanently"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                              {isMaster && (
                                <span className="text-[10px] font-mono text-muted/60 italic">
                                  Root Owner
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WATCH ROOMS & MEETINGS */}
        {activeTab === 'ROOMS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-silver">Active Streams & Collaboration Sessions</h3>
            </div>

            {rooms.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted glass-panel rounded-3xl border border-white/[0.06]">
                No active Watch Together or Meeting rooms running at the moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.roomCode}
                    className="glass-panel p-4 rounded-2xl border border-white/[0.08] flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                          {room.type}
                        </span>
                        <h4 className="font-bold text-sm text-silver">{room.title}</h4>
                      </div>
                      <span className="text-xs font-mono text-muted">{room.roomCode}</span>
                    </div>

                    <div className="text-xs text-muted flex items-center justify-between">
                      <span>Host: <b className="text-silver">{room.hostName}</b></span>
                      <span>Members: <b className="text-cyan-300">{room.memberCount}</b></span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      <span className="text-[10px] text-muted">
                        Started: {new Date(room.createdAt).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleTerminateWatchRoom(room.roomCode)}
                        disabled={processingRoomCode === room.roomCode}
                        className="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all flex items-center gap-1"
                      >
                        <AlertTriangle size={12} />
                        <span>Force Terminate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLOUD STORAGE & FILES */}
        {activeTab === 'FILES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-silver">Shared & Uploaded Files</h3>
            </div>

            {files.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted glass-panel rounded-3xl border border-white/[0.06]">
                No files uploaded yet.
              </div>
            ) : (
              <div className="glass-panel border border-white/[0.08] rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-void-900/80 text-muted uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4">Filename</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Storage</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {files.map((file) => (
                        <tr key={file.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-medium text-silver">{file.filename}</td>
                          <td className="py-3 px-4 font-mono text-cyan-300">
                            {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono">
                              {file.storageType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted">{file.ownerName}</td>
                          <td className="py-3 px-4 text-muted">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition-colors"
                              title="Delete File"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
