# Design: R2 File Service + MIDI Import/Export Placeholders

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** `apps/api`, `apps/web`

---

## Problem

`BackingTrackService` writes audio files to local disk (`uploads/backing-tracks/`). This breaks on Railway (ephemeral filesystem) and doesn't scale across API instances. MIDI import/export is a planned feature with no scaffolding yet.

---

## Goals

1. Replace disk-based backing track storage with Cloudflare R2 (S3-compatible).
2. Introduce a shared `FileService` abstraction so future file types (MIDI, exports) reuse the same storage layer.
3. Add placeholder MIDI import/export — API returns 501, UI shows "coming soon" toast.

---

## Non-Goals

- Actual MIDI parsing/generation (future work).
- DB table tracking uploaded files (not needed yet — song already stores `backingTrackFileName` / `backingTrackUrl`).
- Public CDN URLs (using presigned URLs instead).

---

## Architecture

### Storage Abstraction

```
IStorageAdapter (interface)
├── R2StorageAdapter     (production — Cloudflare R2 via AWS SDK v3)
└── LocalStorageAdapter  (dev fallback — disk + local serve endpoint)

FileService
└── delegates to whichever adapter is active

BackingTrackService
└── calls FileService (drops all direct fs usage)
```

### Adapter Selection

`FileService` checks env vars at module init:
- If `R2_ENDPOINT` + `R2_BUCKET` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` all present → `R2StorageAdapter`
- Otherwise → `LocalStorageAdapter` (dev-friendly, no config required)

---

## Backend

### New Module: `apps/api/src/modules/file/`

```
file/
  file.module.ts
  file.service.ts          ← FileService (orchestrates adapter)
  adapters/
    storage.interface.ts   ← IStorageAdapter
    r2.adapter.ts          ← R2StorageAdapter
    local.adapter.ts       ← LocalStorageAdapter
```

### `IStorageAdapter` interface

```ts
interface IStorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
```

### `R2StorageAdapter`

- Package: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Config: `endpoint = R2_ENDPOINT`, `region = 'auto'`, `forcePathStyle = false`
- `upload`: `PutObjectCommand`
- `getPresignedUrl`: `getSignedUrl(client, GetObjectCommand, { expiresIn: ttlSeconds ?? 3600 })`
- `delete`: `DeleteObjectCommand`
- `exists`: `HeadObjectCommand` — catch `NoSuchKey` → false

### `LocalStorageAdapter`

- Writes to `process.env.UPLOAD_DIR ?? ./uploads` (same dir as current)
- `getPresignedUrl(key)` → returns `/files/local/${key}` (relative URL)
- A new `GET /files/local/*` controller endpoint serves the file from disk (dev only)

### `FileService`

```ts
class FileService {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
}
```

Key naming convention:
- Backing tracks: `backing-tracks/{songId}`
- Future MIDI: `midi/{songId}.mid`

### `BackingTrackService` changes

Remove: all `fs`, `createReadStream`, `existsSync`, `mkdirSync`, `unlinkSync` imports and direct file operations.

Replace:
- `upload()` → `fileService.upload(key, file.buffer, file.mimetype)`
- `stream()` → `fileService.getPresignedUrl(key)` → redirect 302 to presigned URL  
  **Note:** This changes the HTTP contract from streaming bytes to redirect. Browsers follow 302 transparently for `<audio src>` and `fetch`. NestJS `@Res()` used to issue redirect.
- `remove()` → `fileService.delete(key)`

DB field `backingTrackUrl` stores the presigned URL (or null if not uploaded). On stream request, generate fresh presigned URL — don't cache in DB.

### MIDI Placeholder Endpoints

Add to `songs.controller.ts`:

```ts
@Post(':id/midi/import')
importMidi(@Param('id') id: string) {
  throw new HttpException('MIDI import coming soon', HttpStatus.NOT_IMPLEMENTED)
}

@Get(':id/midi/export')
exportMidi(@Param('id') id: string) {
  throw new HttpException('MIDI export coming soon', HttpStatus.NOT_IMPLEMENTED)
}
```

No service logic. No auth guard change needed (inherits class-level `@UseGuards`).

---

## Frontend

### SongCard dropdown additions

File: `apps/web/src/features/songs/SongCard.tsx`

Add two items to the existing song options dropdown:
- **Import MIDI** — renders a hidden `<input type="file" accept=".mid,.midi">`, click triggers it, `onChange` calls `POST /songs/:id/midi/import` → shows toast `"MIDI import coming soon"`
- **Export MIDI** — calls `GET /songs/:id/midi/export` → shows toast `"MIDI export coming soon"`

Both items use existing toast infrastructure. No new files.

---

## Environment Variables

Add to `.env.example` and Railway:

```env
# Cloudflare R2 (leave empty to use local disk fallback)
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET=ama-midi-files
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| R2 upload fails | Propagate as 502 Bad Gateway |
| R2 presign fails | 502 Bad Gateway |
| File not in R2 | 404 Not Found |
| Unsupported MIME | 400 Bad Request (unchanged) |
| File > 50 MB | 400 Bad Request (unchanged) |
| MIDI endpoints | 501 Not Implemented |

---

## Testing

- `FileService`: unit test with mocked adapter — verify key format, TTL default
- `BackingTrackService`: existing tests updated to mock `FileService` instead of `fs`
- `R2StorageAdapter`: integration test skipped unless `R2_*` env vars present (same pattern as DB integration tests)
- MIDI endpoints: controller test asserts 501 response

---

## Migration

No DB migration needed. Files already uploaded to disk remain served via existing `backingTrackUrl` field (null = local file, which will now 404 on deployed instances — acceptable, users re-upload). No data loss risk.

---

## Open Questions

None — all decisions made.
