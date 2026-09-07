import api, { API_BASE_URL, BACKEND_URL } from './api'
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

  getFileUrl(downloadUrlOrId: string | number): string {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mystic_token') : null
    let url = typeof downloadUrlOrId === 'number'
      ? `${API_BASE_URL}/files/${downloadUrlOrId}/download`
      : downloadUrlOrId

    if (!url.startsWith('http')) {
      url = `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`
    }

    if (token && !url.includes('token=')) {
      url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`
    }
    return url
  },

  async downloadFile(fileId: number, originalFilename: string, fallbackUrl?: string): Promise<void> {
    try {
      // If it's an external pre-signed S3 or cloud URL that doesn't route through /api/files
      if (fallbackUrl && fallbackUrl.startsWith('http') && !fallbackUrl.includes('/api/files/')) {
        const a = document.createElement('a')
        a.href = fallbackUrl
        a.download = originalFilename || 'download'
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }

      // Fetch as authenticated blob through Axios (sends Bearer token automatically)
      const res = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob',
      })

      const blob = new Blob([res.data])
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = originalFilename || 'download'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Blob download failed, falling back to authenticated browser URL', err)
      const token = typeof window !== 'undefined' ? localStorage.getItem('mystic_token') : null
      const url = `${API_BASE_URL}/files/${fileId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
      const link = document.createElement('a')
      link.href = url
      link.download = originalFilename || 'download'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  },
}

export default fileService
