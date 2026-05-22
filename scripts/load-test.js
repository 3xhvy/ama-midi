import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.05'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const SONG_ID = __ENV.SONG_ID || 'test-song-id'
const TOKEN = __ENV.TOKEN || ''

export default function () {
  const payload = JSON.stringify({
    track: Math.ceil(Math.random() * 8),
    time: parseFloat((Math.random() * 300).toFixed(1)),
    title: 'Load test note',
    color: '#6366F1',
  })

  const res = http.post(
    `${BASE_URL}/songs/${SONG_ID}/notes`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  )

  check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'not a 500': (r) => r.status !== 500,
  })

  sleep(0.1)
}
