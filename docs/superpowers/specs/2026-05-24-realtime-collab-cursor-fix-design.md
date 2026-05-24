# Design: Real-Time Collaboration & Cursor Fix (Option B)

**Date:** 2026-05-24  
**Scope:** Single PR — all 10 gaps in WebSocket multi-user + cursor system  
**Status:** Approved

---

## Problem Summary

10 confirmed gaps in the current WebSocket collaboration layer:

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🔴 Bug | Multi-tab: `deleteMany` by userId nukes sibling sessions on join |
| 2 | 🔴 Bug | No cursor state sent in `presence-list` — new joiner sees no cursors |
| 3 | 🔴 Bug | `isConnected` returned from `useSocket` but discarded in `EditorPage` |
| 4 | 🔴 Bug | Cursor emit blocked during selection drag (`if (selectionDrag) return`) |
| 5 | 🟡 UX | `onMouseLeave` clears ghost locally but never emits cursor-hide to peers |
| 6 | 🟡 UX | Color inconsistency: `CollaboratorCursors` uses `userId`, `PresenceBar` uses `name` |
| 7 | 🟡 UX | `useThrottle` is leading-edge only — last cursor position before idle never sent |
| 8 | 🟡 UX | No cursor re-broadcast after WS reconnect |
| 9 | 🟠 Arch | No server-side ephemeral cursor store — multi-instance cursors lost on gateway restart |
| 10 | 🟠 Arch | Presence not fully re-synced post-reconnect |

---

## Architecture

### New: `CursorService` (Redis-backed ephemeral store)

Stores cursor positions as Redis keys: `cursor:{songId}:{userId}` → JSON string.  
TTL: 5 seconds (auto-expire if user goes idle without explicit hide).

```
setCursor(songId, userId, data)   → SET cursor:{songId}:{userId} JSON EX 5
getCursors(songId)                → KEYS cursor:{songId}:* + MGET
deleteCursor(songId, userId)      → DEL cursor:{songId}:{userId}
```

`CursorService` injects the existing `ioredis` client (same one used by Redis adapter). Registered in `RealtimeModule`.

### Backend event flow

```
client → cursor-move    → setCursor + broadcast cursor-moved to room
client → cursor-hide    → deleteCursor + broadcast cursor-hidden to room
client → join-song      → fix #1 + getCursors + emit cursor-snapshot to joiner
server → handleDisconnect → deleteCursor + check remaining sessions → conditional user-left
```

### Frontend event flow

```
socket.on('cursor-snapshot')  → hydrate cursors Map from server state
socket.on('cursor-moved')     → upsert entry in cursors Map
socket.on('cursor-hidden')    → delete entry from cursors Map
socket.io.on('reconnect')     → re-emit join-song → triggers cursor-snapshot
onMouseLeave                  → emit cursor-hide immediately (not wait 3s TTL)
```

---

## Detailed Changes

### Fix #1 — Multi-tab session safety (`realtime.gateway.ts`)

**Problem:** `join-song` does `deleteMany({ where: { songId, userId } })` — kills all tabs.

**Fix:** Scope delete to current socket only:
```ts
deleteMany({ where: { songId, userId: client.data.user.id, socketId: client.id } })
```

**Disconnect fix:** After deleting this socket's session, check if any sessions remain for that user in that song. Only emit `user-left` if count === 0.

### Fix #2 + #8 — Cursor snapshot on join (`realtime.gateway.ts` + `CursorService`)

After creating session, call `getCursors(songId)` and include result in a new `cursor-snapshot` event emitted only to the joining client. Frontend hydrates the cursors Map from this snapshot. Reconnect automatically triggers re-join, which triggers another snapshot.

### Fix #3 — `isConnected` wired to UI (`EditorPage.tsx`)

Destructure `isConnected` from `useSocket`. Pass to editor shell header. Render small connection dot:
- Green: connected
- Amber pulsing: reconnecting (replaces current toast-only feedback)

### Fix #4 — Cursor emit during selection drag (`PianoRoll.tsx`)

Move `if (selectionDrag) return` guard down past the cursor emit call. Ghost and activeTrack updates still skip during drag; cursor emit does not.

```ts
const handleMouseMove = useCallback((e) => {
  // coordinate calc...
  throttledCursorEmit(track, time)  // ← always runs
  if (selectionDrag) return          // ← guard moved here
  setActiveTrack(track)
  if (!effectiveCanEdit) return
  setGhost({ track, time })
}, [...])
```

