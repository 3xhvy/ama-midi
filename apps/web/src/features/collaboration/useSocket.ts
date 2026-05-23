import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'
import type { Note, NotesBatchAppliedPayload } from '@ama-midi/shared'

export interface PresenceUser {
  id:          string
  name:        string
  avatarUrl?:  string
  email:       string
  title?:      string | null
  department?: string | null
}

export interface CursorData {
  userId:   string
  name:     string
  title?:   string | null
  track:    number
  time:     number
  lastSeen: number
}

export function useSocket(songId: string, chartId?: string, projectId?: string) {
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [cursors,      setCursors]      = useState<Map<string, CursorData>>(new Map())
  const queryClient = useQueryClient()
  const token       = useAuthStore(s => s.token)
  const socketRef   = useRef<Socket | null>(null)

  // Stale cursor cleanup every second
  useEffect(() => {
    const id = setInterval(() => {
      setCursors(prev => {
        const now  = Date.now()
        const next = new Map(prev)
        next.forEach((cursor, userId) => {
          if (now - cursor.lastSeen > 3000) next.delete(userId)
        })
        return next.size !== prev.size ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!token || !songId) return

    const WS_URL =
      import.meta.env.VITE_WS_URL ??
      (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')
    const socket: Socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-song', { songId })
      if (projectId) socket.emit('join-project', { projectId })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      toast.loading('Connection lost — reconnecting...', {
        id: 'ws-disconnect',
        duration: Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.on('connect_error', () => {
      toast.loading('Connection lost — reconnecting...', {
        id: 'ws-disconnect',
        duration: Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.io.on('reconnect', () => {
      toast.dismiss('ws-disconnect')
      toast.success('Back online — syncing changes', { className: 'ama-toast ama-toast--success' })
      setIsConnected(true)
    })

    socket.on('presence-list', (users: PresenceUser[]) => {
      setPresenceList(users)
    })

    socket.on('user-joined', (user: PresenceUser) => {
      setPresenceList(prev => {
        if (prev.find(u => u.id === user.id)) return prev
        return [...prev, user]
      })
    })

    socket.on('user-left', ({ userId }: { userId: string }) => {
      setPresenceList(prev => prev.filter(u => u.id !== userId))
      setCursors(prev => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    })

    socket.on('cursor-moved', (data: Omit<CursorData, 'lastSeen'>) => {
      setCursors(prev => {
        const next = new Map(prev)
        next.set(data.userId, { ...data, lastSeen: Date.now() })
        return next
      })
    })

    socket.on('note-created', (note: Note) => {
      const noteChartId = note.chartId ?? chartId
      if (!noteChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', noteChartId], exact: false },
        (old) => {
          if (!old) return [note]
          if (old.find((n) => n.id === note.id)) return old
          return [...old, note]
        },
      )
    })

    socket.on('note-updated', (note: Note) => {
      const noteChartId = note.chartId ?? chartId
      if (!noteChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', noteChartId], exact: false },
        (old) => (old ? old.map((n) => (n.id === note.id ? note : n)) : [note]),
      )
    })

    socket.on('note-deleted', ({ noteId }: { noteId: string }) => {
      queryClient.setQueriesData<Note[]>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === 'notes',
        },
        (old) => (old ? old.filter((n) => n.id !== noteId) : old),
      )
    })

    socket.on('notes-batch-applied', (payload: NotesBatchAppliedPayload) => {
      const batchChartId = payload.created[0]?.chartId ?? chartId
      if (!batchChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', batchChartId], exact: false },
        (old) => {
          if (!old) return payload.created
          const deleted = new Set(payload.deletedIds)
          const createdById = new Map(payload.created.map((note) => [note.id, note]))
          const kept = old.filter((note) => !deleted.has(note.id) && !createdById.has(note.id))
          return [...kept, ...payload.created]
        },
      )
      queryClient.invalidateQueries({ queryKey: ['validation', songId] })
    })

    socket.on('section-created', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
    })
    socket.on('section-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
    })
    socket.on('section-deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
    })

    if (projectId) {
      socket.on('project.member.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project-songs', projectId] })
      })
      socket.on('project.member.removed', () => {
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project-songs', projectId] })
      })
    }

    return () => {
      socket.emit('leave-song', { songId })
      if (projectId) socket.emit('leave-project', { projectId })
      socket.disconnect()
      socketRef.current = null
      toast.dismiss('ws-disconnect')
    }
  }, [songId, chartId, projectId, token, queryClient])

  function emitCursorMove(track: number, time: number) {
    socketRef.current?.emit('cursor-move', { songId, track, time })
  }

  return { presenceList, isConnected, cursors, emitCursorMove }
}
