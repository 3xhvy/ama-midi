# R2 File Service + MIDI Placeholders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace disk-based backing track storage with Cloudflare R2 via a shared `FileService`, and add 501-stub MIDI import/export endpoints + song card UI buttons.

**Architecture:** A new `FileModule` exposes `FileService`, which delegates to either `R2StorageAdapter` (when R2 env vars are present) or `LocalStorageAdapter` (dev fallback). `BackingTrackService` drops all `fs` usage and calls `FileService`. The backing-track stream endpoint changes from returning bytes to redirecting (302) to a presigned URL. MIDI endpoints return 501; the frontend shows "coming soon" toasts.

**Tech Stack:** NestJS (backend), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, React + sonner (frontend), Jest + ts-jest (tests).

---

## File Map

**Create:**
- `apps/api/src/modules/file/adapters/storage.interface.ts` — `IStorageAdapter` interface
- `apps/api/src/modules/file/adapters/local.adapter.ts` — disk-based adapter (dev fallback)
- `apps/api/src/modules/file/adapters/r2.adapter.ts` — Cloudflare R2 adapter via AWS SDK v3
- `apps/api/src/modules/file/file.service.ts` — selects adapter; exposes upload/presign/delete
- `apps/api/src/modules/file/file.module.ts` — NestJS module; exports `FileService`
- `apps/api/src/modules/file/__tests__/file.service.spec.ts` — unit tests
- `apps/api/src/modules/file/__tests__/local.adapter.spec.ts` — unit tests
- `apps/api/src/modules/file/__tests__/r2.adapter.spec.ts` — unit tests

