import React, { useEffect, useRef, useState } from 'react'
import {
  Search,
  X,
  CheckSquare,
  Calendar,
  MessageSquare,
  FileText,
  Video,
  Palette,
  ArrowRight,
  Sparkles,
  Command,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import searchService, { type SearchResultItem } from '../../services/searchService'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

type CategoryFilter = 'ALL' | 'TASK' | 'EVENT' | 'MESSAGE' | 'FILE' | 'MEETING' | 'WHITEBOARD'

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState<string>('')
  const [filter, setFilter] = useState<CategoryFilter>('ALL')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(0)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Search Debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchService.search(query.trim())
        setResults(data)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Failed to execute global search', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // Filtered Results
  const filteredResults = results.filter((r) => {
    if (filter === 'ALL') return true
    return r.type === filter
  })

  // Keyboard Navigation inside Modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, filteredResults.length - 1) : prev - 1
      )
    } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
      e.preventDefault()
      handleSelectResult(filteredResults[selectedIndex])
    }
  }

  const handleSelectResult = (item: SearchResultItem) => {
    onClose()
    navigate(item.url)
  }

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'TASK':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />
      case 'EVENT':
        return <Calendar className="w-4 h-4 text-amber-400" />
      case 'MESSAGE':
        return <MessageSquare className="w-4 h-4 text-purple-400" />
      case 'FILE':
        return <FileText className="w-4 h-4 text-blue-400" />
      case 'MEETING':
        return <Video className="w-4 h-4 text-rose-400" />
      case 'WHITEBOARD':
        return <Palette className="w-4 h-4 text-pink-400" />
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />
    }
  }

  const FILTERS: { key: CategoryFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'TASK', label: 'Tasks' },
    { key: 'EVENT', label: 'Calendar' },
    { key: 'MESSAGE', label: 'Messages' },
    { key: 'FILE', label: 'Files' },
    { key: 'MEETING', label: 'Meetings' },
    { key: 'WHITEBOARD', label: 'Whiteboards' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-2xl bg-[#0f0d22]/95 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <Search className="w-5 h-5 text-purple-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search anything across NOVA workspace... (tasks, meetings, messages, files)"
                className="flex-1 bg-transparent border-none text-white placeholder-white/30 text-sm outline-none font-medium"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-lg text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-white/10 text-white/60 px-2 py-1 rounded-md border border-white/10">
                ESC
              </kbd>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-white/5 overflow-x-auto no-scrollbar bg-black/20">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFilter(f.key)
                    setSelectedIndex(0)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    filter === f.key
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto p-3 space-y-1">
              {loading ? (
                <div className="p-8 text-center text-xs text-white/40 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Searching workspace indices...</span>
                </div>
              ) : !query.trim() ? (
                <div className="p-8 text-center text-xs text-white/40">
                  <Command className="w-8 h-8 mx-auto text-white/20 mb-2" />
                  <span>Type a keyword to instantly query across all workspace modules</span>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-white/40">
                  No matches found for <span className="text-white font-medium">"{query}"</span>
                </div>
              ) : (
                filteredResults.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3 rounded-2xl cursor-pointer flex items-center justify-between gap-3 transition-all ${
                      selectedIndex === idx
                        ? 'bg-purple-600/20 border border-purple-500/40 text-white'
                        : 'hover:bg-white/5 text-white/80 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        {getCategoryIcon(item.type)}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-sm text-white truncate">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-xs text-white/40 truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.tag && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                          {item.tag}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-white/30" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
              <div className="flex items-center gap-3">
                <span>Navigate <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded">↑↓</kbd></span>
                <span>Select <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded">↵</kbd></span>
              </div>
              <span>{filteredResults.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default GlobalSearchModal
