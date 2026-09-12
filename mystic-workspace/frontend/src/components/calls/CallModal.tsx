import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, User, ShieldCheck } from 'lucide-react'
import { useCall } from '../../context/CallContext'

export default function CallModal() {
    const {
        incomingCall,
        activeCall,
        localStream,
        remoteStream,
        isMicMuted,
        isCamOff,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCam,
    } = useCall()

    const navigate = useNavigate()
    const location = useLocation()

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const remoteAudioRef = useRef<HTMLAudioElement>(null)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>
        if (activeCall?.status === 'CONNECTED') {
            interval = setInterval(() => {
                setDuration((d) => d + 1)
            }, 1000)
        } else {
            setDuration(0)
        }
        return () => clearInterval(interval)
    }, [activeCall?.status])

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream
        }
    }, [localStream])

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream
            remoteVideoRef.current.play().catch((e) => {
                console.warn('Remote video playback auto-start error:', e)
            })
        }
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream
            remoteAudioRef.current.play().catch((e) => {
                console.warn('Remote audio playback auto-start error:', e)
            })
        }
    }, [remoteStream, activeCall?.isVideo])

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleEndCall = () => {
        endCall()
        if (!location.pathname.startsWith('/chat')) {
            navigate('/chat')
        }
    }

    const handleRejectCall = () => {
        rejectCall()
        if (!location.pathname.startsWith('/chat')) {
            navigate('/chat')
        }
    }

    return (
        <>
            {/* Audio element for WebRTC voice playback - rendered in DOM without display:none to prevent mobile audio throttling */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                className="absolute opacity-0 pointer-events-none w-0 h-0"
            />

            {/* Incoming Call View */}
            <AnimatePresence>
                {incomingCall && !activeCall && (
                    <div className="fixed inset-0 z-50 flex flex-col h-full h-[100dvh] w-full bg-void-950 md:bg-black/75 md:backdrop-blur-md md:p-4 md:items-center md:justify-center">
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 20 }}
                            className="w-full h-full md:h-auto md:max-w-md p-6 sm:p-8 flex flex-col justify-between md:justify-center items-center text-center bg-void-950 md:glass-panel md:border md:border-violet-500/30 md:rounded-3xl shadow-glow pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
                        >
                            {/* Header / Caller Info */}
                            <div className="flex flex-col items-center w-full my-auto">
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-xs font-mono text-cyan-300 mb-8 uppercase tracking-widest animate-pulse">
                                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                                    Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call
                                </span>

                                <div className="relative inline-block my-6">
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                        className="absolute -inset-5 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 blur-xl opacity-60"
                                    />
                                    <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-void-900 border-2 border-violet-400/60 flex items-center justify-center shadow-glow">
                                        <User size={56} className="text-lavender" />
                                    </div>
                                </div>

                                <h2 className="text-2xl sm:text-3xl font-display font-bold text-silver mt-3">{incomingCall.senderName}</h2>
                                <p className="text-sm text-cyan-300/80 mt-1 font-sans">
                                    {incomingCall.isVideo ? 'Encrypted HD Video Call' : 'Encrypted High-Fidelity Audio Call'}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-center gap-10 sm:gap-14 w-full mt-auto mb-4">
                                <div className="flex flex-col items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.92 }}
                                        onClick={handleRejectCall}
                                        className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-rose-500/20 border-2 border-rose-500/50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-[0_0_24px_rgba(244,63,94,0.3)] active:scale-95"
                                        title="Decline"
                                    >
                                        <PhoneOff size={28} />
                                    </motion.button>
                                    <span className="text-xs text-muted font-medium">Decline</span>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.92 }}
                                        onClick={acceptCall}
                                        className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-all shadow-[0_0_28px_rgba(16,185,129,0.6)] animate-pulse active:scale-95"
                                        title="Accept"
                                    >
                                        <Phone size={28} />
                                    </motion.button>
                                    <span className="text-xs text-emerald-400 font-medium font-semibold">Accept</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Active 1:1 Call View (100% Fullscreen on Mobile, Floating Glass Modal on Desktop) */}
            <AnimatePresence>
                {activeCall && (
                    <div className="fixed inset-0 z-50 flex flex-col h-full h-[100dvh] w-full bg-void-950 md:bg-void-950/80 md:backdrop-blur-xl md:p-8 md:items-center md:justify-center">
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.96, opacity: 0 }}
                            className="relative w-full h-full md:h-[85vh] md:max-w-4xl flex flex-col justify-between overflow-hidden bg-void-950 md:glass-panel md:border md:border-violet-500/20 rounded-none md:rounded-3xl shadow-2xl"
                        >
                            {/* Call Top Header */}
                            <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-white/[0.08] bg-void-950/90 md:bg-void-950/40 backdrop-blur-md flex-shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`h-3 w-3 rounded-full flex-shrink-0 ${activeCall.status === 'CONNECTED' ? 'bg-emerald-400 animate-pulseGlow' : 'bg-amber-400 animate-pulse'
                                            }`}
                                    />
                                    <div className="min-w-0">
                                        <h3 className="text-sm sm:text-base font-semibold text-silver truncate">{activeCall.targetUserName}</h3>
                                        <p className="text-[11px] sm:text-xs text-muted font-mono truncate">
                                            {activeCall.status === 'RINGING' ? 'Ringing...' : formatDuration(duration)}
                                        </p>
                                    </div>
                                </div>

                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-[11px] font-mono text-violet-300 flex-shrink-0">
                                    <ShieldCheck size={13} className="text-violet-400" />
                                    <span>{activeCall.isVideo ? 'Encrypted Video' : 'Encrypted Voice'}</span>
                                </span>
                            </div>

                            {/* Main Media Body */}
                            <div className="relative flex-1 flex items-center justify-center bg-gradient-to-b from-void-950 via-void-900/40 to-void-950 overflow-hidden min-h-0">
                                {activeCall.isVideo ? (
                                    <>
                                        {/* Persistent Remote Video Container */}
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <video
                                                ref={remoteVideoRef}
                                                autoPlay
                                                playsInline
                                                muted={false}
                                                className={`w-full h-full object-cover transition-opacity duration-300 ${remoteStream ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
                                                    }`}
                                            />
                                            {!remoteStream && (
                                                <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
                                                    <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gradient-to-tr from-violet-600/30 to-cyan-500/20 border border-violet-400/30 flex items-center justify-center mb-4 shadow-glow">
                                                        <User size={56} className="text-lavender animate-pulse" />
                                                    </div>
                                                    <p className="text-base font-semibold text-silver">{activeCall.targetUserName}</p>
                                                    <p className="text-xs text-cyan-300 mt-1 font-mono">
                                                        {activeCall.status === 'RINGING' ? 'Calling...' : 'Connecting HD video...'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Local Picture-in-Picture Tile */}
                                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-28 h-40 sm:w-36 sm:h-48 md:w-48 md:h-36 rounded-2xl overflow-hidden glass-panel border-2 border-violet-400/40 shadow-2xl z-20">
                                            <video
                                                ref={localVideoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover"
                                            />
                                            {isCamOff && (
                                                <div className="absolute inset-0 bg-void-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-[10px] text-muted gap-1">
                                                    <VideoOff size={16} className="text-rose-400" />
                                                    <span>Camera off</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    // Voice Call Visualizer & Caller Card
                                    <div className="flex flex-col items-center justify-center text-center px-4 my-auto relative z-10">
                                        {/* Ambient Glow */}
                                        <motion.div
                                            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.15, 0.35] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                            className="absolute h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-gradient-to-tr from-violet-600/30 via-fuchsia-600/20 to-cyan-500/20 blur-3xl pointer-events-none"
                                        />

                                        <div className="relative mb-6">
                                            <motion.div
                                                animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.15, 0.5] }}
                                                transition={{ duration: 2.2, repeat: Infinity }}
                                                className="absolute -inset-5 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 blur-xl opacity-50"
                                            />
                                            <div className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-full bg-void-900 border-2 border-violet-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                                                <User size={56} className="text-silver sm:w-16 sm:h-16" />
                                            </div>
                                        </div>

                                        <h3 className="text-2xl sm:text-3xl font-display font-bold text-silver">{activeCall.targetUserName}</h3>
                                        <p className="text-sm sm:text-base text-cyan-400 mt-2 font-mono tracking-wider">
                                            {activeCall.status === 'RINGING' ? 'Calling...' : formatDuration(duration)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Call Control Bar */}
                            <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-6 py-4 sm:py-5 px-6 border-t border-white/[0.08] bg-void-950/95 md:bg-void-950/60 backdrop-blur-xl pb-[max(1.75rem,env(safe-area-inset-bottom))] flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={toggleMic}
                                    className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition-all ${isMicMuted
                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.3)]'
                                            : 'bg-white/[0.06] text-silver hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/[0.1]'
                                        }`}
                                    title={isMicMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
                                </button>

                                {activeCall.isVideo && (
                                    <button
                                        type="button"
                                        onClick={toggleCam}
                                        className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition-all ${isCamOff
                                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.3)]'
                                                : 'bg-white/[0.06] text-silver hover:bg-white/[0.12] active:bg-white/[0.18] border border-white/[0.1]'
                                            }`}
                                        title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
                                    >
                                        {isCamOff ? <VideoOff size={22} /> : <Video size={22} />}
                                    </button>
                                )}

                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.06 }}
                                    whileTap={{ scale: 0.94 }}
                                    onClick={handleEndCall}
                                    className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold flex items-center gap-2.5 shadow-[0_0_24px_rgba(244,63,94,0.5)] transition-all"
                                >
                                    <PhoneOff size={20} />
                                    <span className="text-sm sm:text-base font-medium">End Call</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}