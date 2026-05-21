import { Injectable } from '@nestjs/common'
import { TRACK_MAX } from '@ama-midi/shared'

@Injectable()
export class AppService {
  getHealth(): { status: string; timestamp: string; maxTracks: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      maxTracks: TRACK_MAX,
    }
  }
}