**Modify:**
- `apps/api/src/modules/songs/backing-track.service.ts` — replace `fs` calls with `FileService`
- `apps/api/src/modules/songs/__tests__/backing-track.service.spec.ts` — new file (doesn't exist yet), mocks `FileService`
- `apps/api/src/modules/songs/songs.controller.ts` — change stream to redirect; add MIDI stubs
- `apps/api/src/modules/songs/songs.module.ts` — import `FileModule`
- `apps/api/src/app.module.ts` — import `FileModule`
- `apps/web/src/features/songs/SongCard.tsx` — add MIDI dropdown
- `.env.example` — add R2 vars

---

## Task 1: Install AWS SDK v3 packages

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected output: packages appear in `node_modules/@aws-sdk/`.

- [ ] **Step 2: Verify install**

```bash
cd apps/api && node -e "require('@aws-sdk/client-s3'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore(api): install @aws-sdk/client-s3 and s3-request-presigner"
```

---

## Task 2: Define `IStorageAdapter` interface

**Files:**
- Create: `apps/api/src/modules/file/adapters/storage.interface.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// apps/api/src/modules/file/adapters/storage.interface.ts

export interface IStorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getPresignedUrl(key: string, ttlSeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}
```

No test needed — pure interface.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/file/
git commit -m "feat(file): add IStorageAdapter interface"
```

---

## Task 3: Implement `LocalStorageAdapter`

**Files:**
- Create: `apps/api/src/modules/file/adapters/local.adapter.ts`
- Create: `apps/api/src/modules/file/__tests__/local.adapter.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/modules/file/__tests__/local.adapter.spec.ts
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { LocalStorageAdapter } from '../adapters/local.adapter'

const TMP = join(process.cwd(), 'tmp-test-local-adapter')

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    adapter = new LocalStorageAdapter(TMP)
  })

  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('upload writes buffer to disk', async () => {
    await adapter.upload('backing-tracks/song-1', Buffer.from('hello'), 'audio/mpeg')
    const { readFileSync } = await import('fs')
    const content = readFileSync(join(TMP, 'backing-tracks/song-1'))
    expect(content.toString()).toBe('hello')
  })

  it('exists returns true after upload', async () => {
    await adapter.upload('backing-tracks/song-2', Buffer.from('x'), 'audio/mpeg')
    expect(await adapter.exists('backing-tracks/song-2')).toBe(true)
  })

  it('exists returns false for missing key', async () => {
    expect(await adapter.exists('backing-tracks/nope')).toBe(false)
  })

  it('delete removes the file', async () => {
    await adapter.upload('backing-tracks/song-3', Buffer.from('y'), 'audio/mpeg')
    await adapter.delete('backing-tracks/song-3')
    expect(await adapter.exists('backing-tracks/song-3')).toBe(false)
  })

  it('delete is a no-op for missing key', async () => {
    await expect(adapter.delete('backing-tracks/nope')).resolves.toBeUndefined()
  })

  it('getPresignedUrl returns local serve path', async () => {
    const url = await adapter.getPresignedUrl('backing-tracks/song-1')
    expect(url).toBe('/files/local/backing-tracks/song-1')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && pnpm test --testPathPattern=local.adapter
```

Expected: `Cannot find module '../adapters/local.adapter'`

- [ ] **Step 3: Implement `LocalStorageAdapter`**

```typescript
// apps/api/src/modules/file/adapters/local.adapter.ts
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import type { IStorageAdapter } from './storage.interface'

export class LocalStorageAdapter implements IStorageAdapter {
  constructor(private readonly basePath: string) {
    mkdirSync(basePath, { recursive: true })
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const full = join(this.basePath, key)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, buffer)
  }

  async getPresignedUrl(key: string, _ttlSeconds?: number): Promise<string> {
    return `/files/local/${key}`
  }

  async delete(key: string): Promise<void> {
    const full = join(this.basePath, key)
    if (existsSync(full)) unlinkSync(full)
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(join(this.basePath, key))
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && pnpm test --testPathPattern=local.adapter
```

Expected: `Tests: 6 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/file/
git commit -m "feat(file): LocalStorageAdapter — disk fallback for dev"
```

---

## Task 4: Implement `R2StorageAdapter`

**Files:**
- Create: `apps/api/src/modules/file/adapters/r2.adapter.ts`
- Create: `apps/api/src/modules/file/__tests__/r2.adapter.spec.ts`

- [ ] **Step 1: Write failing tests (mock AWS SDK)**

```typescript
// apps/api/src/modules/file/__tests__/r2.adapter.spec.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { R2StorageAdapter } from '../adapters/r2.adapter'

jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')

const mockSend = jest.fn()
;(S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }))
;(getSignedUrl as jest.Mock).mockResolvedValue('https://r2.example.com/presigned')

describe('R2StorageAdapter', () => {
  let adapter: R2StorageAdapter

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new R2StorageAdapter({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
  })

  it('upload sends PutObjectCommand with correct params', async () => {
    mockSend.mockResolvedValue({})
    await adapter.upload('backing-tracks/song-1', Buffer.from('data'), 'audio/mpeg')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call).toBeInstanceOf(PutObjectCommand)
    expect(call.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'backing-tracks/song-1',
      ContentType: 'audio/mpeg',
    })
    expect(call.input.Body).toBeInstanceOf(Buffer)
  })

  it('getPresignedUrl calls getSignedUrl with GetObjectCommand and default ttl 3600', async () => {
    const url = await adapter.getPresignedUrl('backing-tracks/song-1')
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(GetObjectCommand),
      { expiresIn: 3600 },
    )
    expect(url).toBe('https://r2.example.com/presigned')
  })

  it('getPresignedUrl respects custom ttl', async () => {
    await adapter.getPresignedUrl('backing-tracks/song-1', 7200)
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(GetObjectCommand),
      { expiresIn: 7200 },
    )
  })

  it('delete sends DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({})
    await adapter.delete('backing-tracks/song-1')

    const call = mockSend.mock.calls[0][0]
    expect(call).toBeInstanceOf(DeleteObjectCommand)
    expect(call.input).toMatchObject({ Bucket: 'test-bucket', Key: 'backing-tracks/song-1' })
  })

  it('exists returns true when HeadObject succeeds', async () => {
    mockSend.mockResolvedValue({})
    expect(await adapter.exists('backing-tracks/song-1')).toBe(true)
  })

  it('exists returns false when HeadObject throws NotFound', async () => {
    const err = Object.assign(new Error('not found'), { name: 'NotFound' })
    mockSend.mockRejectedValue(err)
    expect(await adapter.exists('backing-tracks/song-1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && pnpm test --testPathPattern=r2.adapter
```

Expected: `Cannot find module '../adapters/r2.adapter'`

- [ ] **Step 3: Implement `R2StorageAdapter`**

```typescript
// apps/api/src/modules/file/adapters/r2.adapter.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { IStorageAdapter } from './storage.interface'

export interface R2Config {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export class R2StorageAdapter implements IStorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    })
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    )
  }

  async getPresignedUrl(key: string, ttlSeconds: number = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    )
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      return true
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw err
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && pnpm test --testPathPattern=r2.adapter
```

Expected: `Tests: 6 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/file/
git commit -m "feat(file): R2StorageAdapter — Cloudflare R2 via AWS SDK v3"
```

---

## Task 5: Implement `FileService` with adapter selection

**Files:**
- Create: `apps/api/src/modules/file/file.service.ts`
- Create: `apps/api/src/modules/file/__tests__/file.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/modules/file/__tests__/file.service.spec.ts
import { FileService } from '../file.service'
import type { IStorageAdapter } from '../adapters/storage.interface'

function mockAdapter(): jest.Mocked<IStorageAdapter> {
  return {
    upload: jest.fn().mockResolvedValue(undefined),
    getPresignedUrl: jest.fn().mockResolvedValue('https://example.com/presigned'),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
  }
}

describe('FileService', () => {
  let adapter: jest.Mocked<IStorageAdapter>
  let service: FileService

  beforeEach(() => {
    adapter = mockAdapter()
    service = new FileService(adapter)
  })

  it('upload delegates to adapter with correct args', async () => {
    const buf = Buffer.from('audio')
    await service.upload('backing-tracks/song-1', buf, 'audio/mpeg')
    expect(adapter.upload).toHaveBeenCalledWith('backing-tracks/song-1', buf, 'audio/mpeg')
  })

  it('getPresignedUrl delegates to adapter with default ttl', async () => {
    const url = await service.getPresignedUrl('backing-tracks/song-1')
    expect(adapter.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 3600)
    expect(url).toBe('https://example.com/presigned')
  })

  it('getPresignedUrl passes custom ttl', async () => {
    await service.getPresignedUrl('backing-tracks/song-1', 7200)
    expect(adapter.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 7200)
  })

  it('delete delegates to adapter', async () => {
    await service.delete('backing-tracks/song-1')
    expect(adapter.delete).toHaveBeenCalledWith('backing-tracks/song-1')
  })

  it('backingTrackKey returns correct key format', () => {
    expect(service.backingTrackKey('song-abc')).toBe('backing-tracks/song-abc')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && pnpm test --testPathPattern=file.service
```

Expected: `Cannot find module '../file.service'`

- [ ] **Step 3: Implement `FileService`**

```typescript
// apps/api/src/modules/file/file.service.ts
import { Injectable } from '@nestjs/common'
import type { IStorageAdapter } from './adapters/storage.interface'

@Injectable()
export class FileService {
  constructor(private readonly adapter: IStorageAdapter) {}

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    return this.adapter.upload(key, buffer, mimeType)
  }

  async getPresignedUrl(key: string, ttlSeconds: number = 3600): Promise<string> {
    return this.adapter.getPresignedUrl(key, ttlSeconds)
  }

  async delete(key: string): Promise<void> {
    return this.adapter.delete(key)
  }

  backingTrackKey(songId: string): string {
    return `backing-tracks/${songId}`
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && pnpm test --testPathPattern=file.service
```

Expected: `Tests: 5 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/file/
git commit -m "feat(file): FileService — delegates upload/presign/delete to adapter"
```

---

## Task 6: Create `FileModule` with adapter factory

**Files:**
- Create: `apps/api/src/modules/file/file.module.ts`

- [ ] **Step 1: Create the module**

```typescript
// apps/api/src/modules/file/file.module.ts
import { Module } from '@nestjs/common'
import { FileService } from './file.service'
import { R2StorageAdapter } from './adapters/r2.adapter'
import { LocalStorageAdapter } from './adapters/local.adapter'
import { join } from 'path'

const FILE_ADAPTER_TOKEN = 'FILE_ADAPTER'

@Module({
  providers: [
    {
      provide: FILE_ADAPTER_TOKEN,
      useFactory: () => {
        const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
        if (R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
          return new R2StorageAdapter({
            endpoint: R2_ENDPOINT,
            bucket: R2_BUCKET,
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
          })
        }
        const basePath = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
        return new LocalStorageAdapter(basePath)
      },
    },
    {
      provide: FileService,
      useFactory: (adapter: InstanceType<typeof R2StorageAdapter | typeof LocalStorageAdapter>) =>
        new FileService(adapter),
      inject: [FILE_ADAPTER_TOKEN],
    },
  ],
  exports: [FileService],
})
export class FileModule {}
```

No unit test for the module wiring — NestJS module factory is integration-level.

- [ ] **Step 2: Register `FileModule` in `AppModule`**

In `apps/api/src/app.module.ts`, add:

```typescript
import { FileModule } from './modules/file/file.module'
```

And add `FileModule` to the `imports` array (after `PrismaModule`):

```typescript
imports: [
  EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),
  ThrottlerModule.forRoot([globalThrottlerOptions]),
  PrismaModule,
  FileModule,          // ← add here
  ProjectAccessModule,
  // ... rest unchanged
],
```

- [ ] **Step 3: Run all API tests — no regressions**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/file/file.module.ts apps/api/src/app.module.ts
git commit -m "feat(file): FileModule — adapter factory, registered in AppModule"
```

---

## Task 7: Refactor `BackingTrackService` to use `FileService`

**Files:**
- Modify: `apps/api/src/modules/songs/backing-track.service.ts`
- Create: `apps/api/src/modules/songs/__tests__/backing-track.service.spec.ts`

- [ ] **Step 1: Write failing tests (mocking FileService)**

```typescript
// apps/api/src/modules/songs/__tests__/backing-track.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { BackingTrackService } from '../backing-track.service'
import { FileService } from '../../file/file.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const prisma = {
  song: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

const access = {
  assertCanEditSongChart: jest.fn().mockResolvedValue(undefined),
  assertCanViewSong: jest.fn().mockResolvedValue(undefined),
}

const fileService = {
  upload: jest.fn().mockResolvedValue(undefined),
  getPresignedUrl: jest.fn().mockResolvedValue('https://r2.example.com/presigned?token=x'),
  delete: jest.fn().mockResolvedValue(undefined),
  backingTrackKey: jest.fn((id: string) => `backing-tracks/${id}`),
}

const user = { id: 'user-1', email: 'a@b.com', role: 'COMPOSER' } as any

describe('BackingTrackService', () => {
  let service: BackingTrackService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new BackingTrackService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
      fileService as unknown as FileService,
    )
  })

  describe('upload', () => {
    it('throws BadRequestException when no file provided', async () => {
      await expect(service.upload('song-1', null as any, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws BadRequestException for unsupported mime type', async () => {
      const file = { buffer: Buffer.from(''), mimetype: 'application/pdf', size: 100, originalname: 'x.pdf' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws BadRequestException when file exceeds 50 MB', async () => {
      const file = { buffer: Buffer.alloc(1), mimetype: 'audio/mpeg', size: 51 * 1024 * 1024, originalname: 'big.mp3' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws NotFoundException when song does not exist', async () => {
      prisma.song.findUnique.mockResolvedValue(null)
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/mpeg', size: 100, originalname: 'track.mp3' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('uploads to FileService and updates DB on success', async () => {
      prisma.song.findUnique.mockResolvedValue({ id: 'song-1' })
      prisma.song.update.mockResolvedValue({})
      const file = { buffer: Buffer.from('audio'), mimetype: 'audio/mpeg', size: 1000, originalname: 'track.mp3' }

      const result = await service.upload('song-1', file, user)

      expect(fileService.upload).toHaveBeenCalledWith('backing-tracks/song-1', file.buffer, 'audio/mpeg')
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-1' },
        data: { backingTrackFileName: 'track.mp3', backingTrackUrl: null },
      })
      expect(result).toEqual({ backingTrackFileName: 'track.mp3', backingTrackUrl: null })
    })
  })

  describe('stream', () => {
    it('throws NotFoundException when song has no backing track', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: null, backingTrackUrl: null })
      await expect(service.stream('song-1', user)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('returns presigned URL for uploaded file', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: 'track.mp3', backingTrackUrl: null })
      const result = await service.stream('song-1', user)
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 3600)
      expect(result).toEqual({ redirectUrl: 'https://r2.example.com/presigned?token=x' })
    })

    it('returns external URL when backingTrackUrl is set', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: null, backingTrackUrl: 'https://cdn.example.com/track.mp3' })
      const result = await service.stream('song-1', user)
      expect(fileService.getPresignedUrl).not.toHaveBeenCalled()
      expect(result).toEqual({ redirectUrl: 'https://cdn.example.com/track.mp3' })
    })
  })

  describe('remove', () => {
    it('calls FileService.delete and clears DB fields', async () => {
      prisma.song.update.mockResolvedValue({})
      await service.remove('song-1', user)
      expect(fileService.delete).toHaveBeenCalledWith('backing-tracks/song-1')
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-1' },
        data: { backingTrackUrl: null, backingTrackFileName: null },
      })
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && pnpm test --testPathPattern=backing-track.service
```

Expected: FAIL (service constructor signature mismatch).

- [ ] **Step 3: Rewrite `BackingTrackService`**

```typescript
// apps/api/src/modules/songs/backing-track.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthUser } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { FileService } from '../file/file.service'

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
])

const MAX_BYTES = 50 * 1024 * 1024

interface UploadedAudioFile {
  buffer: Buffer
  mimetype: string
  size: number
  originalname: string
}

@Injectable()
export class BackingTrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly fileService: FileService,
  ) {}

  async upload(songId: string, file: UploadedAudioFile, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    if (!file) throw new BadRequestException('No file uploaded')
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds 50 MB limit')
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported audio format — use MP3, WAV, or OGG')
    }

    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.upload(key, file.buffer, file.mimetype)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackFileName: file.originalname, backingTrackUrl: null },
    })

    return { backingTrackFileName: file.originalname, backingTrackUrl: null }
  }

  async setExternalUrl(songId: string, url: string | null, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    if (url !== null && url.trim()) {
      try {
        const parsed = new URL(url.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new BadRequestException('URL must use http or https')
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e
        throw new BadRequestException('Invalid URL')
      }
    }

    // Delete any previously uploaded file from storage
    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.delete(key)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackUrl: url?.trim() || null, backingTrackFileName: null },
    })

    return { backingTrackUrl: url?.trim() || null, backingTrackFileName: null }
  }

  /**
   * Returns a URL for the backing track.
   * For uploaded files: generates a presigned R2 URL (or local path in dev).
   * For external URLs: returns the external URL directly.
   * Controller redirects (302) to this URL.
   */
  async stream(songId: string, user: AuthUser): Promise<{ redirectUrl: string }> {
    await this.access.assertCanViewSong(songId, user)

    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: { backingTrackFileName: true, backingTrackUrl: true },
    })

    if (!song?.backingTrackFileName && !song?.backingTrackUrl) {
      throw new NotFoundException('No backing track')
    }

    if (song.backingTrackUrl) {
      return { redirectUrl: song.backingTrackUrl }
    }

    const key = this.fileService.backingTrackKey(songId)
    const redirectUrl = await this.fileService.getPresignedUrl(key, 3600)
    return { redirectUrl }
  }

  async remove(songId: string, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.delete(key)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackUrl: null, backingTrackFileName: null },
    })

    return { ok: true }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && pnpm test --testPathPattern=backing-track.service
```

Expected: `Tests: 9 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/songs/backing-track.service.ts apps/api/src/modules/songs/__tests__/backing-track.service.spec.ts
git commit -m "feat(songs): BackingTrackService delegates storage to FileService"
```

---

## Task 8: Update `SongsModule` and `SongsController`

**Files:**
- Modify: `apps/api/src/modules/songs/songs.module.ts`
- Modify: `apps/api/src/modules/songs/songs.controller.ts`

- [ ] **Step 1: Import `FileModule` in `SongsModule`**

```typescript
// apps/api/src/modules/songs/songs.module.ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { FileModule } from '../file/file.module'
import { SongsController } from './songs.controller'
import { ProjectSongsController } from './project-songs.controller'
import { SongTemplateService } from './song-template.service'
import { SongsService } from './songs.service'
import { BackingTrackService } from './backing-track.service'

@Module({
  imports: [PrismaModule, ProjectAccessModule, ChartsModule, FileModule],
  controllers: [SongsController, ProjectSongsController],
  providers: [SongsService, SongTemplateService, BackingTrackService],
  exports: [SongsService],
})
export class SongsModule {}
```

- [ ] **Step 2: Update `SongsController` — stream endpoint + MIDI stubs**

Replace the full controller:

```typescript
// apps/api/src/modules/songs/songs.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req,
  UploadedFile, UseInterceptors, Res,
  HttpException, HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response, Request } from 'express'
import { SongsService } from './songs.service'
import { BackingTrackService } from './backing-track.service'
import { UpdateSongDto } from './dto/update-song.dto'
import { UpdateSongStatusDto } from './dto/update-song-status.dto'
import { SetBackingTrackUrlDto } from './dto/set-backing-track-url.dto'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs')
@UseGuards(AuthGuard('jwt'))
export class SongsController {
  constructor(
    private readonly songs: SongsService,
    private readonly backingTrack: BackingTrackService,
  ) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.songs.findAll(req.user as AuthUser)
  }

  @Get(':id/workflow')
  getWorkflow(@Param('id') id: string, @Req() req: Request) {
    return this.songs.getWorkflow(id, req.user as AuthUser)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.songs.findOne(id, req.user as AuthUser)
  }

  @Post()
  create(@Body('name') name: string, @Req() req: Request) {
    return this.songs.create(name, req.user as AuthUser)
  }

  @Patch(':id/status')
  transitionStatus(@Param('id') id: string, @Body() dto: UpdateSongStatusDto, @Req() req: Request) {
    return this.songs.transitionStatus(id, dto, req.user as AuthUser)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSongDto, @Req() req: Request) {
    return this.songs.update(id, dto, req.user as AuthUser)
  }

  @Post(':id/backing-track/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadBackingTrack(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    @Req() req: Request,
  ) {
    return this.backingTrack.upload(id, file, req.user as AuthUser)
  }

  @Patch(':id/backing-track/url')
  setBackingTrackUrl(
    @Param('id') id: string,
    @Body() dto: SetBackingTrackUrlDto,
    @Req() req: Request,
  ) {
    return this.backingTrack.setExternalUrl(id, dto.url ?? null, req.user as AuthUser)
  }

  @Get(':id/backing-track')
  async streamBackingTrack(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.backingTrack.stream(id, req.user as AuthUser)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.redirect(302, redirectUrl)
  }

  @Delete(':id/backing-track')
  removeBackingTrack(@Param('id') id: string, @Req() req: Request) {
    return this.backingTrack.remove(id, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.songs.remove(id, req.user as AuthUser)
  }

  // ── MIDI placeholders ──────────────────────────────────────────────────────

  @Post(':id/midi/import')
  importMidi() {
    throw new HttpException('MIDI import coming soon', HttpStatus.NOT_IMPLEMENTED)
  }

  @Get(':id/midi/export')
  exportMidi() {
    throw new HttpException('MIDI export coming soon', HttpStatus.NOT_IMPLEMENTED)
  }
}
```

- [ ] **Step 3: Run all API tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass (backing-track tests use mocked FileService — no real R2 calls).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/songs/songs.module.ts apps/api/src/modules/songs/songs.controller.ts
git commit -m "feat(songs): wire FileModule, redirect backing-track stream, add MIDI 501 stubs"
```

---

## Task 9: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add R2 vars**

Append to `.env.example`:

```bash
# Cloudflare R2 (leave blank to fall back to local disk in dev)
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET=ama-midi-files
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add R2 env vars to .env.example"
```

---

## Task 10: Frontend — MIDI dropdown on `SongCard`

**Files:**
- Modify: `apps/web/src/features/songs/SongCard.tsx`

- [ ] **Step 1: Update `SongCard` with MIDI menu**

```tsx
// apps/web/src/features/songs/SongCard.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '../../lib/utils'
import { Button, StatusBadge, Avatar } from '../../components/ui'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import type { Song } from '@ama-midi/shared'
import { songEditorPath } from '../navigation/song-editor-path'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function TrackDots({ noteCount }: { noteCount: number }) {
  const filled = Math.min(8, Math.round((noteCount / 50) * 8))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{
            backgroundColor:
              i < filled
                ? NOTE_PRESET_COLORS[i % NOTE_PRESET_COLORS.length]
                : 'var(--shell-border)',
          }}
        />
      ))}
    </div>
  )
}

