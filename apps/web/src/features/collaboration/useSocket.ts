import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'
import type { Note, NotesBatchAppliedPayload, ActivityActor, EditorEventType, RealtimeActivityPayload } from '@ama-midi/shared'
import { unwrapActivityPayload } from './activity-payload'

export interface ActivityNoticeEvent {
  actor: ActivityActor
  type: EditorEventType
  weight: number
  label: string
  at: number
}

export interface UseSocketOptions {
  onActivity?: (event: ActivityNoticeEvent) => void
}

export interface PresenceUser {
  id:          string
  name:        string
  avatarUrl?:  string
  email?:      string
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

function dedupePresence(users: PresenceUser[]) {
  return Array.from(new Map(users.map((user) => [user.id, user])).values())
}

export function useSocket(songId: string, chartId?: string, projectId?: string, options: UseSocketOptions = {}) {
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [cursors,      setCursors]      = useState<Map<string, CursorData>>(new Map())
  const queryClient = useQueryClient()
  const token       = useAuthStore(s => s.token)
  const socketRef   = useRef<Socket | null>(null)

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

    let disposed = false

    const WS_URL =
      import.meta.env.VITE_WS_URL ??
      (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')

    const socket: Socket = io(WS_URL, {
      auth:       { token },
      transports: ['websocket'],
      autoConnect: false,
    })
    socketRef.current = socket

    const connectTimer = window.setTimeout(() => {
      if (!disposed) socket.connect()
    }, 50)

    socket.on('connect', () => {
      if (disposed) return
      setIsConnected(true)
      socket.emit('join-song', { songId })
      if (projectId) socket.emit('join-project', { projectId })
    })

    socket.on('disconnect', () => {
      if (disposed) return
      setIsConnected(false)
      toast.loading('Connection lost — reconnecting...', {
        id:        'ws-disconnect',
        duration:  Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.on('connect_error', () => {
      if (disposed) return
      toast.loading('Connection lost — reconnecting...', {
        id:        'ws-disconnect',
        duration:  Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.io.on('reconnect', () => {
      if (disposed) return
      toast.dismiss('ws-disconnect')
      toast.success('Back online — syncing changes', { className: 'ama-toast ama-toast--success' })
      setIsConnected(true)
    })

    socket.on('presence-list', (users: PresenceUser[]) => {
      setPresenceList(dedupePresence(users))
    })

    socket.on('user-joined', (user: PresenceUser) => {
      setPresenceList(prev => {
        const next = prev.filter(u => u.id !== user.id)
        return [...next, user]
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

    socket.on('cursor-snapshot', ({ cursors: snapshot }: { cursors: Omit<CursorData, 'lastSeen'>[] }) => {
      const now = Date.now()
      setCursors(() => {
        const map = new Map<string, CursorData>()
        snapshot.forEach(c => map.set(c.userId, { ...c, lastSeen: now }))
        return map
      })
    })

    socket.on('cursor-moved', (data: Omit<CursorData, 'lastSeen'>) => {
      setCursors(prev => {
        const next = new Map(prev)
        next.set(data.userId, { ...data, lastSeen: Date.now() })
        return next
      })
    })

    socket.on('cursor-hidden', ({ userId }: { userId: string }) => {
      setCursors(prev => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    })

    socket.on('note-created', (payload: Note | RealtimeActivityPayload<Note>) => {
      const { actor, data: note } = unwrapActivityPayload(payload)
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
      queryClient.invalidateQueries({ queryKey: ['events', noteChartId] })
      if (actor) {
        options.onActivity?.({
          actor,
          type: 'NOTE_CREATED',
          weight: 1,
          label: `${actor.name} added a note at Track ${note.track}, ${note.time}s`,
          at: Date.now(),
        })
      }
    })

    socket.on('note-updated', (payload: Note | RealtimeActivityPayload<Note>) => {
      const { actor, data: note } = unwrapActivityPayload(payload)
      const noteChartId = note.chartId ?? chartId
      if (!noteChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', noteChartId], exact: false },
        (old) => (old ? old.map((n) => (n.id === note.id ? note : n)) : [note]),
      )
      queryClient.invalidateQueries({ queryKey: ['events', noteChartId] })
      if (actor) {
        options.onActivity?.({
          actor,
          type: 'NOTE_UPDATED',
          weight: 1,
          label: `${actor.name} edited a note at Track ${note.track}, ${note.time}s`,
          at: Date.now(),
        })
      }
    })

    socket.on('note-deleted', (payload: { noteId: string } | RealtimeActivityPayload<{ noteId: string; beforeState?: unknown }>) => {
      const { actor, data } = unwrapActivityPayload(payload)
      const noteId = data.noteId
      queryClient.setQueriesData<Note[]>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === 'notes',
        },
        (old) => (old ? old.filter((n) => n.id !== noteId) : old),
      )
      if (chartId) queryClient.invalidateQueries({ queryKey: ['events', chartId] })
      if (actor) {
        options.onActivity?.({
          actor,
          type: 'NOTE_DELETED',
          weight: 1,
          label: `${actor.name} removed a note`,
          at: Date.now(),
        })
      }
    })

    socket.on('notes-batch-applied', (payload: NotesBatchAppliedPayload | RealtimeActivityPayload<NotesBatchAppliedPayload>) => {
      const { actor, data } = unwrapActivityPayload(payload)
      const batchChartId = data.created[0]?.chartId ?? chartId
      if (!batchChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', batchChartId], exact: false },
        (old) => {
          if (!old) return data.created
          const deleted      = new Set(data.deletedIds)
          const createdById  = new Map(data.created.map((note) => [note.id, note]))
          const kept         = old.filter((note) => !deleted.has(note.id) && !createdById.has(note.id))
          return [...kept, ...data.created]
        },
      )
      queryClient.invalidateQueries({ queryKey: ['validation', songId] })
      queryClient.invalidateQueries({ queryKey: ['events', batchChartId] })
      if (actor) {
        const totalNotes = data.created.length + data.deletedIds.length
        options.onActivity?.({
          actor,
          type: 'NOTE_CREATED',
          weight: totalNotes,
          label: `${actor.name} applied a batch of ${totalNotes} note changes`,
          at: Date.now(),
        })
      }
    })

    socket.on('section-created', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
      if (chartId) queryClient.invalidateQueries({ queryKey: ['events', chartId] })
    })
    socket.on('section-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
      if (chartId) queryClient.invalidateQueries({ queryKey: ['events', chartId] })
    })
    socket.on('section-deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['sections', songId] })
      if (chartId) queryClient.invalidateQueries({ queryKey: ['events', chartId] })
    })

    socket.on('chart-switched', (payload: { actor: ActivityActor; data: { chartId: string; chartName: string } }) => {
      options.onActivity?.({
        actor: payload.actor,
        type: 'CHART_SWITCHED',
        weight: 1,
        label: `${payload.actor.name} switched to chart "${payload.data.chartName}"`,
        at: Date.now(),
      })
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
      disposed = true
      window.clearTimeout(connectTimer)
      socket.removeAllListeners()
      socket.io.off('reconnect')
      socket.io.reconnection(false)

      if (socket.connected) {
        socket.emit('leave-song', { songId })
        if (projectId) socket.emit('leave-project', { projectId })
        socket.disconnect()
      } else {
        socket.once('connect', () => socket.disconnect())
      }

      socketRef.current = null
      setIsConnected(false)
      toast.dismiss('ws-disconnect')
    }
  }, [songId, chartId, projectId, token, queryClient])

  function emitCursorMove(track: number, time: number) {
    socketRef.current?.emit('cursor-move', { songId, track, time })
  }

  function emitCursorHide() {
    socketRef.current?.emit('cursor-hide', { songId })
  }

  function emitChartSwitch(chartName: string) {
    if (!chartId) return
    socketRef.current?.emit('chart-switch', { songId, chartId, chartName })
  }

  return { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide, emitChartSwitch }
}
