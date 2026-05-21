import { NOTE_PRESET_COLORS, TRACK_MAX } from '@ama-midi/shared'

function App() {
  return (
    <div className="min-h-screen bg-app-bg p-8">
      <h1 className="text-2xl font-semibold text-primary mb-4">AMA-MIDI</h1>
      <p className="text-gray-600 mb-4">Max tracks: {TRACK_MAX}</p>
      <div className="flex gap-2">
        {NOTE_PRESET_COLORS.map((color) => (
          <div
            key={color}
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

export default App
