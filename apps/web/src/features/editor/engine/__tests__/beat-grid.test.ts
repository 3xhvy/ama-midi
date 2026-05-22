import { computeBeatLines } from '../beat-grid'

describe('computeBeatLines', () => {
  it('120bpm 4/4 from 0-2s @ pxPerSecond=10: 5 lines, first + last are measure boundaries', () => {
    const lines = computeBeatLines(0, 2, 120, '4/4', 10)
    expect(lines).toHaveLength(5)
    expect(lines[0]).toEqual({ y: 0,  weight: 'measure' })
    expect(lines[1]).toEqual({ y: 5,  weight: 'beat' })
    expect(lines[2]).toEqual({ y: 10, weight: 'beat' })
    expect(lines[3]).toEqual({ y: 15, weight: 'beat' })
    expect(lines[4]).toEqual({ y: 20, weight: 'measure' })
  })
})
