import type { NoteType } from '@ama-midi/shared'
import { trackFrequency } from './track-frequencies'

export interface PlayableNote {
  track: number
  noteType: NoteType
  duration?: number
}

export class NoteSynth {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private volume = 0.75
  private activeOscillators = new Set<OscillatorNode>()

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) this.masterGain.gain.value = this.volume
  }

  async ensureReady(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  private destination(ctx: AudioContext): AudioNode {
    return this.masterGain ?? ctx.destination
  }

  /** Cut all sounding notes immediately (e.g. on pause). */
  stopAll(): void {
    const now = this.ctx?.currentTime ?? 0
    for (const osc of this.activeOscillators) {
      try {
        osc.stop(now)
        osc.disconnect()
      } catch {
        // already stopped
      }
    }
    this.activeOscillators.clear()

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime)
    }
  }

  private trackOscillator(osc: OscillatorNode): void {
    this.activeOscillators.add(osc)
    osc.addEventListener('ended', () => {
      this.activeOscillators.delete(osc)
    })
  }

  private startOscillator(ctx: AudioContext, osc: OscillatorNode, gain: GainNode, stopAt: number) {
    osc.connect(gain).connect(this.destination(ctx))
    this.trackOscillator(osc)
    const t = ctx.currentTime
    osc.start(t)
    osc.stop(stopAt)
  }

  async playNote(note: PlayableNote): Promise<void> {
    const ctx = await this.ensureReady()
    const freq = trackFrequency(note.track)

    if (note.noteType === 'HOLD' && note.duration && note.duration > 0) {
      this.playHold(ctx, freq, note.duration)
      return
    }
    if (note.noteType === 'SWIPE') {
      this.playSwipe(ctx, freq)
      return
    }
    this.playTap(ctx, freq)
  }

  private playTap(ctx: AudioContext, freq: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    this.startOscillator(ctx, osc, gain, t + 0.13)
  }

  private playHold(ctx: AudioContext, freq: number, duration: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = ctx.currentTime
    const end = t + duration
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02)
    gain.gain.setValueAtTime(0.14, Math.max(t + 0.02, end - 0.06))
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    this.startOscillator(ctx, osc, gain, end + 0.01)
  }

  private playSwipe(ctx: AudioContext, baseFreq: number) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(baseFreq, t)
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.6, t + 0.14)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    this.startOscillator(ctx, osc, gain, t + 0.17)
  }

  dispose() {
    this.stopAll()
    void this.ctx?.close()
    this.ctx = null
    this.masterGain = null
  }
}
