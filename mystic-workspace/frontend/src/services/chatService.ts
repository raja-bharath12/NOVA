import api from './api'
import type { Conversation, Message, User } from '../types'

export const chatService = {
  async getConversations(): Promise<Conversation[]> {
    const res = await api.get<Conversation[]>('/conversations')
    return res.data
  },

  async getConversation(id: number): Promise<Conversation> {
    const res = await api.get<Conversation>(`/conversations/${id}`)
    return res.data
  },

  async createDirectConversation(recipientId: number): Promise<Conversation> {
    const res = await api.post<Conversation>('/conversations', {
      type: 'DIRECT',
      recipientId,
    })
    return res.data
  },

  async createDirectConversationByTag(userTag: string): Promise<Conversation> {
    const cleanTag = encodeURIComponent(userTag.trim().toUpperCase())
    const res = await api.post<Conversation>(`/conversations/direct/tag/${cleanTag}`)
    return res.data
  },

  async lookupUserByTag(userTag: string): Promise<User> {
    const cleanTag = encodeURIComponent(userTag.trim().toUpperCase())
    const res = await api.get<User>(`/conversations/lookup/tag/${cleanTag}`)
    return res.data
  },

  async createGroupConversation(title: string, memberIds: number[]): Promise<Conversation> {
    const res = await api.post<Conversation>('/conversations', {
      type: 'GROUP',
      title,
      memberIds,
    })
    return res.data
  },

  async addMembers(conversationId: number, userIds: number[]): Promise<Conversation> {
    const res = await api.post<Conversation>(`/conversations/${conversationId}/members`, {
      userIds,
    })
    return res.data
  },

  async removeMember(conversationId: number, userId: number): Promise<void> {
    await api.delete(`/conversations/${conversationId}/members/${userId}`)
  },

  async searchUsers(query?: string): Promise<User[]> {
    const res = await api.get<User[]>('/conversations/users', {
      params: { query },
    })
    return res.data
  },

  async getMessages(conversationId: number, query?: string): Promise<Message[]> {
    const res = await api.get<Message[]>(`/conversations/${conversationId}/messages`, {
      params: { query },
    })
    return res.data
  },

  async sendMessage(
    conversationId: number,
    content?: string,
    replyToId?: number,
    attachmentFileIds?: number[]
  ): Promise<Message> {
    const res = await api.post<Message>(`/conversations/${conversationId}/messages`, {
      content,
      replyToId,
      attachmentFileIds,
    })
    return res.data
  },

  async editMessage(messageId: number, content: string): Promise<Message> {
    const res = await api.put<Message>(`/messages/${messageId}`, { content })
    return res.data
  },

  async deleteMessage(messageId: number): Promise<void> {
    await api.delete(`/messages/${messageId}`)
  },

  async markAsRead(conversationId: number, messageId: number): Promise<void> {
    await api.post(`/conversations/${conversationId}/messages/${messageId}/read`)
  },
}

export default chatService
