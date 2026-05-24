# Performance & Correctness Testing

← [README](../../README.md) · [← Deploy Pipeline](./09-deploy.md) · [Load Testing (k6) →](./11-load-testing.md)

These are the checks I ran to back up the three properties the case study cares about: no duplicate writes under concurrency, valid rejection of out-of-range input, and acceptable performance at scale (API + UI).

I'm writing this for whoever is grading the submission — less a generic test plan, more "here's what I actually did and what I looked for."

---

## Setup

```bash
# Full stack
docker-compose up --build

# Or locally (what I used most of the time):
pnpm dev
CHART_ID="<your-chart-id>" pnpm seed
```

I need a JWT (web app → DevTools → Local Storage → `token`), a chart ID I can edit, and k6 for the load section (`brew install k6`).

---

## Test 1: Conflict / duplicate prevention

**Why I care:** Two composers clicking the same cell at once must not create two rows. The case study is explicit about one 201 and one 409, never a 500.

**What I did:**

```bash
export TOKEN="<paste jwt here>"
export API="http://localhost:3001"
export CHART_ID="<paste chart id>"

curl -s -o /tmp/r1.json -w "%{http_code}" \
  -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":1,"time":5.0,"title":"conflict-test"}' &

curl -s -o /tmp/r2.json -w "%{http_code}" \
  -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":1,"time":5.0,"title":"conflict-test"}' &

wait
cat /tmp/r1.json && echo
cat /tmp/r2.json && echo
```

**What I expect:**

- One **201** with a note body, one **409** (`A note already exists at track 1, time 5.0`)
- Neither **500**
- DB: `SELECT count(*) FROM notes WHERE track=1 AND time=5.0 AND deleted_at IS NULL;` → **1**

This is enforced by a partial unique index at the database layer, not an app-level pre-check — I chose that on purpose so races can't slip through.

---

## Test 2: Boundary validation

**Why I care:** Invalid track/time should come back **400**, not get stored or blow up as **500**.

**What I did** — four curls outside the valid range (track 1–8, time 0–300s):

```bash
# time = 301
curl -s -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":1,"time":301.0,"title":"boundary-test"}' | jq .

# time = -1
curl -s -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":1,"time":-1.0,"title":"boundary-test"}' | jq .

# track = 9
curl -s -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":9,"time":10.0,"title":"boundary-test"}' | jq .

# track = 0
curl -s -X POST "$API/charts/$CHART_ID/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"track":0,"time":10.0,"title":"boundary-test"}' | jq .
```

**What I expect:** four **400** responses with clear validation messages (`time must not be greater than 300`, etc.).

---

## Test 3: Load test (API throughput)

**Why I care:** The brief asks for 100 concurrent users creating notes with p95 < 200ms and no 500s.

**How I ran it:** [Load Testing (k6)](./11-load-testing.md) — seed, curl probe, smoke, full 100 VU, throttle notes.

Quick smoke (passes on my machine with default limits):

```bash
BASE_URL=http://localhost:3001 \
CHART_ID="$CHART_ID" TOKEN="$TOKEN" \
VUS=1 DURATION=60s SLEEP=2 \
k6 run scripts/load-test.js
```

**What I found:** Smoke passes (~~143ms p95). The first full 100 VU run passed on correctness but failed latency (~~3s p95) because I was running full chart analysis synchronously on every create. After I moved that to a debounced background job, 100 VU p95 dropped to **~37ms**. The full story — including why some 100 VU runs still show 429 — is in **[k6 Test Report](./12-k6-test-report.md)**.

---

## Test 4: 10,000-note rendering (UI)

**Why I care:** The editor must stay usable with 10k notes on a chart, not mount 10k DOM nodes.

**What I did:**

1. Seed: `cd apps/api && pnpm seed` (or `CHART_ID=... pnpm seed` on my chart)
2. Open `http://localhost:3000`, navigate to the seeded song's editor
3. DevTools → Performance → record while scrolling 0s–300s over ~10 seconds
4. Check: no sustained frame drops below 30fps; scripting < 16ms per frame where possible
5. DevTools → Elements → search `data-note` — I expect **~50–200** nodes in the DOM, not 10,000
6. Memory snapshot → filter `NoteCircle` — only visible instances mounted

The two-layer windowing (API time window + client viewport clamp) is what makes this workable; I document the approach in [Architecture](./05-architecture.md).

---

## Test 5: Real-time collaboration

**Why I care:** Multiple composers on the same song should see changes within about a second, without corrupting state.

**What I did:**

1. Same song open in two windows (incognito for a second user)
2. Window A: place a note at Track 3, Time 45.0s → appears in B within ~1s, no refresh
3. Window B: delete it → gone from A within ~1s
4. Both place at Track 2, Time 10.0s simultaneously → one note survives, one window gets a 409 toast

Socket.io rooms per song + Redis adapter for multi-instance fan-out; details in [Workflows](./06-workflows.md).

---

## Where the evidence lives


| Property                | Doc / artifact                                                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| Load test numbers & fix | [k6 Test Report](./12-k6-test-report.md)                                     |
| How to reproduce k6     | [Load Testing (k6)](./11-load-testing.md)                                    |
| Architecture choices    | [Design Thinking](./04-design-thinking.md), [Trade-offs](./07-trade-offs.md) |
| Unit tests              | `cd apps/api && pnpm test`                                                   |


---

*→ Next: [Load Testing (k6)](./11-load-testing.md)*