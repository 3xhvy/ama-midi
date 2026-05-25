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
