import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AnimatedBackground from './components/layout/AnimatedBackground'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { ToastProvider } from './context/ToastContext'
import { CallProvider } from './context/CallContext'
import CallModal from './components/calls/CallModal'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Chat from './pages/Chat'
import Meetings from './pages/Meetings'
import MeetingRoom from './pages/MeetingRoom'
import Files from './pages/Files'
import Whiteboard from './pages/Whiteboard'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <CallProvider>
        <AnimatedBackground />
        <CallModal />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Tasks />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Calendar />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/u/:userTag"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/meetings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Meetings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/meetings/room/:roomCode"
              element={
                <ProtectedRoute>
                  <MeetingRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Files />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/whiteboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Whiteboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AnimatePresence>
      </CallProvider>
    </ToastProvider>
  )
}
