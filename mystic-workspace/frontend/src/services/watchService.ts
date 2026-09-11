import axios from 'axios'
import api, { API_BASE_URL, BACKEND_URL } from './api'
import type { WatchMedia, WatchRoom, WatchChatMessage } from '../types'

export const MAX_VIDEO_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5 GB in bytes
export const PART_SIZE = 10 * 1024 * 1024 // 10 MB per part

interface InitResponse {
  mediaId: number
  storageKey: string
  uploadId?: string
  singleUploadUrl?: string
  partSize?: number
  totalParts?: number
  storageType: 'S3' | 'LOCAL'
}

interface PartUrlsResponse {
  mediaId: number
  uploadId: string
  partUrls: Record<number, string>
}

interface CompletedPart {
  partNumber: number
  eTag: string
}

export const watchService = {
  /**
   * Upload video up to 5 GB using Direct S3 Multipart Upload with Presigned URLs.
   * Zero bytes of large video payloads pass through Spring Boot server when S3 is enabled.
   */
  async uploadMedia(
    file: File,
    title?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<WatchMedia> {
    // 1. Client-Side Strict 5 GB Validation
    if (file.size > MAX_VIDEO_FILE_SIZE) {
      const sizeGb = (file.size / (1024 * 1024 * 1024)).toFixed(2)
      throw new Error(`Video file size (${sizeGb} GB) exceeds the maximum allowed limit of 5.00 GB.`)
    }

    if (file.size === 0) {
      throw new Error('Selected file is empty.')
    }

    // 2. Initialize Direct Upload with Backend
    const totalParts = Math.ceil(file.size / PART_SIZE)
    const { data: initData } = await api.post<InitResponse>('/watch/media/upload-init', {
      title: title || file.name,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type || 'video/mp4',
      partCount: totalParts
    })

    // 3A. S3 Direct Upload Path
    if (initData.storageType === 'S3') {
      try {
        // Case A: Single Part Direct S3 PUT (< 100 MB)
        if (initData.singleUploadUrl) {
          await axios.put(initData.singleUploadUrl, file, {
            headers: {
              'Content-Type': file.type || 'video/mp4'
            },
            onUploadProgress: (p) => {
              if (p.total && onProgress) {
                onProgress(Math.round((p.loaded * 100) / p.total))
              }
            }
          })

          const { data: completedMedia } = await api.post<WatchMedia>('/watch/media/upload-complete', {
            mediaId: initData.mediaId
          })
          onProgress?.(100)
          return completedMedia
        }

        // Case B: S3 Multipart Direct Upload (Up to 5 GB in 10 MB Parts)
        if (initData.uploadId) {
          const completedParts: CompletedPart[] = []
          const uploadedBytesMap = new Map<number, number>()

          const updateGlobalProgress = () => {
            if (!onProgress) return
            let totalLoaded = 0
            uploadedBytesMap.forEach((bytes) => {
              totalLoaded += bytes
            })
            const percent = Math.min(99, Math.round((totalLoaded * 100) / file.size))
            onProgress(percent)
          }

          // Fetch Presigned URLs in batches of 20 parts
          const batchSize = 20
          for (let batchStart = 1; batchStart <= totalParts; batchStart += batchSize) {
            const partNumbers: number[] = []
            for (let p = batchStart; p < batchStart + batchSize && p <= totalParts; p++) {
              partNumbers.push(p)
            }

            const { data: partUrlsData } = await api.post<PartUrlsResponse>('/watch/media/upload-part-urls', {
              mediaId: initData.mediaId,
              uploadId: initData.uploadId,
              partNumbers
            })

            // Concurrently upload this batch (max 4 parallel chunk uploads)
            const concurrency = 4
            for (let i = 0; i < partNumbers.length; i += concurrency) {
              const slice = partNumbers.slice(i, i + concurrency)
              await Promise.all(
                slice.map(async (partNum) => {
                  const partUrl = partUrlsData.partUrls[partNum]
                  const start = (partNum - 1) * PART_SIZE
                  const end = Math.min(start + PART_SIZE, file.size)
                  const chunk = file.slice(start, end)
                  const chunkSize = end - start

                  const res = await axios.put(partUrl, chunk, {
                    headers: {
                      'Content-Type': 'application/octet-stream'
                    },
                    onUploadProgress: (p) => {
                      uploadedBytesMap.set(partNum, p.loaded)
                      updateGlobalProgress()
                    }
                  })

                  uploadedBytesMap.set(partNum, chunkSize)
                  updateGlobalProgress()

                  const rawEtag = res.headers['etag'] || res.headers['ETag'] || ''
                  completedParts.push({
                    partNumber: partNum,
                    eTag: rawEtag.replace(/"/g, '')
                  })
                })
              )
            }
          }

          // Complete Multipart Upload on Backend & S3
          const { data: completedMedia } = await api.post<WatchMedia>('/watch/media/upload-complete', {
            mediaId: initData.mediaId,
            uploadId: initData.uploadId,
            parts: completedParts.sort((a, b) => a.partNumber - b.partNumber)
          })

          onProgress?.(100)
          return completedMedia
        }
      } catch (uploadErr) {
        // Abort multipart session on S3 to prevent dangling parts
        if (initData.uploadId) {
          api.post('/watch/media/upload-abort', {
            mediaId: initData.mediaId,
            uploadId: initData.uploadId
          }).catch(() => {})
        }
        throw uploadErr
      }
    }

    // 3B. Local Storage Fallback (Runs through Spring Boot multipart)
    const formData = new FormData()
    formData.append('file', file)
    if (title) {
      formData.append('title', title)
    }

    const { data } = await api.post<WatchMedia>('/watch/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })
    return data
  },

  async getMyMedia(): Promise<WatchMedia[]> {
    const { data } = await api.get<WatchMedia[]>('/watch/media')
    return data
  },

  async getMedia(id: number): Promise<WatchMedia> {
    const { data } = await api.get<WatchMedia>(`/watch/media/${id}`)
    return data
  },

  async deleteMedia(id: number): Promise<void> {
    await api.delete(`/watch/media/${id}`)
  },

  async createRoom(mediaId: number, title?: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>('/watch/rooms', { mediaId, title })
    return data
  },

  async getRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.get<WatchRoom>(`/watch/rooms/${roomCode}`)
    return data
  },

  async joinRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>(`/watch/rooms/${roomCode}/join`)
    return data
  },

  async leaveRoom(roomCode: string): Promise<void> {
    await api.post(`/watch/rooms/${roomCode}/leave`)
  },

  async endRoom(roomCode: string): Promise<WatchRoom> {
    const { data } = await api.post<WatchRoom>(`/watch/rooms/${roomCode}/end`)
    return data
  },

  async getMessages(roomCode: string): Promise<WatchChatMessage[]> {
    const { data } = await api.get<WatchChatMessage[]>(`/watch/rooms/${roomCode}/messages`)
    return data
  },

  getStreamUrl(mediaId: number): string {
    const token = localStorage.getItem('mystic_token') || ''
    const base = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${BACKEND_URL}/api`
    return `${base}/watch/media/${mediaId}/stream?token=${encodeURIComponent(token)}`
  }
}
