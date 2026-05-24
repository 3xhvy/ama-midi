import { NoteSynth } from './note-synth'

let sharedSynth: NoteSynth | null = null

export function getSharedNoteSynth(): NoteSynth {
  if (!sharedSynth) sharedSynth = new NoteSynth()
  return sharedSynth
}

/** Call from a user gesture (e.g. Play button) so chart sounds are allowed. */
export function unlockChartAudio(): void {
  void getSharedNoteSynth().ensureReady()
}

export function setChartSoundVolume(volume: number): void {
  getSharedNoteSynth().setVolume(volume)
}

export function stopChartSounds(): void {
  getSharedNoteSynth().stopAll()
}
