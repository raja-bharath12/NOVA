import api from './api'

export interface SearchResultItem {
  id: string
  type: 'TASK' | 'EVENT' | 'MESSAGE' | 'FILE' | 'MEETING' | 'WHITEBOARD'
  title: string
  description?: string
  subtitle?: string
  timestamp?: string
  url: string
  tag?: string
}

export const searchService = {
  async search(query: string): Promise<SearchResultItem[]> {
    if (!query || !query.trim()) return []
    const res = await api.get<SearchResultItem[]>('/search', {
      params: { q: query.trim() },
    })
    return res.data
  },
}

export default searchService
