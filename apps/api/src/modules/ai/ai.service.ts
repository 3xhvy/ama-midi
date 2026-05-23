import { Injectable, ForbiddenException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AiService {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  constructor(private readonly prisma: PrismaService) {}

  async suggestNotes(songId: string, userId: string, userRole: string) {
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI suggestions')

    const recentNotes = await this.prisma.note.findMany({
      where: { songId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    if (recentNotes.length < 5) {
      return { suggestions: [] }
    }

    const lastNote = recentNotes[0]
    const noteSummary = recentNotes
      .map((n) => ({ track: n.track, time: n.time }))
      .reverse()

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: 'You are a MIDI note pattern assistant. Return ONLY a JSON array, no explanation, no markdown.',
      messages: [
        {
          role: 'user',
          content: `Here are the last notes placed: ${JSON.stringify(noteSummary)}. Suggest 4 next notes that continue this rhythmic and track pattern. Each suggestion needs: track (1-8 integer), time (float, must be after ${lastNote.time}, max 300). Return only a JSON array: [{"track":2,"time":6.0}]`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]'

    let suggestions: Array<{ track: number; time: number }> = []
    try {
      const parsed = JSON.parse(text.trim()) as unknown
      suggestions = Array.isArray(parsed)
        ? (parsed as Array<Record<string, unknown>>).filter(
            (s) =>
              Number.isInteger(s.track) &&
              (s.track as number) >= 1 &&
              (s.track as number) <= 8 &&
              typeof s.time === 'number' &&
              (s.time as number) >= 0 &&
              (s.time as number) <= 300,
          ).map((s) => ({
            track: s.track as number,
            time: s.time as number,
          }))
        : []
    } catch {
      suggestions = []
    }

    return { suggestions }
  }
}
