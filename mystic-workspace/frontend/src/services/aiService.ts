import api from './api'
import type {
  AiChatMessage,
  AiMeetingSummary,
  AiProductivityAnalytics,
  AiTaskSuggestion,
  Task,
} from '../types'

export interface AiChatResponsePayload {
  reply: string
  suggestedTasks?: AiTaskSuggestion[]
  scheduleBreakdown?: {
    timeSlot: string
    activity: string
    type: 'TASK' | 'EVENT' | 'MEETING' | 'FOCUS'
    itemRef?: string
  }[]
  actionItems?: {
    task: string
    assignee?: string
    deadline?: string
  }[]
}

export const aiService = {
  async chat(
    prompt: string,
    conversationHistory: AiChatMessage[] = []
  ): Promise<AiChatResponsePayload> {
    const res = await api.post<AiChatResponsePayload>('/ai/chat', {
      prompt,
      conversationHistory,
    })
    return res.data
  },

  async createSuggestedTasks(tasks: AiTaskSuggestion[]): Promise<Task[]> {
    const res = await api.post<Task[]>('/ai/create-tasks', { tasks })
    return res.data
  },

  async getAnalytics(): Promise<AiProductivityAnalytics> {
    const res = await api.get<AiProductivityAnalytics>('/ai/analytics')
    return res.data
  },
}

export default aiService
