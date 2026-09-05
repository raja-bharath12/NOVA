import api, { API_BASE_URL } from './api'
import type { FileItem } from '../types'

export const fileService = {
  async uploadFile(
    file: File,
    conversationId?: number,
    isShared?: boolean,
    onProgress?: (percentage: number) => void
  ): Promise<FileItem> {
    const formData = new FormData()
    formData.append('file', file)
    if (conversationId) {
      formData.append('conversationId', conversationId.toString())
    }
    if (isShared) {
      formData.append('isShared', 'true')
    }

    const res = await api.post<FileItem>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      },
    })
    return res.data
  },

  async getFiles(category?: string, query?: string): Promise<FileItem[]> {
    const res = await api.get<FileItem[]>('/files', {
      params: { category, query },
    })
    return res.data
  },

  async deleteFile(id: number): Promise<void> {
    await api.delete(`/files/${id}`)
  },

  getDownloadUrl(id: number): string {
    return `${API_BASE_URL}/files/${id}/download`
  },
}

export default fileService
