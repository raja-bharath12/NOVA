import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, User } from 'lucide-react'
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

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
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
    }
  }, [remoteStream])

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Incoming Call Popup */}
      <AnimatePresence>
        {incomingCall && !activeCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-sm p-8 text-center border border-violet-500/30 shadow-glow"
            >
              <p className="label-tracked uppercase tracking-widest text-cyan-400 mb-4">Incoming Call</p>

              <div className="relative inline-block my-4">
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -inset-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 blur-md opacity-50"
                />
                <div className="relative h-24 w-24 rounded-full bg-void-900 border-2 border-violet-400/50 flex items-center justify-center shadow-glow">
                  <User size={42} className="text-lavender" />
                </div>
              </div>

              <h2 className="text-xl font-display font-semibold text-silver mt-2">{incomingCall.senderName}</h2>
              <p className="text-sm text-muted mb-8">
                {incomingCall.isVideo ? 'Incoming Video Call...' : 'Incoming Voice Call...'}
              </p>

              <div className="flex items-center justify-center gap-6">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={rejectCall}
                  className="h-14 w-14 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                  title="Decline"
                >
                  <PhoneOff size={24} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={acceptCall}
                  className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 transition-all shadow-[0_0_24px_rgba(16,185,129,0.5)] animate-pulse"
                  title="Accept"
                >
                  <Phone size={28} />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active 1:1 Call View */}
      <AnimatePresence>
        {activeCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-xl p-4 md:p-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel relative w-full max-w-4xl h-[80vh] flex flex-col justify-between overflow-hidden border border-violet-500/20 shadow-2xl"
            >
              {/* Call Top Header */}
              <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-void-950/40 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulseGlow" />
                  <div>
                    <h3 className="text-base font-semibold text-silver">{activeCall.targetUserName}</h3>
                    <p className="text-xs text-muted">
                      {activeCall.status === 'RINGING' ? 'Ringing...' : formatDuration(duration)}
                    </p>
                  </div>
                </div>
                <span className="label-tracked text-violet-400">
                  {activeCall.isVideo ? 'Encrypted Video' : 'Encrypted Voice'}
                </span>
              </div>

              {/* Main Media Body */}
              <div className="relative flex-1 flex items-center justify-center bg-void-950/60 overflow-hidden">
                {activeCall.isVideo ? (
                  <>
                    {remoteStream ? (
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-6">
                        <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-violet-600/30 to-cyan-500/20 border border-violet-400/30 flex items-center justify-center mb-4 shadow-glow">
                          <User size={56} className="text-lavender animate-pulse" />
                        </div>
                        <p className="text-sm text-lavender font-medium">{activeCall.targetUserName}</p>
                        <p className="text-xs text-muted mt-1">Connecting video stream...</p>
                      </div>
                    )}

                    {/* Local Picture-in-Picture Tile */}
                    <div className="absolute top-4 right-4 w-36 h-48 sm:w-48 sm:h-36 rounded-xl overflow-hidden glass-panel border border-violet-400/30 shadow-glow">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {isCamOff && (
                        <div className="absolute inset-0 bg-void-900 flex items-center justify-center text-xs text-muted">
                          Camera off
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Voice Call Audio Visualizer Representation
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="relative mb-6">
                      <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="absolute -inset-6 rounded-full bg-violet-500 blur-xl"
                      />
                      <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-violet-600/40 to-cyan-500/20 border border-violet-400/40 flex items-center justify-center shadow-glow">
                        <User size={64} className="text-silver" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-display font-semibold text-silver">{activeCall.targetUserName}</h3>
                    <p className="text-sm text-cyan-400 mt-1 font-mono tracking-wider">
                      {activeCall.status === 'RINGING' ? 'Calling...' : formatDuration(duration)}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Call Control Bar */}
              <div className="relative z-10 flex items-center justify-center gap-4 py-5 px-6 border-t border-white/[0.06] bg-void-950/60 backdrop-blur-md">
                <button
                  onClick={toggleMic}
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                    isMicMuted
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-white/[0.06] text-silver hover:bg-white/[0.12] border border-white/[0.1]'
                  }`}
                  title={isMicMuted ? 'Unmute' : 'Mute'}
                >
                  {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {activeCall.isVideo && (
                  <button
                    onClick={toggleCam}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${
                      isCamOff
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-white/[0.06] text-silver hover:bg-white/[0.12] border border-white/[0.1]'
                    }`}
                    title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {isCamOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={endCall}
                  className="h-12 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all"
                >
                  <PhoneOff size={18} />
                  <span>End Call</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
