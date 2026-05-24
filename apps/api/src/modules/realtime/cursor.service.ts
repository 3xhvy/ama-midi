import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

export interface StoredCursor {
  userId: string
  name:   string
  title?: string | null
  track:  number
  time:   number
}

@Injectable()
export class CursorService implements OnModuleDestroy {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()
  }

  private key(songId: string, userId: string): string {
    return `cursor:${songId}:${userId}`
  }

  async setCursor(songId: string, userId: string, data: StoredCursor): Promise<void> {
    await this.redis.set(this.key(songId, userId), JSON.stringify(data), 'EX', 5)
  }

  async getCursors(songId: string): Promise<StoredCursor[]> {
    const keys = await this.redis.keys(`cursor:${songId}:*`)
    if (keys.length === 0) return []
    const values = await this.redis.mget(...keys)
    return values
      .filter((v): v is string => v !== null)
      .map(v => JSON.parse(v) as StoredCursor)
  }

  async deleteCursor(songId: string, userId: string): Promise<void> {
    await this.redis.del(this.key(songId, userId))
  }
}