function MidiMenu({ songId }: { songId: string }) {
  const token = useAuthStore((s) => s.token)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  function close() {
    setOpen(false)
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      close()
    }
  }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      document.addEventListener('mousedown', handleClickOutside, { once: true })
    }
    setOpen((v) => !v)
  }

  async function callMidiEndpoint(method: 'POST' | 'GET', path: string) {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/songs/${songId}/${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 501) {
        const body = await res.json().catch(() => ({}))
        toast.info(body.message ?? 'Coming soon')
      } else if (!res.ok) {
        toast.error('Something went wrong')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
      close()
    }
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    if (!e.target.files?.length) return
    // Reset input so same file can be re-selected later
    e.target.value = ''
    callMidiEndpoint('POST', 'midi/import')
  }

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        className="text-xs text-shell-muted hover:text-shell-text px-1.5 py-0.5 rounded transition-colors"
        onClick={toggle}
        title="MIDI options"
        aria-label="MIDI options"
        disabled={busy}
      >
        ···
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-50 min-w-[140px] rounded-lg border border-shell-border bg-shell-surface shadow-lg py-1">
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-shell-text hover:bg-shell-bg transition-colors"
            onClick={() => importRef.current?.click()}
            disabled={busy}
          >
            Import MIDI
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-shell-text hover:bg-shell-bg transition-colors"
            onClick={() => callMidiEndpoint('GET', 'midi/export')}
            disabled={busy}
          >
            Export MIDI
          </button>
        </div>
      )}

      {/* Hidden file input — accepts .mid and .midi */}
      <input
        ref={importRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={handleImportFileChange}
      />
    </div>
  )
}

