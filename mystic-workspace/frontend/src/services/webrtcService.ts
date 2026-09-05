import { websocketService } from './websocketService'
import type { CallSignal, MeetingSignal } from '../types'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

export class WebRTCService {
  // Local stream for 1:1 call or meeting
  private localStream: MediaStream | null = null
  private screenStream: MediaStream | null = null

  // 1:1 Call State
  private callPeerConnection: RTCPeerConnection | null = null
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null
  private onCallEndedCallback: (() => void) | null = null

  // Meeting Room Multi-Peer Mesh: peerId -> RTCPeerConnection
  private meetingPeers: Map<number, RTCPeerConnection> = new Map()
  private onPeerStreamCallback: ((peerId: number, stream: MediaStream) => void) | null = null
  private onPeerLeaveCallback: ((peerId: number) => void) | null = null

  // ===== Media Stream Access =====

  async getLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      })
      return this.localStream
    } catch (err: any) {
      console.warn('Could not get requested media devices, falling back to audio only:', err.message)
      if (video) {
        // Fallback to audio only
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        return this.localStream
      }
      throw err
    }
  }

  async getScreenMedia(): Promise<MediaStream> {
    if (this.screenStream) return this.screenStream

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // When user clicks "Stop sharing" on browser toolbar
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare()
      }

      return this.screenStream
    } catch (err) {
      console.warn('Screen capture cancelled or denied', err)
      throw err
    }
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop())
      this.screenStream = null
    }
  }

  toggleMicrophone(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  toggleCamera(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream
  }

  // ===== 1:1 WebRTC Call Handling =====

  async startCall(
    targetUserId: number,
    senderId: number,
    senderName: string,
    isVideo: boolean,
    onRemoteStream: (stream: MediaStream) => void,
    onCallEnded: () => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream
    this.onCallEndedCallback = onCallEnded

    await this.getLocalMedia(isVideo, true)
    this.createCallPeerConnection(targetUserId, senderId, senderName, isVideo)

    const offer = await this.callPeerConnection!.createOffer()
    await this.callPeerConnection!.setLocalDescription(offer)

    websocketService.sendCallSignal({
      type: 'OFFER',
      senderId,
      senderName,
      targetUserId,
      isVideo,
      sdp: offer,
    })
  }

  async acceptCall(
    signal: CallSignal,
    currentUserId: number,
    currentUserName: string,
    onRemoteStream: (stream: MediaStream) => void,
    onCallEnded: () => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream
    this.onCallEndedCallback = onCallEnded

    await this.getLocalMedia(signal.isVideo, true)
    this.createCallPeerConnection(signal.senderId, currentUserId, currentUserName, signal.isVideo)

    if (signal.sdp) {
      await this.callPeerConnection!.setRemoteDescription(new RTCSessionDescription(signal.sdp))
      const answer = await this.callPeerConnection!.createAnswer()
      await this.callPeerConnection!.setLocalDescription(answer)

      websocketService.sendCallSignal({
        type: 'ANSWER',
        senderId: currentUserId,
        senderName: currentUserName,
        targetUserId: signal.senderId,
        isVideo: signal.isVideo,
        sdp: answer,
      })
    }
  }

  async handleCallSignal(signal: CallSignal) {
    if (!this.callPeerConnection && signal.type !== 'CALL_REQUEST') return

    if (signal.type === 'ANSWER' && signal.sdp) {
      await this.callPeerConnection?.setRemoteDescription(new RTCSessionDescription(signal.sdp))
    } else if (signal.type === 'ICE_CANDIDATE' && signal.candidate) {
      try {
        await this.callPeerConnection?.addIceCandidate(new RTCIceCandidate(signal.candidate))
      } catch (err) {
        console.warn('Error adding ICE candidate', err)
      }
    } else if (signal.type === 'CALL_END' || signal.type === 'CALL_REJECT' || signal.type === 'CALL_BUSY') {
      this.endCall()
    }
  }

  private createCallPeerConnection(
    targetUserId: number,
    currentUserId: number,
    currentUserName: string,
    isVideo: boolean
  ) {
    this.cleanupCallPeer()
    this.callPeerConnection = new RTCPeerConnection(RTC_CONFIG)

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.callPeerConnection?.addTrack(track, this.localStream!)
      })
    }

    this.callPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.sendCallSignal({
          type: 'ICE_CANDIDATE',
          senderId: currentUserId,
          senderName: currentUserName,
          targetUserId,
          isVideo,
          candidate: event.candidate,
        })
      }
    }

    this.callPeerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStreamCallback?.(event.streams[0])
      }
    }

    this.callPeerConnection.oniceconnectionstatechange = () => {
      if (
        this.callPeerConnection?.iceConnectionState === 'disconnected' ||
        this.callPeerConnection?.iceConnectionState === 'failed' ||
        this.callPeerConnection?.iceConnectionState === 'closed'
      ) {
        this.endCall()
      }
    }
  }

  endCall(targetUserId?: number, senderId?: number, senderName?: string) {
    if (targetUserId && senderId && senderName) {
      websocketService.sendCallSignal({
        type: 'CALL_END',
        senderId,
        senderName,
        targetUserId,
        isVideo: false,
      })
    }

    this.cleanupCallPeer()
    this.stopAllMedia()
    this.onCallEndedCallback?.()
  }

  // ===== Meeting Room Mesh Handling =====

  setupMeetingRoom(
    onPeerStream: (peerId: number, stream: MediaStream) => void,
    onPeerLeave: (peerId: number) => void
  ) {
    this.onPeerStreamCallback = onPeerStream
    this.onPeerLeaveCallback = onPeerLeave
  }

  async handleMeetingMeshSignal(
    signal: MeetingSignal,
    currentUserId: number,
    currentUserName: string,
    roomCode: string
  ) {
    if (signal.senderId === currentUserId) return

    const peerId = signal.senderId

    if (signal.type === 'JOIN') {
      // Create offer for new peer
      const pc = this.getOrCreateMeetingPeer(peerId, currentUserId, currentUserName, roomCode)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      websocketService.sendMeetingSignal({
        type: 'OFFER',
        roomCode,
        senderId: currentUserId,
        senderName: currentUserName,
        targetUserId: peerId,
        sdp: offer,
      })
    } else if (signal.type === 'OFFER' && signal.targetUserId === currentUserId && signal.sdp) {
      const pc = this.getOrCreateMeetingPeer(peerId, currentUserId, currentUserName, roomCode)
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      websocketService.sendMeetingSignal({
        type: 'ANSWER',
        roomCode,
        senderId: currentUserId,
        senderName: currentUserName,
        targetUserId: peerId,
        sdp: answer,
      })
    } else if (signal.type === 'ANSWER' && signal.targetUserId === currentUserId && signal.sdp) {
      const pc = this.meetingPeers.get(peerId)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
      }
    } else if (signal.type === 'ICE_CANDIDATE' && signal.targetUserId === currentUserId && signal.candidate) {
      const pc = this.meetingPeers.get(peerId)
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        } catch (err) {
          console.warn('Error adding meeting ICE candidate', err)
        }
      }
    } else if (signal.type === 'LEAVE') {
      this.removeMeetingPeer(peerId)
      this.onPeerLeaveCallback?.(peerId)
    }
  }

  private getOrCreateMeetingPeer(
    peerId: number,
    currentUserId: number,
    currentUserName: string,
    roomCode: string
  ): RTCPeerConnection {
    if (this.meetingPeers.has(peerId)) {
      return this.meetingPeers.get(peerId)!
    }

    const pc = new RTCPeerConnection(RTC_CONFIG)

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!)
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.sendMeetingSignal({
          type: 'ICE_CANDIDATE',
          roomCode,
          senderId: currentUserId,
          senderName: currentUserName,
          targetUserId: peerId,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onPeerStreamCallback?.(peerId, event.streams[0])
      }
    }

    this.meetingPeers.set(peerId, pc)
    return pc
  }

  removeMeetingPeer(peerId: number) {
    const pc = this.meetingPeers.get(peerId)
    if (pc) {
      pc.close()
      this.meetingPeers.delete(peerId)
    }
  }

  leaveMeetingRoom(currentUserId: number, currentUserName: string, roomCode: string) {
    websocketService.sendMeetingSignal({
      type: 'LEAVE',
      roomCode,
      senderId: currentUserId,
      senderName: currentUserName,
    })

    this.meetingPeers.forEach((pc) => pc.close())
    this.meetingPeers.clear()
    this.stopScreenShare()
    this.stopAllMedia()
  }

  // ===== Full Cleanup =====

  private cleanupCallPeer() {
    if (this.callPeerConnection) {
      this.callPeerConnection.close()
      this.callPeerConnection = null
    }
  }

  stopAllMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop())
      this.screenStream = null
    }
  }
}

export const webrtcService = new WebRTCService()
export default webrtcService