### Fix #5 — `cursor-hide` on mouse leave (`PianoRoll.tsx` + `useSocket.ts` + `realtime.gateway.ts`)

`useSocket` exposes new `emitCursorHide()`:
```ts
function emitCursorHide() {
  socketRef.current?.emit('cursor-hide', { songId })
}
```

`onMouseLeave` in `PianoRoll`:
```ts
onMouseLeave={() => {
  if (effectiveCanEdit) setGhost(null)
  setActiveTrack(null)
  onCursorHide?.()  // new prop
}}
```

Gateway adds `@SubscribeMessage('cursor-hide')` handler: calls `deleteCursor` + broadcasts `cursor-hidden { userId }` to room.

### Fix #6 — Color consistency (`packages/shared/src/colors.ts` + consumers)

Add to `packages/shared/src/colors.ts`:
```ts
export function getColorFromName(id: string): string {
  const palette = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6', '#3B82F6']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}
```

Both `CollaboratorCursors` and `PresenceBar` import from `@ama-midi/shared` and pass `user.id` (not name). `PresenceBar` local duplicate removed.

### Fix #7 — Trailing-edge throttle (`useThrottle.ts`)

Add optional `trailing` param. When true, schedules a final call after the last invocation clears the throttle window:

```ts
export function useThrottle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number,
  options?: { trailing?: boolean }
): T
```

`throttledCursorEmit` in `PianoRoll` uses `{ trailing: true }`.

### Fix #9 — Redis cursor store (`cursor.service.ts`)

New `@Injectable()` `CursorService`. Creates its own `ioredis` client using `process.env.REDIS_URL` (same pattern as gateway's `afterInit` — no shared injection exists in this codebase). Keeps cursor state alive across gateway restarts and works correctly in multi-instance deployments because Redis is the shared store.

Key format: `cursor:{songId}:{userId}` — allows `KEYS cursor:{songId}:*` pattern scan for `getCursors`. For production scale, use `SCAN` not `KEYS`.

### Fix #10 — Presence re-sync on reconnect (`useSocket.ts`)

`socket.io.on('reconnect')` already re-emits `join-song`. Server already sends `presence-list` to rejoining client. Client `presence-list` handler replaces entire state (correct). The `user-joined` duplicate guard (`prev.find(u => u.id)`) is already in place. No extra code needed beyond Fix #2 making `cursor-snapshot` fire on rejoin.

---

## File Change Map

| File | Action | Fixes |
|------|--------|-------|
| `apps/api/src/modules/realtime/cursor.service.ts` | **New** | #2, #5, #9 |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | Edit | #1, #2, #5 server |
| `apps/api/src/modules/realtime/realtime.module.ts` | Edit | register CursorService |
| `apps/web/src/features/collaboration/useSocket.ts` | Edit | #3, #5 client, #8 |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Edit | #4, #5 trigger |
| `apps/web/src/features/collaboration/CollaboratorCursors.tsx` | Edit | #6 |
| `apps/web/src/features/collaboration/PresenceBar.tsx` | Edit | #6 |
| `packages/shared/src/colors.ts` | Edit | #6 |
| `apps/web/src/hooks/useThrottle.ts` | Edit | #7 |

---

## Event Protocol (new/changed)

### New server → client events

| Event | Payload | When |
|-------|---------|------|
| `cursor-snapshot` | `{ cursors: CursorData[] }` | On `join-song`, on reconnect |
| `cursor-hidden` | `{ userId: string }` | On `cursor-hide` from client, on disconnect |

### New client → server events

| Event | Payload | When |
|-------|---------|------|
| `cursor-hide` | `{ songId: string }` | On `onMouseLeave` |

### Changed events

| Event | Change |
|-------|--------|
| `cursor-moved` | Unchanged — now also persisted to Redis |
| `user-left` | Now conditional: only emitted if no other sessions remain for user |

---

## Error Handling

- Redis `getCursors` failure: catch + log, send empty cursors array (presence still works)
- Redis `setCursor` failure: catch + log, cursor-move still broadcasts (degraded, not broken)
- `cursor-snapshot` with stale TTL-expired keys: Redis TTL auto-cleans; `getCursors` only returns live keys

---

## Out of Scope

- Cursor interpolation / smoothing animation (separate UX ticket)
- Conflict resolution for simultaneous note edits (handled by DB unique index + 409)
- CRDT-based presence (Option C, rejected)