export function SongCard({ song, className }: { song: Song; className?: string }) {
  const navigate = useNavigate()
  return (
    <div
      className={cn(
        'bg-shell-surface rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 border border-shell-border cursor-pointer group',
        className,
      )}
      onClick={() => navigate(songEditorPath(song.projectId, song.id))}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-shell-text text-[15px] truncate">{song.name}</h3>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <MidiMenu songId={song.id} />
          <StatusBadge status="draft" />
        </div>
      </div>
      <TrackDots noteCount={song.noteCount ?? 0} />
      <div className="flex items-center gap-1.5 mt-3">
        <Avatar name={song.creatorName ?? 'Unknown'} src={song.creatorAvatarUrl} size="xs" />
        <span className="text-xs text-shell-muted truncate">{song.creatorName ?? 'Unknown'}</span>
        <span className="text-xs text-shell-muted ml-auto">{timeAgo(song.updatedAt)}</span>
      </div>
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="primary"
          size="sm"
          rounded
          className="w-full"
          onClick={(e) => {
            e.stopPropagation()
            navigate(songEditorPath(song.projectId, song.id))
          }}
        >
          Open Editor
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify web builds without TS errors**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```

Expected: `built in` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/songs/SongCard.tsx
git commit -m "feat(web): MIDI import/export placeholder buttons on SongCard"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run full API test suite**

```bash
cd apps/api && pnpm test
```

Expected: all specs pass.

- [ ] **Step 2: Run lint**

```bash
cd /path/to/ama-midi && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Smoke-test dev server (local adapter path)**

```bash
pnpm dev
```

In a second terminal:
```bash
# Upload a backing track (replace TOKEN and SONG_ID)
curl -s -X POST http://localhost:3001/songs/SONG_ID/backing-track/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/test.mp3" | jq .

# Should 302-redirect to /files/local/backing-tracks/SONG_ID
curl -v -L http://localhost:3001/songs/SONG_ID/backing-track \
  -H "Authorization: Bearer TOKEN"

# MIDI stubs — expect 501
curl -s -X POST http://localhost:3001/songs/SONG_ID/midi/import \
  -H "Authorization: Bearer TOKEN" | jq .
# → { "message": "MIDI import coming soon", "statusCode": 501 }
```

- [ ] **Step 4: Final commit (if any stray changes)**

```bash
git status
# If clean, skip. Otherwise:
git add -A && git commit -m "chore: final cleanup after R2 file service implementation"
```
