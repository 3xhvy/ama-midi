import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'
import type { Note } from '@ama-midi/shared'

interface PresenceUser {
  id: string
  name: string
  avatarUrl?: string
  email: string
}

export function useSocket(songId: string) {
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const queryClient = useQueryClient()
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    if (!token || !songId) return

    const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'
    const socket: Socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-song', { songId })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      toast.loading('Connection lost — reconnecting...', { id: 'ws-disconnect', duration: Infinity })
    })

    socket.on('connect_error', () => {
      toast.loading('Connection lost — reconnecting...', { id: 'ws-disconnect', duration: Infinity })
    })

    socket.io.on('reconnect', () => {
      toast.dismiss('ws-disconnect')
      toast.success('Back online — syncing changes')
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
    })

    socket.on('note-created', (note: Note) => {
      queryClient.setQueryData<Note[]>(['notes', songId], old => {
        if (!old) return [note]
        if (old.find(n => n.id === note.id)) return old
        return [...old, note]
      })
      queryClient.invalidateQueries({ queryKey: ['notes', songId], exact: false })
    })

    socket.on('note-updated', (note: Note) => {
      queryClient.setQueryData<Note[]>(['notes', songId], old =>
        old ? old.map(n => n.id === note.id ? note : n) : [note]
      )
    })

    socket.on('note-deleted', ({ noteId }: { noteId: string }) => {
      queryClient.setQueryData<Note[]>(['notes', songId], old =>
        old ? old.filter(n => n.id !== noteId) : []
      )
    })

    return () => {
      socket.emit('leave-song', { songId })
      socket.disconnect()
      toast.dismiss('ws-disconnect')
    }
  }, [songId, token, queryClient])

  return { presenceList, isConnected }
}
