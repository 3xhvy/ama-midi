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
    },
  )

  check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'not a 500': (r) => r.status !== 500,
  })

  sleep(0.1)
}
