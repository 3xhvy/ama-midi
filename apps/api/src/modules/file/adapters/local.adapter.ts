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
