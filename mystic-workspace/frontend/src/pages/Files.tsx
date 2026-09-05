import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  UploadCloud,
  Search,
  FileText,
  Image as ImageIcon,
  Film,
  Download,
  Trash2,
  Share2,
  Eye,
  X,
  CheckCircle2,
  Clock,
  HardDrive,
  Users,
} from 'lucide-react'
import GlassPanel from '../components/dashboard/GlassPanel'
import { fileService } from '../services/fileService'
import { BACKEND_URL } from '../services/api'
import type { FileItem } from '../types'

const CATEGORIES = [
  { id: 'all', label: 'All Files', icon: FolderOpen },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'shared', label: 'Shared With Me', icon: Users },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'videos', label: 'Videos', icon: Film },
]

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Drag and Drop Upload State
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatusText, setUploadStatusText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  useEffect(() => {
    loadFiles()
  }, [activeCategory, searchQuery])

  async function loadFiles() {
    try {
      setLoading(true)
      const data = await fileService.getFiles(
        activeCategory === 'all' ? undefined : activeCategory,
        searchQuery.trim() || undefined
      )
      setFiles(data)
    } catch (err) {
      console.error('Failed to load files', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    setUploadProgress(0)
    setUploadStatusText('Starting upload...')

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        setUploadStatusText(`Uploading ${file.name}...`)
        const uploaded = await fileService.uploadFile(file, undefined, false, (p) => {
          setUploadProgress(p)
          setUploadStatusText(`Uploading ${p}%`)
        })
        setFiles((prev) => [uploaded, ...prev])
      }
      setUploadStatusText('Upload complete!')
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        setUploadStatusText('')
      }, 1500)
    } catch (err) {
      console.error('Upload failed', err)
      setUploadStatusText('Upload failed')
      setTimeout(() => setUploading(false), 2000)
    }
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('Are you sure you want to delete this file?')) return
    try {
      await fileService.deleteFile(fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const totalStorage = files.reduce((acc, f) => acc + f.fileSize, 0)

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Storage Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-gradient">
            Cloud Workspace Files
          </h1>
          <p className="text-xs md:text-sm text-muted mt-1">
            Secure object storage for project assets, documents, media, and collaboration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            multiple
            className="hidden"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-void-950 font-semibold text-xs flex items-center gap-2 shadow-glow hover:opacity-90 transition-all"
          >
            <UploadCloud size={16} />
            <span>Upload File</span>
          </motion.button>
        </div>
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFileUpload(e.dataTransfer.files)
        }}
        className={`glass-panel p-8 text-center border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/10 shadow-glow-cyan'
            : 'border-white/[0.1] hover:border-violet-400/40 bg-white/[0.02]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud
          size={36}
          className={`mx-auto mb-3 transition-colors ${
            isDragging ? 'text-cyan-400 animate-bounce' : 'text-violet-400'
          }`}
        />
        <p className="text-sm font-medium text-silver">
          Drag & Drop files here, or <span className="text-cyan-400 underline">browse</span>
        </p>
        <p className="text-xs text-muted mt-1">
          Supports Images, PDF, DOCX, XLSX, PPTX, MP4 Videos, Audio, ZIP up to 100MB
        </p>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex justify-between text-xs text-silver mb-1.5 font-mono">
              <span>{uploadStatusText}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-void-900 overflow-hidden border border-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-glow"
              />
            </div>
          </div>
        )}
      </div>

      {/* Categories & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const active = activeCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-violet-600/30 text-silver border border-violet-400/40 shadow-glow'
                    : 'bg-white/[0.02] text-muted hover:text-lavender hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                <Icon size={14} className={active ? 'text-cyan-400' : ''} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div className="relative flex items-center w-full md:w-64">
          <Search size={14} className="absolute left-3 text-muted" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-2 text-xs text-silver placeholder:text-muted focus:outline-none focus:border-violet-400/50"
          />
        </div>
      </div>

      {/* Files Grid / List */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-xs text-muted">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <FolderOpen size={40} className="mx-auto text-violet-400/50 mb-3" />
          <p className="text-sm font-semibold text-silver">No files found</p>
          <p className="text-xs text-muted mt-1">Upload documents, photos, or media to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map((file) => {
            const isImg = file.mimeType.startsWith('image/')
            const isVid = file.mimeType.startsWith('video/')
            const isPdf = file.mimeType === 'application/pdf'

            return (
              <motion.div
                key={file.id}
                whileHover={{ y: -3 }}
                className="glass-panel group relative p-4 flex flex-col justify-between border border-white/[0.06] hover:border-violet-400/30 transition-all"
              >
                {/* File Thumbnail or Icon Stage */}
                <div
                  onClick={() => setPreviewFile(file)}
                  className="h-32 w-full rounded-xl bg-void-950/60 border border-white/[0.04] flex items-center justify-center overflow-hidden mb-3 cursor-pointer relative"
                >
                  {isImg ? (
                    <img
                      src={file.downloadUrl.startsWith('http') ? file.downloadUrl : `${BACKEND_URL}${file.downloadUrl}`}
                      alt={file.originalFilename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isVid ? (
                    <div className="flex flex-col items-center text-cyan-400">
                      <Film size={32} />
                      <span className="text-[10px] text-muted mt-1">Video</span>
                    </div>
                  ) : isPdf ? (
                    <div className="flex flex-col items-center text-rose-400">
                      <FileText size={32} />
                      <span className="text-[10px] text-muted mt-1">PDF Document</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-violet-400">
                      <FileText size={32} />
                      <span className="text-[10px] text-muted mt-1">Document</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-void-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Eye size={20} className="text-silver" />
                  </div>
                </div>

                {/* File Metadata Info */}
                <div className="min-w-0 mb-3">
                  <h4 className="text-xs font-semibold text-silver truncate" title={file.originalFilename}>
                    {file.originalFilename}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-muted mt-1 font-mono">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                  <span className="text-[9px] uppercase tracking-wider text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded">
                    {file.storageType}
                  </span>

                  <div className="flex items-center gap-1">
                    <a
                      href={file.downloadUrl.startsWith('http') ? file.downloadUrl : `${BACKEND_URL}${file.downloadUrl}`}
                      download={file.originalFilename}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-lavender transition-all"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-muted hover:text-rose-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ===== FILE PREVIEW LIGHTBOX MODAL ===== */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-violet-500/30 shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-void-950/40">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-silver truncate">{previewFile.originalFilename}</h3>
                  <p className="text-[10px] text-muted font-mono">{formatFileSize(previewFile.fileSize)} • {previewFile.mimeType}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={previewFile.downloadUrl.startsWith('http') ? previewFile.downloadUrl : `${BACKEND_URL}${previewFile.downloadUrl}`}
                    download={previewFile.originalFilename}
                    className="h-8 px-3 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-xs text-silver flex items-center gap-1.5 border border-violet-400/30"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                  <button onClick={() => setPreviewFile(null)} className="text-muted hover:text-lavender">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 flex items-center justify-center bg-void-950/60 overflow-auto">
                {previewFile.mimeType.startsWith('image/') ? (
                  <img
                    src={previewFile.downloadUrl.startsWith('http') ? previewFile.downloadUrl : `${BACKEND_URL}${previewFile.downloadUrl}`}
                    alt={previewFile.originalFilename}
                    className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-glow"
                  />
                ) : previewFile.mimeType.startsWith('video/') ? (
                  <video
                    src={previewFile.downloadUrl.startsWith('http') ? previewFile.downloadUrl : `${BACKEND_URL}${previewFile.downloadUrl}`}
                    controls
                    className="max-h-[60vh] max-w-full rounded-xl"
                  />
                ) : (
                  <div className="text-center p-8">
                    <FileText size={48} className="mx-auto text-cyan-400 mb-3" />
                    <p className="text-sm text-silver font-medium">{previewFile.originalFilename}</p>
                    <p className="text-xs text-muted mt-1">Preview not available for this format. Download to view.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
