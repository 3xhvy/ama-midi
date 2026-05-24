import http from 'k6/http'
import { check, sleep } from 'k6'

// API limits: global THROTTLE_GLOBAL_LIMIT/min; POST notes uses THROTTLE_NOTE_WRITE_LIMIT/min.
// Local load test: set both to 10000 in apps/api/.env, restart API, then run default profile.
const vus = __ENV.VUS ? parseInt(__ENV.VUS, 10) : 100
const duration = __ENV.DURATION || '30s'
const sleepSeconds = __ENV.SLEEP ? parseFloat(__ENV.SLEEP) : 0.1

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_duration: ['p(95)<200'],
    // 409 = duplicate position (valid). 429 = rate limited (expected at high VU).
    http_req_failed: ['rate<0.05'],
    'checks{check:accepted}': ['rate>0.95'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
const CHART_ID = __ENV.CHART_ID || 'seed-chart-0000-0000-0000-0000000000001'
const TOKEN = __ENV.TOKEN || ''

export default function () {
  const payload = JSON.stringify({
    track: Math.ceil(Math.random() * 8),
    time: parseFloat((Math.random() * 300).toFixed(1)),
    title: 'Load test note',
  })

  const res = http.post(
    `${BASE_URL}/charts/${CHART_ID}/notes`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      // k6 treats 4xx as failed by default; 409 is a valid outcome here.
      responseCallback: http.expectedStatuses(201, 409),
    },
  )

  check(res, {
    accepted: (r) => r.status === 201 || r.status === 409,
    'not a 500': (r) => r.status !== 500,
    'not rate limited': (r) => r.status !== 429,
  })

  sleep(sleepSeconds)
}
