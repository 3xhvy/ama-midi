# Load Testing (k6)

← [README](../../README.md) · [← Performance Testing](./10-performance-testing.md) · [k6 Test Report →](./12-k6-test-report.md)

This is how I run the API load test for the grading requirement. Script: `[scripts/load-test.js](../../scripts/load-test.js)`.

**What I'm trying to prove:** 100 virtual users, 30 seconds, `POST /charts/:chartId/notes` — p95 under 200ms, no 500s, and 201/409 both count as success.

**What happened when I ran it:** [k6 Test Report](./12-k6-test-report.md) — my full write-up (first attempt, what I found, the fix, second attempt).

For conflict, boundary, and 10k UI checks, see [Performance & Correctness Testing](./10-performance-testing.md).

---

## Before I run anything

I need the stack up (`pnpm dev` or `docker compose up`), [k6 installed](https://k6.io/docs/get-started/installation/) (`brew install k6` on macOS), a JWT from the web app (DevTools → Application → Local Storage → `token`), and a chart ID from the editor URL (`.../charts/<CHART_ID>/...`).

One thing that tripped me up early: the default seed chart belongs to a fake user, so k6 got **403** until I seeded notes on **my own** chart:

```bash
CHART_ID="<your-chart-id>" pnpm seed
```

---

## Seeding 10,000 notes

I seed a dense chart because the use case mentions 10k notes and I wanted load tests to reflect a real editor, not an empty chart.

```bash
pnpm seed                                    # default seed project/chart
CHART_ID="<your-chart-id>" pnpm seed         # your chart — what I use for k6
SONG_ID="<your-song-id>" pnpm seed           # uses "Main" chart, or first chart
```

This wipes existing notes on the target chart and inserts 10,000 unique `(track, time)` pairs on T1–T8 from 0.0s–124.9s. Times **≥ 125.0s** stay empty, which matters for probe requests where I expect **201** instead of **409**.

---

## Step 1 — curl probe

I always hit the API once by hand before k6. It saves time when the problem is auth or chart access, not concurrency.

```bash
export BASE_URL=http://localhost:3001
export CHART_ID="<your-chart-id>"
export TOKEN="<your-jwt>"

curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "$BASE_URL/charts/$CHART_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"track":1,"time":200.0,"title":"k6 probe"}'
```


| HTTP                       | What I take it to mean                                              |
| -------------------------- | ------------------------------------------------------------------- |
| **201**                    | Write path works — good to run k6                                   |
| **409** + `POSITION_TAKEN` | Auth and access OK; on a seeded chart use time ≥ 125s if I need 201 |
| **401**                    | JWT expired — log in again                                          |
| **403**                    | Wrong chart — seed on a chart my login owns                         |
| **404**                    | Bad chart ID                                                        |
| **429**                    | Rate limited — smoke profile or raise `THROTTLE_`* locally          |
| **500**                    | Check API logs                                                      |


Read-only sanity check:

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/charts/$CHART_ID/notes?timeFrom=0&timeTo=10"
```

I expect **200**.

---

## Step 2 — Smoke test

Production limits (and local defaults unless I override):


| Limit          | Value         |
| -------------- | ------------- |
| Global         | 100 req / min |
| `POST …/notes` | 30 req / min  |


Smoke stays under that — one user, two seconds between requests:

```bash
BASE_URL=http://localhost:3001 \
CHART_ID="$CHART_ID" \
TOKEN="$TOKEN" \
VUS=1 DURATION=60s SLEEP=2 \
k6 run scripts/load-test.js
```

On my machine this passed: ~143ms p95, 100% accepted, no 429, no 500. That's my baseline for "normal editing speed is fine."

---

## Step 3 — Full load (100 VUs)

The default script runs **100 VUs for 30s** with a 0.1s pause — far above production rate limits. For the full scenario I raise caps in `apps/api/.env` (dev only; ignored when `NODE_ENV=production`):

```env
THROTTLE_GLOBAL_LIMIT=10000
THROTTLE_NOTE_WRITE_LIMIT=10000
```

For a fully green 100 VU run after my latency fix, I needed **60000** — the synthetic burst is ~50k req/min. Details in the [test report](./12-k6-test-report.md).

Restart the API after changing env, then:

```bash
BASE_URL=http://localhost:3001 \
CHART_ID="$CHART_ID" \
TOKEN="$TOKEN" \
k6 run scripts/load-test.js
```

**Remove the overrides and restart when done.**

### What I saw (two phases)

**Before I moved chart analysis off the request path** — correctness held (100% accepted, no 500/429 with throttle raised), but p95 was ~3s. The API was stable and wrong on latency.

**After the fix** — p95 at 100 VUs dropped to **~37ms**. Latency SLO passes. At 100 VUs with only a 10k throttle cap, many requests still get **429** because the test fires ~880 req/s — that's the limiter working, not broken note logic. At 10–20 VUs every k6 threshold went green for me.

VU sweep command I used:

```bash
for vus in 10 20 30 50 100; do
  echo "=== VUS=$vus ==="
  BASE_URL=http://localhost:3001 CHART_ID="$CHART_ID" TOKEN="$TOKEN" \
    k6 run --vus "$vus" --duration 30s scripts/load-test.js 2>&1 \
    | grep -E 'p\(95\)|thresholds|http_req_failed|accepted'
done
```

---

## Script details

- **Endpoint:** `POST /charts/{CHART_ID}/notes` — random track (1–8), random time (0–300s)
- **Success:** 201 or 409 (`expectedStatuses(201, 409)` so k6 does not count 409 as failed)


| Variable   | Default                 | Purpose                            |
| ---------- | ----------------------- | ---------------------------------- |
| `BASE_URL` | `http://localhost:3001` | API base                           |
| `CHART_ID` | seed chart id           | Target chart                       |
| `TOKEN`    | (required)              | Bearer JWT                         |
| `VUS`      | `100`                   | Virtual users                      |
| `DURATION` | `30s`                   | Test duration                      |
| `SLEEP`    | `0.1`                   | Pause between iterations (seconds) |


---

## Production

I did not run destructive load against production without thinking it through. If you need a sanity check on the deployed stack:

- Use a throwaway chart
- Do not set `THROTTLE_`* overrides (ignored in production anyway)
- Expect heavy **429** at 100 VUs — use smoke or low VU count

```bash
BASE_URL=https://ama-midi.hvy-dev.uk \
CHART_ID="<test-chart-id>" \
TOKEN="<prod-jwt>" \
VUS=1 DURATION=60s SLEEP=2 \
k6 run scripts/load-test.js
```

---

## Problems I hit


| Symptom                          | What was wrong                                                |
| -------------------------------- | ------------------------------------------------------------- |
| 100% failed, 0% 201/409, not 500 | **403** — chart my login can't edit; `CHART_ID=... pnpm seed` |
| ~95% failed after ~100 requests  | **429** — smoke profile or raise `THROTTLE_`* locally         |
| curl always **409** on track 1   | Seed fills 0–124.9s; probe at time **≥ 125.0**                |
| k6 counts 409 as failed          | Current script uses `expectedStatuses(201, 409)`              |


---

## Checklist I follow

```text
[ ] API running, migrations applied
[ ] Logged in, TOKEN copied
[ ] CHART_ID from editor (or CHART_ID=... pnpm seed)
[ ] curl probe → 201 or 409 (not 401/403/500)
[ ] Smoke k6 (VUS=1 SLEEP=2) → all thresholds green
[ ] (Optional) THROTTLE_* raised, API restarted
[ ] Full k6 → document p95 and accepted %
[ ] Revert THROTTLE_*, restart API
```

Full narrative and numbers: **[k6 Test Report](./12-k6-test-report.md)**.

---

*→ Next: [k6 Test Report](./12-k6-test-report.md)*