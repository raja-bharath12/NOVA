import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Send,
  Paperclip,
  Phone,
  Video,
  Info,
  X,
  Reply,
  Edit2,
  Trash2,
  Check,
  CheckCheck,
  FileText,
  Download,
  Image as ImageIcon,
  Film,
  Users,
  MessageSquare,
  Sparkles,
  Copy,
  Share2,
  Link as LinkIcon,
  Hash,
  UserCheck,
  UserPlus,
  Clock,
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  AtSign,
  Smile,
  Shield,
  Circle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import { useToast } from '../context/ToastContext'
import { generateFallbackTag } from '../services/authService'
import { chatService } from '../services/chatService'
import { connectionService } from '../services/connectionService'
import { fileService } from '../services/fileService'
import { websocketService } from '../services/websocketService'
import type { Conversation, Message, User, UserConnection, TypingEvent } from '../types'

export default function Chat() {
  const { user } = useAuth()
  const { initiateCall, onlineUserIds } = useCall()
  const { showToast } = useToast()
  const { userTag: deepLinkTag } = useParams<{ userTag?: string }>()
  const navigate = useNavigate()

  const effectiveTag = user?.userTag || (user ? generateFallbackTag(user.id, user.email) : '')

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)

  // Messages State
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())

  // Attachments State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // UI Panels State
  const [showRightPane, setShowRightPane] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatTab, setNewChatTab] = useState<'USERS' | 'GROUP' | 'TAG'>('USERS')
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  // Connection Workflow State
  const [incomingRequests, setIncomingRequests] = useState<UserConnection[]>([])
  const [userSearchText, setUserSearchText] = useState('')
  const [connectingUserId, setConnectingUserId] = useState<number | null>(null)
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // User Handle Modal State
  const [tagInput, setTagInput] = useState('')
  const [lookedUpUser, setLookedUpUser] = useState<User | null>(null)
  const [tagSearching, setTagSearching] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  // Clipboard feedback state
  const [copiedTag, setCopiedTag] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialDesktopLoadDone = useRef(false)

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
    loadWorkspaceUsers('')
  }, [])

  // Handle direct chat deep link via /chat/u/:userTag
  useEffect(() => {
    if (deepLinkTag) {
      handleOpenConversationByTag(deepLinkTag)
    }
  }, [deepLinkTag])

  async function handleOpenConversationByTag(tag: string) {
    try {
      const conv = await chatService.createDirectConversationByTag(tag)
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
      setSelectedConversation(conv)
      showToast(`Connected with ${conv.title}!`, 'success')
      navigate('/chat', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not find user with that @username or Link.'
      showToast(msg, 'warning')
    }
  }

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  async function loadConversations(silent = false) {
    try {
      if (!silent) setLoadingConversations(true)
      const data = await chatService.getConversations()
      setConversations(data)
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
      if (data.length > 0 && !selectedConversation && isDesktop && !initialDesktopLoadDone.current) {
        setSelectedConversation(data[0])
        initialDesktopLoadDone.current = true
      }
    } catch (err) {
      console.error('Failed to load conversations', err)
    } finally {
      if (!silent) setLoadingConversations(false)
    }
  }

  // Subscribe to real-time conversation events and add fallback polling
  useEffect(() => {
    if (!selectedConversation) return

    setLoadingMessages(true)
    chatService
      .getMessages(selectedConversation.id)
      .then((msgs) => {
        setMessages(msgs)
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1]
          chatService.markAsRead(selectedConversation.id, lastMsg.id)
        }
      })
      .finally(() => setLoadingMessages(false))

    // Subscribe to STOMP topic for active conversation
    const unsub = websocketService.subscribeToConversation(
      selectedConversation.id,
      (newMsg: Message) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === newMsg.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = newMsg
            return updated
          }
          return [...prev, newMsg]
        })

        // Update conversation last message in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: newMsg, updatedAt: newMsg.createdAt }
              : c
          )
        )

        // Mark as read if from someone else
        if (user && newMsg.sender.id !== user.id) {
          chatService.markAsRead(selectedConversation.id, newMsg.id)
        }
      },
      (typing: TypingEvent) => {
        if (user && typing.userId !== user.id) {
          setTypingUsers((prev) => {
            const next = new Set(prev)
            if (typing.isTyping) {
              next.add(typing.userName)
            } else {
              next.delete(typing.userName)
            }
            return next
          })
        }
      },
      (receipt) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === receipt.messageId
              ? {
                  ...m,
                  readByUserIds: Array.from(new Set([...m.readByUserIds, receipt.userId])),
                  isRead: true,
                }
              : m
          )
        )
      }
    )

    // Resilient background sync interval (checks every 2.5s)
    const syncTimer = setInterval(async () => {
      try {
        const latestMsgs = await chatService.getMessages(selectedConversation.id)
        setMessages((prev) => {
          if (
            latestMsgs.length !== prev.length ||
            (latestMsgs.length > 0 &&
              latestMsgs[latestMsgs.length - 1].id !== prev[prev.length - 1]?.id)
          ) {
            return latestMsgs
          }
          return prev
        })
      } catch {
        // Silent sync
      }
    }, 2500)

    return () => {
      unsub()
      clearInterval(syncTimer)
    }
  }, [selectedConversation?.id])

  // Periodic conversations list refresh
  useEffect(() => {
    const listTimer = setInterval(() => {
      loadConversations(true)
    }, 4000)

    const unsubWS = websocketService.onConnectionChange((connected) => {
      if (connected) {
        loadConversations(true)
      }
    })

    return () => {
      clearInterval(listTimer)
      unsubWS()
    }
  }, [])

  async function loadWorkspaceUsers(query = '') {
    try {
      setLoadingUsers(true)
      const [users, requests] = await Promise.all([
        connectionService.searchUsers(query),
        connectionService.getIncomingRequests(),
      ])
      setWorkspaceUsers(users)
      setIncomingRequests(requests)
    } catch (err) {
      console.error('Failed to load workspace users with connections', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function openNewChatModal() {
    setShowNewChatModal(true)
    setNewChatTab('USERS')
    setUserSearchText('')
    setTagInput('')
    setLookedUpUser(null)
    setTagError(null)
    setSelectedUserIds([])
    setNewGroupTitle('')
    await loadWorkspaceUsers('')
  }

  function handleUserSearchChange(text: string) {
    setUserSearchText(text)
    loadWorkspaceUsers(text)
  }

  async function handleSendConnectionRequest(targetUser: User) {
    try {
      setConnectingUserId(targetUser.id)
      await connectionService.sendRequest(targetUser.id)
      showToast(`Connection request sent to ${targetUser.name}!`, 'success')
      setWorkspaceUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, connectionStatus: 'PENDING_SENT' } : u))
      )
      if (lookedUpUser && lookedUpUser.id === targetUser.id) {
        setLookedUpUser({ ...lookedUpUser, connectionStatus: 'PENDING_SENT' })
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send connection request.'
      showToast(msg, 'warning')
    } finally {
      setConnectingUserId(null)
    }
  }

  async function handleAcceptRequest(connectionId: number, requesterName: string, requesterId?: number) {
    try {
      setProcessingRequestId(connectionId)
      await connectionService.acceptRequest(connectionId)
      showToast(`You are now connected with ${requesterName}!`, 'success')
      setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId))
      setWorkspaceUsers((prev) =>
        prev.map((u) =>
          u.connectionId === connectionId || (requesterId && u.id === requesterId)
            ? { ...u, connectionStatus: 'CONNECTED' }
            : u
        )
      )
      if (lookedUpUser && (lookedUpUser.connectionId === connectionId || (requesterId && lookedUpUser.id === requesterId))) {
        setLookedUpUser({ ...lookedUpUser, connectionStatus: 'CONNECTED' })
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to accept connection request.'
      showToast(msg, 'warning')
    } finally {
      setProcessingRequestId(null)
    }
  }

  async function handleDeclineRequest(connectionId: number) {
    try {
      setProcessingRequestId(connectionId)
      await connectionService.declineRequest(connectionId)
      showToast('Connection request declined.', 'info')
      setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId))
      setWorkspaceUsers((prev) =>
        prev.map((u) =>
          u.connectionId === connectionId
            ? { ...u, connectionStatus: 'NONE', connectionId: undefined }
            : u
        )
      )
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to decline request.'
      showToast(msg, 'warning')
    } finally {
      setProcessingRequestId(null)
    }
  }

  async function handleStartChatWithUser(targetUser: User) {
    try {
      const conv = await chatService.createDirectConversation(targetUser.id)
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
      setSelectedConversation(conv)
      setShowNewChatModal(false)
      showToast(`Chat started with ${targetUser.name}!`, 'success')
    } catch {
      showToast('Could not start conversation.', 'warning')
    }
  }

  function handleCopyTag() {
    if (!effectiveTag) return
    navigator.clipboard.writeText(`@${effectiveTag.toLowerCase()}`)
    setCopiedTag(true)
    showToast(`@${effectiveTag.toLowerCase()} copied to clipboard!`, 'success')
    setTimeout(() => setCopiedTag(false), 2000)
  }

  function handleCopyLink() {
    if (!effectiveTag) return
    const link = `${window.location.origin}/chat/u/${effectiveTag.toLowerCase()}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    showToast('Direct Chat Link copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleLookupTag(rawInput: string) {
    const trimmed = (rawInput || '').trim()
    setTagInput(trimmed)
    setTagError(null)
    setLookedUpUser(null)

    if (!trimmed) return

    let tag = trimmed
    if (trimmed.includes('/chat/u/')) {
      const parts = trimmed.split('/chat/u/')
      tag = parts[parts.length - 1].split('?')[0].split('/')[0]
    }

    tag = tag.replace(/^[@\s]+/, '').replace(/[@\s]+$/, '').trim().toLowerCase()

    if (!tag) return

    if (effectiveTag && tag === effectiveTag.toLowerCase()) {
      setTagError('This is your own @username!')
      return
    }

    try {
      setTagSearching(true)
      const foundUser = await chatService.lookupUserByTag(tag)
      try {
        const users = await connectionService.searchUsers(foundUser.userTag || foundUser.email)
        const matched = users.find((u) => u.id === foundUser.id)
        setLookedUpUser(matched || foundUser)
      } catch {
        setLookedUpUser(foundUser)
      }
    } catch {
      setTagError(`No active user found with @username: ${tag}`)
    } finally {
      setTagSearching(false)
    }
  }

  async function handleCreateGroupConversation() {
    if (selectedUserIds.length === 0 || !newGroupTitle.trim()) return
    try {
      const group = await chatService.createGroupConversation(newGroupTitle.trim(), selectedUserIds)
      setConversations((prev) => [group, ...prev])
      setSelectedConversation(group)
      setShowNewChatModal(false)
      showToast(`Group "${newGroupTitle}" created!`, 'success')
    } catch {
      showToast('Failed to create group.', 'warning')
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedConversation || (!inputText.trim() && selectedFiles.length === 0)) return

    if (editingMessage) {
      const updated = await chatService.editMessage(editingMessage.id, inputText.trim())
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      setEditingMessage(null)
      setInputText('')
      return
    }

    try {
      let attachmentIds: number[] = []

      if (selectedFiles.length > 0) {
        setUploadingFiles(true)
        for (const f of selectedFiles) {
          const res = await fileService.uploadFile(f, selectedConversation.id, false, (p) => {
            setUploadProgress(p)
          })
          attachmentIds.push(res.id)
        }
      }

      const sentMsg = await chatService.sendMessage(
        selectedConversation.id,
        inputText.trim() || undefined,
        replyingTo ? replyingTo.id : undefined,
        attachmentIds.length > 0 ? attachmentIds : undefined
      )

      if (sentMsg) {
        setMessages((prev) => (prev.some((m) => m.id === sentMsg.id) ? prev : [...prev, sentMsg]))
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: sentMsg, updatedAt: sentMsg.createdAt }
              : c
          )
        )
      }

      setInputText('')
      setReplyingTo(null)
      setSelectedFiles([])
      setUploadProgress(0)
    } catch (err) {
      console.error('Failed to send message', err)
      showToast('Failed to send message.', 'warning')
    } finally {
      setUploadingFiles(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputText(e.target.value)
    if (selectedConversation) {
      websocketService.sendTypingDebounced(selectedConversation.id)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  async function handleDeleteMessage(msgId: number) {
    await chatService.deleteMessage(msgId)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m
      )
    )
  }

  function startCall(isVideo: boolean) {
    if (!selectedConversation || !user) return
    const recipient = selectedConversation.members.find((m) => m.id !== user.id)
    if (recipient) {
      initiateCall(recipient.id, recipient.name, isVideo)
    }
  }

  const isUserOnline = (userId?: number) => {
    if (!userId) return false
    return onlineUserIds.has(userId)
  }

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Format message date divider helper
  const getMessageDateHeader = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex flex-1 h-full max-h-full w-full gap-0 sm:gap-3 overflow-hidden relative min-h-0">
      {/* ===== LEFT PANE: WhatsApp / Instagram Direct Sidebar ===== */}
      <div
        className={`flex-col w-full md:w-84 lg:w-96 glass-panel border border-white/[0.08] overflow-hidden flex-shrink-0 h-full min-h-0 bg-void-950/70 backdrop-blur-xl ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Instagram Direct Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0 bg-void-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px] shadow-sm flex-shrink-0">
              <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center text-xs font-bold text-silver">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm text-silver truncate">{user?.name || 'My Messages'}</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-cyan-300 truncate">
                  @{effectiveTag ? effectiveTag.toLowerCase() : 'user'}
                </span>
                <button
                  onClick={handleCopyTag}
                  title="Copy your @username"
                  className="p-0.5 text-muted hover:text-cyan-300 transition-colors"
                >
                  {copiedTag ? <Check size={11} className="text-cyan-400" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyLink}
              title="Copy direct invite link"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20 text-muted hover:text-cyan-300 border border-white/[0.06] transition-all"
            >
              {copiedLink ? <Check size={14} className="text-cyan-400" /> : <Share2 size={14} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openNewChatModal}
              title="New Chat or Group"
              className="h-8 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-void-950 font-bold text-xs flex items-center gap-1 shadow-glow transition-all"
            >
              <Plus size={14} />
              <span>New</span>
            </motion.button>
          </div>
        </div>

        {/* Instagram Direct: Stories / Active Contacts Bar */}
        <div className="px-3.5 py-2.5 border-b border-white/[0.04] flex-shrink-0 overflow-x-auto no-scrollbar bg-white/[0.01]">
          <div className="flex items-center gap-3">
            {/* Story Button: Start New / My Profile */}
            <div
              onClick={openNewChatModal}
              className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
            >
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-dashed border-violet-400/40 group-hover:border-cyan-400/70 p-0.5 flex items-center justify-center transition-all">
                  <div className="h-full w-full bg-void-900 rounded-full flex items-center justify-center text-silver">
                    <Plus size={16} className="text-violet-300 group-hover:text-cyan-300 transition-colors" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted group-hover:text-silver transition-colors">Direct</span>
            </div>

            {/* Teammates Active Stories */}
            {workspaceUsers.slice(0, 10).map((u) => {
              const online = isUserOnline(u.id)
              return (
                <div
                  key={u.id}
                  onClick={() => handleStartChatWithUser(u)}
                  className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
                  title={`Chat with ${u.name} (@${u.userTag || 'user'})`}
                >
                  <div className="relative">
                    <div
                      className={`h-12 w-12 rounded-full p-[2px] transition-all ${
                        online
                          ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                          : 'border border-white/[0.15] bg-void-900/60'
                      }`}
                    >
                      <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center text-xs font-bold text-silver group-hover:scale-95 transition-transform">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    {online && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-void-950 shadow-sm" />
                    )}
                  </div>
                  <span className="text-[10px] text-silver/80 group-hover:text-cyan-300 truncate max-w-[54px]">
                    {u.name.split(' ')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* WhatsApp Style Search Bar */}
        <div className="p-3 border-b border-white/[0.04] flex-shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-muted" />
            <input
              type="text"
              placeholder="Search or start new chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-1.5 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50 transition-all"
            />
          </div>
        </div>

        {/* WhatsApp & Instagram Direct Hybrid Conversations List */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.02]">
          {loadingConversations ? (
            <div className="p-6 text-center text-xs text-muted">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No conversations yet. Tap + to start chatting!
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id
              const otherUser = conv.members.find((m) => m.id !== user?.id)
              const online = conv.type === 'DIRECT' && isUserOnline(otherUser?.id)
              const isLastMsgOwn = conv.lastMessage && user && conv.lastMessage.sender.id === user.id

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`flex items-center gap-3 p-3 sm:p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-violet-600/[0.18] border-l-3 border-violet-400 shadow-inner'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`h-11 w-11 rounded-full flex items-center justify-center font-display font-bold text-xs text-silver border ${
                        online
                          ? 'border-emerald-400/50 bg-gradient-to-br from-violet-600/50 via-fuchsia-600/40 to-cyan-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                          : 'border-white/[0.1] bg-void-900'
                      }`}
                    >
                      {conv.type === 'DIRECT'
                        ? conv.title.slice(0, 2).toUpperCase()
                        : <Users size={18} className="text-cyan-400" />}
                    </div>
                    {conv.type === 'DIRECT' && online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-void-950" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-sm font-semibold text-silver truncate">{conv.title}</h4>
                        {conv.type === 'DIRECT' && otherUser?.userTag && (
                          <span className="text-[10px] font-mono text-muted/70 truncate hidden sm:inline">
                            @{otherUser.userTag.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-muted whitespace-nowrap ml-2">
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 text-xs text-muted truncate">
                        {isLastMsgOwn && (
                          <span className="text-cyan-400 flex-shrink-0">
                            {conv.lastMessage?.isRead ? (
                              <CheckCheck size={14} className="text-cyan-400 inline" />
                            ) : (
                              <Check size={14} className="text-muted inline" />
                            )}
                          </span>
                        )}
                        <p className="truncate">
                          {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-500 text-void-950 text-[10px] font-bold flex items-center justify-center ml-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ===== CENTER PANE: WhatsApp / Instagram Direct Chat Stream ===== */}
      <div
        className={`flex-1 flex-col glass-panel border border-white/[0.08] overflow-hidden min-w-0 min-h-0 h-full bg-void-950/80 backdrop-blur-xl relative ${
          !selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <>
            {/* Instagram / WhatsApp Style Chat Header */}
            <div className="flex-shrink-0 px-3.5 sm:px-5 py-3 border-b border-white/[0.08] bg-void-950/90 backdrop-blur-md flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-1.5 -ml-1 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                  title="Back to Conversations"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="relative flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px]">
                    <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center font-display font-bold text-xs text-silver">
                      {selectedConversation.type === 'DIRECT'
                        ? selectedConversation.title.slice(0, 2).toUpperCase()
                        : <Users size={17} className="text-cyan-400" />}
                    </div>
                  </div>
                  {selectedConversation.type === 'DIRECT' && (
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-void-950 ${
                        isUserOnline(selectedConversation.members.find((m) => m.id !== user?.id)?.id)
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                          : 'bg-muted/40'
                      }`}
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-silver truncate">
                    {selectedConversation.title}
                  </h3>
                  <p className="text-[11px] text-muted flex items-center gap-1.5 truncate">
                    {selectedConversation.type === 'DIRECT' ? (
                      <>
                        <span className="font-mono text-cyan-300">
                          @{selectedConversation.members.find((m) => m.id !== user?.id)?.userTag?.toLowerCase() || 'user'}
                        </span>
                        <span>•</span>
                        <span className={isUserOnline(selectedConversation.members.find((m) => m.id !== user?.id)?.id) ? 'text-emerald-400 font-medium' : 'text-muted'}>
                          {isUserOnline(selectedConversation.members.find((m) => m.id !== user?.id)?.id) ? 'Active now' : 'Offline'}
                        </span>
                      </>
                    ) : (
                      `${selectedConversation.members.length} members`
                    )}
                  </p>
                </div>
              </div>

              {/* Call & Info Action Icons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {selectedConversation.type === 'DIRECT' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => startCall(false)}
                      className="h-9 w-9 rounded-xl bg-white/[0.04] hover:bg-violet-500/20 text-muted hover:text-lavender border border-white/[0.06] flex items-center justify-center transition-all"
                      title="Start Voice Call"
                    >
                      <Phone size={16} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => startCall(true)}
                      className="h-9 w-9 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20 text-muted hover:text-cyan-300 border border-white/[0.06] flex items-center justify-center transition-all"
                      title="Start Video Call"
                    >
                      <Video size={16} />
                    </motion.button>
                  </>
                )}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowRightPane(!showRightPane)}
                  className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all ${
                    showRightPane
                      ? 'bg-violet-500/20 text-lavender border-violet-400/40'
                      : 'bg-white/[0.04] text-muted hover:text-lavender border-white/[0.06]'
                  }`}
                  title="Conversation Details"
                >
                  <Info size={16} />
                </motion.button>
              </div>
            </div>

            {/* WhatsApp Doodle Wallpaper & Message Stream */}
            <div
              className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 relative"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.04) 0%, rgba(6, 182, 212, 0.02) 100%)',
              }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-muted">
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px] mb-3 shadow-[0_0_24px_rgba(168,85,247,0.3)] flex items-center justify-center">
                    <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center">
                      <Sparkles size={24} className="text-cyan-300 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm text-silver font-semibold">
                    Say hi to {selectedConversation.title}!
                  </p>
                  <p className="text-xs text-muted mt-1 max-w-xs">
                    Encrypted real-time messaging, file sharing, and voice/video calling.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = Boolean(
                    user && (
                      (user.id != null && Number(msg.sender?.id) === Number(user.id)) ||
                      (user.email && msg.sender?.email && msg.sender.email.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
                      (user.userTag && msg.sender?.userTag && msg.sender.userTag.trim().toLowerCase() === user.userTag.trim().toLowerCase())
                    )
                  )

                  // Date header calculation
                  const showDateDivider =
                    index === 0 ||
                    getMessageDateHeader(messages[index - 1].createdAt) !== getMessageDateHeader(msg.createdAt)

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="flex justify-center my-3">
                          <span className="px-3 py-1 rounded-full bg-void-900/90 border border-white/[0.08] text-[11px] font-medium text-muted/90 shadow-sm">
                            {getMessageDateHeader(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        className={`w-full flex ${isOwn ? 'justify-end' : 'justify-start'} my-1 group`}
                      >
                        <div
                          className={`flex items-end gap-2 max-w-[88%] sm:max-w-md lg:max-w-xl ${
                            isOwn ? 'flex-row-reverse' : 'flex-row'
                          }`}
                        >
                          {/* Avatar for incoming message in Group */}
                          {!isOwn && (
                            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-500 p-[1.5px] flex-shrink-0 mb-0.5">
                              <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center text-[10px] font-bold text-silver">
                                {msg.sender.name ? msg.sender.name.slice(0, 2).toUpperCase() : '??'}
                              </div>
                            </div>
                          )}

                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                            {/* Sender Name in group chats */}
                            {!isOwn && selectedConversation.type === 'GROUP' && (
                              <span className="text-[11px] font-semibold text-cyan-400 ml-2 mb-0.5">
                                {msg.sender.name}
                              </span>
                            )}

                            <div className="relative group/bubble max-w-full">
                              {/* WhatsApp / Instagram Message Hover Action Bar */}
                              <div
                                className={`absolute -top-7 ${
                                  isOwn ? 'right-0' : 'left-0'
                                } hidden group-hover/bubble:flex items-center gap-1 bg-void-900/95 border border-white/[0.12] backdrop-blur-md rounded-xl px-2 py-0.5 shadow-xl z-10`}
                              >
                                <button
                                  onClick={() => setReplyingTo(msg)}
                                  className="p-1 hover:text-cyan-400 text-muted transition-colors"
                                  title="Reply"
                                >
                                  <Reply size={12} />
                                </button>
                                {isOwn && !msg.isDeleted && (
                                  <button
                                    onClick={() => {
                                      setEditingMessage(msg)
                                      setInputText(msg.content)
                                    }}
                                    className="p-1 hover:text-violet-400 text-muted transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                                {(isOwn || selectedConversation.userRole === 'ADMIN') && !msg.isDeleted && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1 hover:text-rose-400 text-muted transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>

                              {/* WhatsApp Reply Preview Quote */}
                              {msg.replyToContent && (
                                <div
                                  className={`text-xs px-3 py-1.5 rounded-t-xl mb-0.5 border-l-3 ${
                                    isOwn
                                      ? 'bg-violet-950/70 border-cyan-300 text-violet-100'
                                      : 'bg-void-950/80 border-violet-400 text-muted'
                                  }`}
                                >
                                  <span className={`font-semibold ${isOwn ? 'text-cyan-300' : 'text-violet-300'}`}>
                                    {msg.replyToSenderName}
                                  </span>
                                  : {msg.replyToContent}
                                </div>
                              )}

                              {/* WhatsApp Message Bubble with Corner Styling */}
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-[13.5px] sm:text-sm leading-relaxed shadow-md transition-all ${
                                  isOwn
                                    ? 'bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-700 text-white rounded-br-xs border border-violet-400/40 shadow-[0_4px_18px_rgba(124,58,237,0.35)]'
                                    : 'bg-void-900/95 text-slate-100 rounded-bl-xs border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
                                } ${msg.isDeleted ? 'italic opacity-60' : ''}`}
                              >
                                {/* File Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="space-y-2 mb-2">
                                    {msg.attachments.map((file) => {
                                      const isImg = file.mimeType.startsWith('image/')
                                      const isVid = file.mimeType.startsWith('video/')

                                      if (isImg) {
                                        return (
                                          <div key={file.id} className="rounded-xl overflow-hidden border border-white/[0.15] max-w-xs">
                                            <img
                                              src={fileService.getFileUrl(file.downloadUrl)}
                                              alt={file.originalFilename}
                                              className="w-full h-auto object-cover max-h-60"
                                            />
                                          </div>
                                        )
                                      }

                                      if (isVid) {
                                        return (
                                          <div key={file.id} className="rounded-xl overflow-hidden border border-white/[0.15] max-w-xs">
                                            <video
                                              src={fileService.getFileUrl(file.downloadUrl)}
                                              controls
                                              className="w-full max-h-60"
                                            />
                                          </div>
                                        )
                                      }

                                      return (
                                        <div
                                          key={file.id}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            fileService.downloadFile(file.id, file.originalFilename, file.downloadUrl)
                                          }}
                                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none group ${
                                            isOwn
                                              ? 'bg-white/10 border-white/20 hover:bg-white/15 text-white'
                                              : 'bg-void-950/70 border-white/[0.08] hover:border-violet-400/40 text-silver'
                                          }`}
                                          title={`Download ${file.originalFilename}`}
                                        >
                                          <FileText size={18} className={isOwn ? 'text-white' : 'text-cyan-400'} />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate group-hover:text-cyan-400 transition-colors">{file.originalFilename}</p>
                                            <p className={`text-[10px] ${isOwn ? 'text-violet-200' : 'text-muted'}`}>
                                              {(file.fileSize / 1024).toFixed(1)} KB
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              fileService.downloadFile(file.id, file.originalFilename, file.downloadUrl)
                                            }}
                                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                            title="Download file"
                                          >
                                            <Download size={14} className={isOwn ? 'text-white' : 'text-muted hover:text-lavender'} />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                                {/* WhatsApp Status Ticks & Timestamp */}
                                <div
                                  className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                                    isOwn ? 'text-violet-100/90' : 'text-muted'
                                  }`}
                                >
                                  {msg.isEdited && <span className="italic opacity-80">edited</span>}
                                  <span>
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {isOwn && (
                                    <span title={msg.isRead ? 'Read' : 'Delivered'} className="flex items-center">
                                      {msg.isRead ? (
                                        <CheckCheck size={14} className="text-cyan-300 font-bold" />
                                      ) : (
                                        <Check size={14} className="text-violet-200 font-bold" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator Bar */}
            {typingUsers.size > 0 && (
              <div className="flex-shrink-0 px-4 sm:px-6 py-1.5 text-xs text-cyan-400 flex items-center gap-2 bg-void-950/90 border-t border-white/[0.04]">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>{Array.from(typingUsers).join(', ')} is typing...</span>
              </div>
            )}

            {/* Reply / Edit Banner */}
            {(replyingTo || editingMessage) && (
              <div className="flex-shrink-0 px-4 sm:px-6 py-2 bg-void-900/95 border-t border-white/[0.06] flex items-center justify-between text-xs z-10">
                <div className="flex items-center gap-2 text-muted">
                  {replyingTo ? <Reply size={14} className="text-cyan-400" /> : <Edit2 size={14} className="text-violet-400" />}
                  <span>
                    {replyingTo ? (
                      <>
                        Replying to <b className="text-silver">{replyingTo.sender.name}</b>: {replyingTo.content}
                      </>
                    ) : (
                      <>Editing message...</>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null)
                    setEditingMessage(null)
                    setInputText('')
                  }}
                  className="text-muted hover:text-lavender"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Selected File Badges */}
            {selectedFiles.length > 0 && (
              <div className="flex-shrink-0 px-4 sm:px-6 py-2 bg-void-900/80 border-t border-white/[0.06] flex items-center gap-2 flex-wrap max-h-24 overflow-y-auto z-10">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-silver">
                    <Paperclip size={12} className="text-cyan-400" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted hover:text-rose-400 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {uploadingFiles && (
                  <span className="text-xs text-cyan-400 ml-2">Uploading {uploadProgress}%</span>
                )}
              </div>
            )}

            {/* WhatsApp / Instagram Style Input Composer */}
            <form
              onSubmit={handleSendMessage}
              className="flex-shrink-0 p-2.5 sm:p-3.5 border-t border-white/[0.08] bg-void-950/95 backdrop-blur-md flex items-center gap-2 sm:gap-3 z-10"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-lavender border border-white/[0.06] flex items-center justify-center transition-all flex-shrink-0"
                title="Attach files"
              >
                <Paperclip size={17} />
              </motion.button>

              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  placeholder={`Message ${selectedConversation.title}...`}
                  value={inputText}
                  onChange={handleInputChange}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2.5 text-xs sm:text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all"
                />
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!inputText.trim() && selectedFiles.length === 0}
                className="h-10 w-10 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 text-void-950 font-semibold flex items-center justify-center shadow-glow hover:opacity-95 disabled:opacity-40 transition-all flex-shrink-0"
              >
                <Send size={16} />
              </motion.button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-violet-600/40 via-fuchsia-500/30 to-cyan-400/30 border border-white/[0.1] flex items-center justify-center mb-4 shadow-glow">
              <MessageSquare size={30} className="text-cyan-300" />
            </div>
            <p className="text-base font-bold text-silver">Your Messages</p>
            <p className="text-xs text-muted mt-1 max-w-sm">
              Send private direct messages, share videos & documents, or start audio/video calls with teammates.
            </p>
            <button
              onClick={openNewChatModal}
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-void-950 font-bold text-xs shadow-glow hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Start a Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* ===== RIGHT PANE: Conversation Details & Shared Files ===== */}
      <AnimatePresence>
        {showRightPane && selectedConversation && (
          <>
            {/* Mobile Backdrop for slide-over drawer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRightPane(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />

            {/* Slide Drawer: fixed right on mobile, flex panel on desktop */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed lg:relative right-0 top-0 bottom-0 z-50 lg:z-auto flex flex-col w-80 max-w-[85vw] h-full glass-panel border-l lg:border border-white/[0.08] overflow-hidden flex-shrink-0 bg-void-950/95 lg:bg-void-950/80 shadow-2xl lg:shadow-none"
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-silver">Details</h3>
                <button onClick={() => setShowRightPane(false)} className="text-muted hover:text-lavender p-1 rounded-lg hover:bg-white/[0.04]">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 text-center border-b border-white/[0.06]">
                <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-[2px] mb-3 shadow-glow">
                  <div className="h-full w-full bg-void-950 rounded-full flex items-center justify-center font-display font-bold text-base text-silver">
                    {selectedConversation.type === 'DIRECT'
                      ? selectedConversation.title.slice(0, 2).toUpperCase()
                      : <Users size={24} className="text-cyan-400" />}
                  </div>
                </div>
                <h4 className="font-bold text-silver">{selectedConversation.title}</h4>
                <span className="label-tracked text-[10px] text-cyan-400">{selectedConversation.type} CHAT</span>
              </div>

              {/* Members Section */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h5 className="label-tracked text-xs text-lavender">Members ({selectedConversation.members.length})</h5>
                <div className="space-y-2">
                  {selectedConversation.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="h-8 w-8 rounded-full bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ${
                              isUserOnline(m.id) ? 'bg-emerald-400' : 'bg-muted/40'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-silver truncate block">{m.name}</span>
                          {m.userTag && (
                            <span className="text-[10px] font-mono text-cyan-300/80 truncate block">
                              @{m.userTag.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      {m.id === selectedConversation.createdBy?.id && (
                        <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== NEW CHAT MODAL ===== */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel w-full max-w-lg p-6 border border-violet-500/30 shadow-2xl rounded-3xl bg-void-950/95"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-silver flex items-center gap-2">
                    <span>New Direct Message</span>
                    {incomingRequests.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[10px] font-bold text-void-950">
                        {incomingRequests.length} pending
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted">Search by Name, Email, or @username handle</p>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1.5 rounded-xl bg-white/[0.04] text-muted hover:text-lavender transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Tab Switcher */}
              <div className="flex rounded-2xl bg-void-900 p-1 mb-4 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setNewChatTab('USERS')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    newChatTab === 'USERS'
                      ? 'bg-gradient-to-r from-violet-600/50 to-cyan-600/50 text-silver shadow-glow border border-violet-400/30'
                      : 'text-muted hover:text-silver'
                  }`}
                >
                  <Users size={13} />
                  <span>Teammates</span>
                  {incomingRequests.length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setNewChatTab('GROUP')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    newChatTab === 'GROUP'
                      ? 'bg-gradient-to-r from-violet-600/50 to-cyan-600/50 text-silver shadow-glow border border-violet-400/30'
                      : 'text-muted hover:text-silver'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Group Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewChatTab('TAG')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    newChatTab === 'TAG'
                      ? 'bg-gradient-to-r from-violet-600/50 to-cyan-600/50 text-silver shadow-glow border border-violet-400/30'
                      : 'text-muted hover:text-silver'
                  }`}
                >
                  <AtSign size={13} />
                  <span>@Username / Link</span>
                </button>
              </div>

              {/* TAB 1: BROWSE MEMBERS & CONNECT */}
              {newChatTab === 'USERS' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Search members by name, email, or @username..."
                      value={userSearchText}
                      onChange={(e) => handleUserSearchChange(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-cyan-400/50 transition-all"
                    />
                    {userSearchText && (
                      <button
                        onClick={() => handleUserSearchChange('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-silver"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Incoming Requests */}
                  {incomingRequests.length > 0 && (
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-cyan-900/20 border border-violet-500/30 shadow-glow space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="label-tracked text-[10px] text-cyan-300 flex items-center gap-1">
                          <Sparkles size={11} className="text-cyan-400 animate-pulse" />
                          Incoming Connection Requests ({incomingRequests.length})
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {incomingRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-void-950/60 border border-white/[0.06]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-void-950 flex-shrink-0">
                                {req.requester.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-silver truncate">
                                  {req.requester.name}
                                  {req.requester.userTag && (
                                    <span className="ml-1 text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                      @{req.requester.userTag.toLowerCase()}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted truncate">wants to chat with you</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              <button
                                type="button"
                                disabled={processingRequestId === req.id}
                                onClick={() => handleAcceptRequest(req.id, req.requester.name, req.requester.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-void-950 font-semibold text-[11px] flex items-center gap-1 shadow-glow transition-all disabled:opacity-50"
                              >
                                <Check size={12} />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                disabled={processingRequestId === req.id}
                                onClick={() => handleDeclineRequest(req.id)}
                                className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1 border border-rose-500/30 transition-all disabled:opacity-50"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users Directory */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {loadingUsers ? (
                      <div className="p-6 text-center text-xs text-muted flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        <span>Searching directory...</span>
                      </div>
                    ) : workspaceUsers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted">
                        {userSearchText ? 'No members found matching your search.' : 'No other members found.'}
                      </div>
                    ) : (
                      workspaceUsers.map((u) => {
                        const isOnline = isUserOnline(u.id)
                        const isConnected = u.connectionStatus === 'CONNECTED'
                        const isPendingSent = u.connectionStatus === 'PENDING_SENT'
                        const isPendingReceived = u.connectionStatus === 'PENDING_RECEIVED'

                        return (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span
                                  className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-void-950 ${
                                    isOnline ? 'bg-emerald-400' : 'bg-muted/40'
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-silver flex items-center gap-1.5 truncate">
                                  <span className="truncate">{u.name}</span>
                                  {u.userTag && (
                                    <span className="text-[10px] font-mono text-cyan-300/90 flex-shrink-0">
                                      @{u.userTag.toLowerCase()}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted truncate">{u.email}</p>
                              </div>
                            </div>

                            <div className="flex-shrink-0 ml-2">
                              {isConnected ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartChatWithUser(u)}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 hover:from-violet-400 hover:to-cyan-300 text-void-950 font-bold text-xs flex items-center gap-1.5 shadow-glow transition-all"
                                >
                                  <MessageSquare size={12} />
                                  <span>Chat</span>
                                </button>
                              ) : isPendingSent ? (
                                <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                                  <Clock size={11} className="animate-spin" />
                                  <span>Pending</span>
                                </div>
                              ) : isPendingReceived ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={processingRequestId === u.connectionId}
                                    onClick={() => handleAcceptRequest(u.connectionId!, u.name, u.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-void-950 font-semibold text-[11px] flex items-center gap-1 shadow-glow transition-all"
                                  >
                                    <Check size={11} />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingRequestId === u.connectionId}
                                    onClick={() => handleDeclineRequest(u.connectionId!)}
                                    className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1 border border-rose-500/30 transition-all"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={connectingUserId === u.id}
                                  onClick={() => handleSendConnectionRequest(u)}
                                  className="px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/30 text-silver hover:text-white font-medium text-xs flex items-center gap-1.5 shadow-glow transition-all disabled:opacity-50"
                                >
                                  {connectingUserId === u.id ? (
                                    <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                                  ) : (
                                    <UserPlus size={12} className="text-violet-300" />
                                  )}
                                  <span>Connect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewChatModal(false)}
                      className="px-4 py-2 rounded-xl text-xs text-muted hover:text-silver"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: GROUP CHAT */}
              {newChatTab === 'GROUP' && (
                <div className="space-y-3">
                  <div>
                    <label className="label-tracked block mb-1 text-xs">Group Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Project Mystic Core Team"
                      value={newGroupTitle}
                      onChange={(e) => setNewGroupTitle(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
                    />
                  </div>

                  <div>
                    <label className="label-tracked block mb-1 text-xs">Select Members ({selectedUserIds.length})</label>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {workspaceUsers.map((u) => {
                        const isSelected = selectedUserIds.includes(u.id)

                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedUserIds((prev) =>
                                prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                              )
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-violet-500/20 border border-violet-400/40'
                                : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-silver flex items-center gap-1.5">
                                  {u.name}
                                  {u.userTag && (
                                    <span className="text-[9px] font-mono px-1 rounded bg-white/[0.06] text-muted">
                                      @{u.userTag.toLowerCase()}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted">{u.email}</p>
                              </div>
                            </div>
                            {isSelected && <Check size={15} className="text-cyan-400" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewChatModal(false)}
                      className="px-4 py-2 rounded-xl text-xs text-muted hover:text-silver"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGroupConversation}
                      disabled={selectedUserIds.length === 0 || !newGroupTitle.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-bold text-xs shadow-glow disabled:opacity-40"
                    >
                      Create Group
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ENTER USERNAME / LINK */}
              {newChatTab === 'TAG' && (
                <div className="space-y-3 mb-2">
                  <div>
                    <label className="label-tracked block mb-1.5 text-xs">@Username or Direct Chat Link</label>
                    <div className="relative flex items-center">
                      <AtSign size={14} className="absolute left-3 text-muted" />
                      <input
                        type="text"
                        placeholder="e.g. ada_lovelace or paste chat link"
                        value={tagInput}
                        onChange={(e) => handleLookupTag(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2 text-sm text-silver font-mono placeholder:font-sans placeholder:text-muted focus:outline-none focus:border-cyan-400/50 transition-all lowercase"
                      />
                      {tagSearching && (
                        <div className="absolute right-3">
                          <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  {tagError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                      <X size={14} className="flex-shrink-0" />
                      <span>{tagError}</span>
                    </div>
                  )}

                  {lookedUpUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-400/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-void-950 font-display">
                          {lookedUpUser.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-silver flex items-center gap-1.5">
                            {lookedUpUser.name}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              @{lookedUpUser.userTag?.toLowerCase()}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted">{lookedUpUser.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartChatWithUser(lookedUpUser)}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 hover:from-violet-400 hover:to-cyan-300 text-void-950 font-bold text-xs flex items-center gap-1.5 shadow-glow transition-all"
                        >
                          <MessageSquare size={13} />
                          <span>Start Chat</span>
                        </button>

                        {lookedUpUser.connectionStatus === 'CONNECTED' ? (
                          <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1">
                            <UserCheck size={12} />
                            <span>Connected</span>
                          </div>
                        ) : lookedUpUser.connectionStatus === 'PENDING_SENT' ? (
                          <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[11px] flex items-center gap-1">
                            <Clock size={12} />
                            <span>Pending</span>
                          </div>
                        ) : lookedUpUser.connectionStatus === 'PENDING_RECEIVED' ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={processingRequestId === lookedUpUser.connectionId}
                              onClick={() =>
                                handleAcceptRequest(lookedUpUser.connectionId!, lookedUpUser.name, lookedUpUser.id)
                              }
                              className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-void-950 font-semibold text-xs flex items-center gap-1 shadow-glow transition-all"
                            >
                              <Check size={12} />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingRequestId === lookedUpUser.connectionId}
                              onClick={() => handleDeclineRequest(lookedUpUser.connectionId!)}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs flex items-center gap-1 border border-rose-500/30 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={connectingUserId === lookedUpUser.id}
                            onClick={() => handleSendConnectionRequest(lookedUpUser)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-silver font-semibold text-xs flex items-center gap-1 transition-all"
                            title="Send connection request"
                          >
                            <UserPlus size={12} />
                            <span>Connect</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {!lookedUpUser && !tagError && !tagInput && (
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] text-muted flex items-center gap-2">
                      <Info size={14} className="text-cyan-400 flex-shrink-0" />
                      <span>Search for any teammate's @username or paste their chat link to connect instantly.</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewChatModal(false)}
                      className="px-4 py-2 rounded-xl text-xs text-muted hover:text-silver"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
