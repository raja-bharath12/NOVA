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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import { useToast } from '../context/ToastContext'
import { generateFallbackTag } from '../services/authService'
import { chatService } from '../services/chatService'
import { connectionService } from '../services/connectionService'
import { fileService } from '../services/fileService'
import { websocketService } from '../services/websocketService'
import { BACKEND_URL } from '../services/api'
import type { Conversation, Message, User, FileItem, TypingEvent, UserConnection } from '../types'

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
  const [newChatType, setNewChatType] = useState<'DIRECT' | 'GROUP'>('DIRECT')
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  // Connection Workflow State
  const [incomingRequests, setIncomingRequests] = useState<UserConnection[]>([])
  const [userSearchText, setUserSearchText] = useState('')
  const [connectingUserId, setConnectingUserId] = useState<number | null>(null)
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // User Tag Modal State
  const [tagInput, setTagInput] = useState('')
  const [lookedUpUser, setLookedUpUser] = useState<User | null>(null)
  const [tagSearching, setTagSearching] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  // Clipboard feedback state
  const [copiedTag, setCopiedTag] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)


  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
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
      showToast(`Connected to ${conv.title}!`, 'success')
      navigate('/chat', { replace: true })
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Could not find user with that ID.'
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
      if (data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0])
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

    // Resilient background sync interval (checks every 2.5s without flashing loaders)
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
      } catch (err) {
        // Silent sync error
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
    } catch (err: any) {
      showToast('Could not start conversation.', 'warning')
    }
  }

  function handleCopyTag() {
    if (!effectiveTag) return
    navigator.clipboard.writeText(effectiveTag)
    setCopiedTag(true)
    showToast('Your Chat ID copied to clipboard!', 'success')
    setTimeout(() => setCopiedTag(false), 2000)
  }

  function handleCopyLink() {
    if (!effectiveTag) return
    const link = `${window.location.origin}/chat/u/${effectiveTag}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    showToast('Direct Chat Link copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleLookupTag(rawInput: string) {
    const trimmed = rawInput.trim()
    setTagInput(trimmed)
    setTagError(null)
    setLookedUpUser(null)

    if (!trimmed) return

    // Extract tag if a full URL is pasted
    let tag = trimmed
    if (trimmed.includes('/chat/u/')) {
      tag = trimmed.split('/chat/u/')[1].split('?')[0].split('/')[0]
    }

    tag = tag.toUpperCase().replace(/^@/, '')

    if (effectiveTag && tag === effectiveTag.toUpperCase()) {
      setTagError('This is your own Chat ID!')
      return
    }

    try {
      setTagSearching(true)
      const foundUser = await chatService.lookupUserByTag(tag)
      // Check connection status for looked up user
      const users = await connectionService.searchUsers(foundUser.userTag || foundUser.email)
      const matched = users.find((u) => u.id === foundUser.id)
      setLookedUpUser(matched || foundUser)
    } catch (err: any) {
      setTagError('No active user found with ID: ' + tag)
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
    } catch (err) {
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

  return (
    <div className="flex h-[calc(100vh-125px)] md:h-[calc(100vh-100px)] w-full gap-4 overflow-hidden relative">
      {/* ===== LEFT PANE: Conversations List ===== */}
      <div
        className={`flex-col w-full md:w-80 lg:w-96 glass-panel border border-white/[0.06] overflow-hidden flex-shrink-0 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-violet-400" />
            <h2 className="font-display font-semibold text-silver">Messages</h2>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openNewChatModal}
            className="h-8 px-3 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/30 text-xs font-medium text-silver flex items-center gap-1.5 shadow-glow transition-all"
          >
            <Plus size={14} />
            <span>New</span>
          </motion.button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-white/[0.04]">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-muted" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-1.5 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50 transition-all"
            />
          </div>
        </div>

        {/* User Chat ID & Shareable Link Banner */}
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-gradient-to-r from-violet-600/10 via-cyan-500/10 to-indigo-600/10 border border-violet-500/20 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-mono font-semibold text-muted uppercase">MY ID:</span>
              <span className="font-mono text-xs font-bold text-cyan-300 tracking-wider truncate">
                {effectiveTag ? (
                  effectiveTag
                ) : (
                  <span className="text-muted/60 animate-pulse text-[11px]">Generating ID...</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleCopyTag}
                disabled={!effectiveTag}
                title="Copy Chat ID"
                className="p-1 rounded-lg bg-white/[0.04] hover:bg-violet-500/20 text-muted hover:text-cyan-300 border border-white/[0.06] transition-all disabled:opacity-40"
              >
                {copiedTag ? <Check size={12} className="text-cyan-400" /> : <Copy size={12} />}
              </button>
              <button
                onClick={handleCopyLink}
                disabled={!effectiveTag}
                title="Copy Shareable Direct Chat Link"
                className="px-1.5 py-1 rounded-lg bg-white/[0.04] hover:bg-cyan-500/20 text-muted hover:text-cyan-300 border border-white/[0.06] transition-all flex items-center gap-1 text-[10px] font-medium disabled:opacity-40"
              >
                {copiedLink ? <Check size={12} className="text-cyan-400" /> : <LinkIcon size={12} />}
                <span>Share Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02]">
          {loadingConversations ? (
            <div className="p-6 text-center text-xs text-muted">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No conversations found. Start a new chat!
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id
              const otherUser = conv.members.find((m) => m.id !== user?.id)
              const online = conv.type === 'DIRECT' && isUserOnline(otherUser?.id)

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`flex items-center gap-3 p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-violet-500/[0.16] border-l-2 border-violet-400'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/30 border border-white/[0.08] flex items-center justify-center font-display font-semibold text-xs text-silver">
                      {conv.type === 'DIRECT'
                        ? conv.title.slice(0, 2).toUpperCase()
                        : <Users size={16} className="text-cyan-400" />}
                    </div>
                    {conv.type === 'DIRECT' && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-void-950 ${
                          online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-muted/40'
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-silver truncate">{conv.title}</h4>
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
                      <p className="text-xs text-muted truncate">
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="h-4 min-w-[16px] px-1 rounded-full bg-cyan-400 text-void-950 text-[10px] font-bold flex items-center justify-center ml-2">
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

      {/* ===== CENTER PANE: Active Chat & Message Stream ===== */}
      <div
        className={`flex-1 flex-col glass-panel border border-white/[0.06] overflow-hidden min-w-0 ${
          !selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-white/[0.06] bg-void-950/40 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-1.5 -ml-1 rounded-xl text-muted hover:text-silver hover:bg-white/[0.06] transition-colors"
                  title="Back to Conversations"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600/40 to-cyan-500/30 border border-white/[0.08] flex items-center justify-center font-display font-semibold text-xs text-silver">
                    {selectedConversation.type === 'DIRECT'
                      ? selectedConversation.title.slice(0, 2).toUpperCase()
                      : <Users size={16} className="text-cyan-400" />}
                  </div>
                  {selectedConversation.type === 'DIRECT' && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-void-950 ${
                        isUserOnline(selectedConversation.members.find((m) => m.id !== user?.id)?.id)
                          ? 'bg-emerald-400'
                          : 'bg-muted/40'
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-silver truncate">
                    {selectedConversation.title}
                  </h3>
                  <p className="text-[11px] text-muted">
                    {selectedConversation.type === 'DIRECT'
                      ? isUserOnline(selectedConversation.members.find((m) => m.id !== user?.id)?.id)
                        ? 'Online'
                        : 'Offline'
                      : `${selectedConversation.members.length} members`}
                  </p>
                </div>
              </div>

              {/* Quick Actions (Audio / Video Call & Info) */}
              <div className="flex items-center gap-2">
                {selectedConversation.type === 'DIRECT' && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => startCall(false)}
                      className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-violet-500/20 text-muted hover:text-lavender border border-white/[0.06] flex items-center justify-center transition-all"
                      title="Start Voice Call"
                    >
                      <Phone size={15} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => startCall(true)}
                      className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-cyan-500/20 text-muted hover:text-cyan-300 border border-white/[0.06] flex items-center justify-center transition-all"
                      title="Start Video Call"
                    >
                      <Video size={15} />
                    </motion.button>
                  </>
                )}
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowRightPane(!showRightPane)}
                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${
                    showRightPane
                      ? 'bg-violet-500/20 text-lavender border-violet-400/40'
                      : 'bg-white/[0.04] text-muted hover:text-lavender border-white/[0.06]'
                  }`}
                  title="Conversation Details"
                >
                  <Info size={15} />
                </motion.button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-muted">
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Sparkles size={32} className="text-violet-400 mb-3 animate-pulse" />
                  <p className="text-sm text-silver font-medium">This is the beginning of the chat</p>
                  <p className="text-xs text-muted mt-1">Send a message or share files to collaborate in real-time.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender.id === user?.id

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group`}
                    >
                      {/* Sender Name in Group Chats */}
                      {!isOwn && selectedConversation.type === 'GROUP' && (
                        <span className="text-[11px] text-muted ml-3 mb-1">{msg.sender.name}</span>
                      )}

                      <div className="relative max-w-lg">
                        {/* Message Action Bar on Hover */}
                        <div
                          className={`absolute -top-7 ${
                            isOwn ? 'right-0' : 'left-0'
                          } hidden group-hover:flex items-center gap-1 bg-void-900 border border-white/[0.08] rounded-lg px-1.5 py-0.5 shadow-lg z-10`}
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

                        {/* Reply Preview Quote */}
                        {msg.replyToContent && (
                          <div className="text-xs bg-black/20 border-l-2 border-violet-400 px-3 py-1.5 rounded-t-lg text-muted mb-0.5">
                            <span className="font-semibold text-lavender">{msg.replyToSenderName}</span>: {msg.replyToContent}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl p-3.5 text-sm ${
                            isOwn
                              ? 'bg-gradient-to-r from-violet-600/40 to-violet-500/30 text-silver border border-violet-400/30 rounded-tr-none shadow-glow'
                              : 'bg-white/[0.04] text-silver border border-white/[0.06] rounded-tl-none'
                          } ${msg.isDeleted ? 'italic text-muted' : ''}`}
                        >
                          {/* File Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {msg.attachments.map((file) => {
                                const isImg = file.mimeType.startsWith('image/')
                                const isVid = file.mimeType.startsWith('video/')
                                const isPdf = file.mimeType === 'application/pdf'

                                if (isImg) {
                                  return (
                                    <div key={file.id} className="rounded-xl overflow-hidden border border-white/[0.1] max-w-xs">
                                      <img
                                        src={file.downloadUrl.startsWith('http') ? file.downloadUrl : `${BACKEND_URL}${file.downloadUrl}`}
                                        alt={file.originalFilename}
                                        className="w-full h-auto object-cover max-h-60"
                                      />
                                    </div>
                                  )
                                }

                                if (isVid) {
                                  return (
                                    <div key={file.id} className="rounded-xl overflow-hidden border border-white/[0.1] max-w-xs">
                                      <video
                                        src={file.downloadUrl.startsWith('http') ? file.downloadUrl : `${BACKEND_URL}${file.downloadUrl}`}
                                        controls
                                        className="w-full max-h-60"
                                      />
                                    </div>
                                  )
                                }

                                return (
                                  <a
                                    key={file.id}
                                    href={file.downloadUrl.startsWith('http') ? file.downloadUrl : `${BACKEND_URL}${file.downloadUrl}`}
                                    download={file.originalFilename}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-2.5 rounded-xl bg-void-950/60 border border-white/[0.08] hover:border-violet-400/40 transition-all"
                                  >
                                    <FileText size={20} className="text-cyan-400 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-silver truncate">{file.originalFilename}</p>
                                      <p className="text-[10px] text-muted">{(file.fileSize / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <Download size={14} className="text-muted hover:text-lavender" />
                                  </a>
                                )
                              })}
                            </div>
                          )}

                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                          {/* Footer: Time, Edited, Read Status */}
                          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-muted">
                            {msg.isEdited && <span className="italic">edited</span>}
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isOwn && (
                              <span title={msg.isRead ? 'Read' : 'Delivered'}>
                                {msg.isRead ? (
                                  <CheckCheck size={14} className="text-cyan-400" />
                                ) : (
                                  <Check size={14} className="text-muted" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator Bar */}
            {typingUsers.size > 0 && (
              <div className="px-6 py-1.5 text-xs text-cyan-400/90 flex items-center gap-2">
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
              <div className="px-6 py-2 bg-void-900/90 border-t border-white/[0.06] flex items-center justify-between text-xs">
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
              <div className="px-6 py-2 bg-void-900/60 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
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

            {/* Message Composer Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-white/[0.06] bg-void-950/40 backdrop-blur-sm flex items-center gap-3"
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
                className="h-10 w-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-lavender border border-white/[0.06] flex items-center justify-center transition-all flex-shrink-0"
                title="Attach files"
              >
                <Paperclip size={18} />
              </motion.button>

              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={handleInputChange}
                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50 focus:shadow-glow transition-all"
              />

              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!inputText.trim() && selectedFiles.length === 0}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold flex items-center justify-center gap-2 shadow-glow hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
              >
                <Send size={16} />
              </motion.button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted">
            <MessageSquare size={48} className="text-violet-400/40 mb-3" />
            <p className="text-base font-semibold text-silver">Select a chat to begin</p>
            <p className="text-xs text-muted mt-1 max-w-sm">
              Connect with teammates through encrypted real-time messages, file sharing, and direct audio/video calling.
            </p>
          </div>
        )}
      </div>

      {/* ===== RIGHT PANE: Conversation Details & Shared Files ===== */}
      <AnimatePresence>
        {showRightPane && selectedConversation && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="hidden lg:flex flex-col w-80 glass-panel border border-white/[0.06] overflow-hidden flex-shrink-0"
          >
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-silver">Chat Info</h3>
              <button onClick={() => setShowRightPane(false)} className="text-muted hover:text-lavender">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 text-center border-b border-white/[0.06]">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600/40 to-cyan-500/30 border border-white/[0.08] flex items-center justify-center font-display font-bold text-lg text-silver mb-3 shadow-glow">
                {selectedConversation.type === 'DIRECT'
                  ? selectedConversation.title.slice(0, 2).toUpperCase()
                  : <Users size={24} className="text-cyan-400" />}
              </div>
              <h4 className="font-semibold text-silver">{selectedConversation.title}</h4>
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
                        <div className="h-7 w-7 rounded-lg bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${
                            isUserOnline(m.id) ? 'bg-emerald-400' : 'bg-muted/40'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-medium text-silver">{m.name}</span>
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
        )}
      </AnimatePresence>

      {/* ===== RIGHT PANE: Conversation Details Sheet (Mobile / Tablet) ===== */}
      <AnimatePresence>
        {showRightPane && selectedConversation && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRightPane(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="relative z-10 w-full bg-void-900/95 border-t border-purple-500/25 rounded-t-3xl shadow-2xl p-5 pb-8 backdrop-blur-2xl flex flex-col max-h-[85vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-2" />
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h3 className="font-display font-semibold text-sm text-silver">Conversation Info</h3>
                <button
                  onClick={() => setShowRightPane(false)}
                  className="p-1.5 rounded-xl bg-white/[0.04] text-muted hover:text-lavender"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 text-center border-b border-white/[0.06]">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-600/40 to-cyan-500/30 border border-white/[0.08] flex items-center justify-center font-display font-bold text-base text-silver mb-2 shadow-glow">
                  {selectedConversation.type === 'DIRECT'
                    ? selectedConversation.title.slice(0, 2).toUpperCase()
                    : <Users size={20} className="text-cyan-400" />}
                </div>
                <h4 className="font-semibold text-silver">{selectedConversation.title}</h4>
                <span className="label-tracked text-[10px] text-cyan-400">{selectedConversation.type} CHAT</span>
              </div>

              {/* Members Section */}
              <div className="flex-1 overflow-y-auto pt-3 space-y-2.5">
                <h5 className="label-tracked text-xs text-lavender">Members ({selectedConversation.members.length})</h5>
                <div className="space-y-2">
                  {selectedConversation.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="h-7 w-7 rounded-lg bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${
                              isUserOnline(m.id) ? 'bg-emerald-400' : 'bg-muted/40'
                            }`}
                          />
                        </div>
                        <span className="text-xs font-medium text-silver">{m.name}</span>
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
          </div>
        )}
      </AnimatePresence>

      {/* ===== NEW CHAT MODAL ===== */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass-panel w-full max-w-lg p-6 border border-violet-500/30 shadow-2xl rounded-3xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-display font-semibold text-silver flex items-center gap-2">
                    <span>Start Conversation</span>
                    {incomingRequests.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-[10px] font-bold text-void-950">
                        {incomingRequests.length} pending
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted">Connect with teammates on Mystic or search member directory</p>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1.5 rounded-xl bg-white/[0.04] text-muted hover:text-lavender transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Tab Switcher: Browse & Connect / Group Chat / User ID */}
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
                  <span>Browse Members</span>
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
                  <Hash size={13} />
                  <span>Chat ID / Link</span>
                </button>
              </div>

              {/* TAB 1: BROWSE MEMBERS & CONNECT */}
              {newChatTab === 'USERS' && (
                <div className="space-y-3">
                  {/* Real-time Search Bar */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      placeholder="Search members by name, email, or Chat ID..."
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

                  {/* Incoming Connection Requests Banner */}
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
                              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-void-950 flex-shrink-0">
                                {req.requester.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-silver truncate">
                                  {req.requester.name}
                                  {req.requester.userTag && (
                                    <span className="ml-1 text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                      {req.requester.userTag}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted truncate">wants to connect with you on Mystic</p>
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
                                <span>Allow</span>
                              </button>
                              <button
                                type="button"
                                disabled={processingRequestId === req.id}
                                onClick={() => handleDeclineRequest(req.id)}
                                className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1 border border-rose-500/30 transition-all disabled:opacity-50"
                              >
                                <X size={12} />
                                <span>Decline</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Workspace Users List */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {loadingUsers ? (
                      <div className="p-6 text-center text-xs text-muted flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        <span>Searching members...</span>
                      </div>
                    ) : workspaceUsers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted">
                        {userSearchText ? 'No members found matching your search.' : 'No other members in workspace.'}
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
                                <div className="h-8 w-8 rounded-lg bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-void-950 ${
                                    isOnline ? 'bg-emerald-400' : 'bg-muted/40'
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-silver flex items-center gap-1.5 truncate">
                                  <span className="truncate">{u.name}</span>
                                  {u.userTag && (
                                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-300/80 border border-cyan-400/20 flex-shrink-0">
                                      {u.userTag}
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
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 hover:from-violet-400 hover:to-cyan-300 text-void-950 font-semibold text-xs flex items-center gap-1.5 shadow-glow transition-all"
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
                                    <span>Allow</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingRequestId === u.connectionId}
                                    onClick={() => handleDeclineRequest(u.connectionId!)}
                                    className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1 border border-rose-500/30 transition-all"
                                  >
                                    <X size={11} />
                                    <span>Decline</span>
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
                              <div className="h-7 w-7 rounded-lg bg-void-900 border border-white/[0.08] flex items-center justify-center text-xs font-semibold text-lavender">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-silver flex items-center gap-1.5">
                                  {u.name}
                                  {u.userTag && (
                                    <span className="text-[9px] font-mono px-1 rounded bg-white/[0.06] text-muted">
                                      {u.userTag}
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
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs shadow-glow disabled:opacity-40"
                    >
                      Create Group
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ENTER USER ID / LINK */}
              {newChatTab === 'TAG' && (
                <div className="space-y-3 mb-2">
                  <div>
                    <label className="label-tracked block mb-1.5 text-xs">User ID or Invite Link</label>
                    <div className="relative flex items-center">
                      <Hash size={14} className="absolute left-3 text-muted" />
                      <input
                        type="text"
                        placeholder="e.g. MYST-8K4P9Z or paste invite URL"
                        value={tagInput}
                        onChange={(e) => handleLookupTag(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2 text-sm text-silver font-mono placeholder:font-sans placeholder:text-muted focus:outline-none focus:border-cyan-400/50 transition-all uppercase"
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
                      className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-400/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-void-950 font-display">
                          {lookedUpUser.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-silver flex items-center gap-1.5">
                            {lookedUpUser.name}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              {lookedUpUser.userTag}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted">{lookedUpUser.email}</p>
                        </div>
                      </div>

                      {lookedUpUser.connectionStatus === 'CONNECTED' ? (
                        <button
                          type="button"
                          onClick={() => handleStartChatWithUser(lookedUpUser)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-void-950 font-semibold text-xs flex items-center gap-1 shadow-glow transition-all"
                        >
                          <MessageSquare size={12} />
                          <span>Chat</span>
                        </button>
                      ) : lookedUpUser.connectionStatus === 'PENDING_SENT' ? (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs flex items-center gap-1.5">
                          <Clock size={12} className="animate-spin" />
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
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-void-950 font-semibold text-xs flex items-center gap-1 shadow-glow transition-all"
                          >
                            <Check size={12} />
                            <span>Allow</span>
                          </button>
                          <button
                            type="button"
                            disabled={processingRequestId === lookedUpUser.connectionId}
                            onClick={() => handleDeclineRequest(lookedUpUser.connectionId!)}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs flex items-center gap-1 border border-rose-500/30 transition-all"
                          >
                            <X size={12} />
                            <span>Decline</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={connectingUserId === lookedUpUser.id}
                          onClick={() => handleSendConnectionRequest(lookedUpUser)}
                          className="px-3 py-1.5 rounded-lg bg-violet-600/40 hover:bg-violet-600/60 border border-violet-400/30 text-silver hover:text-white font-semibold text-xs flex items-center gap-1 shadow-glow transition-all"
                        >
                          <UserPlus size={12} />
                          <span>Connect</span>
                        </button>
                      )}
                    </motion.div>
                  )}

                  {!lookedUpUser && !tagError && !tagInput && (
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px] text-muted flex items-center gap-2">
                      <Info size={14} className="text-cyan-400 flex-shrink-0" />
                      <span>Ask a teammate for their 10-character Chat ID or invite link to connect privately.</span>
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
