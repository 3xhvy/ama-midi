# Load Testing (k6)

Guide for running the AMA-MIDI API load test with [k6](https://k6.io/). Script: `[scripts/load-test.js](../scripts/load-test.js)`.

**Target SLO:** 100 concurrent users, 30s duration, `POST /charts/:chartId/notes` — p95 latency < 200ms, no 500s, 201/409 treated as success.

**Results:** [k6 Test Report](./k6-test-report.md) — my write-up for the grader (first attempt, diagnosis, fix, second attempt).

Broader correctness tests (conflicts, boundaries, 10k UI): [Performance & Correctness Testing Plan](./performance-testing-plan.md).

---

## Prerequisites

1. **Stack running** — `pnpm dev` or `docker compose up`
2. **k6 installed** — `brew install k6` ([other platforms](https://k6.io/docs/get-started/installation/))
3. **JWT** — log in at [http://localhost:3000](http://localhost:3000) → DevTools → Application → Local Storage → `token`
4. **Chart ID** — from the editor URL: `.../charts/<CHART_ID>/...`

Use a chart **your login can edit**. The default seed project is only accessible to the fake seed user — for k6, seed your own chart (below).

---

## Seed 10,000 notes

From repo root:

```bash
pnpm seed                                    # default seed project/chart
CHART_ID="<your-chart-id>" pnpm seed         # your chart (recommended for k6)
SONG_ID="<your-song-id>" pnpm seed           # uses "Main" chart, or first chart
```

Seed **deletes all notes** on the target chart, then inserts 10,000 unique `(track, time)` pairs (T1–T8 from 0.0s–124.9s). Times **≥ 125.0s** stay empty — useful for probe requests that expect **201**.

Optional: `SEED_NOTE_COUNT=5000` to change count.

---

## Step 1 — Single request probe

Always run one `curl` before k6:

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


| HTTP                       | Meaning                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| **201**                    | Created — ready for k6                                                          |
| **409** + `POSITION_TAKEN` | Duplicate — auth and chart access OK (use time ≥ 125s for 201 on seeded charts) |
| **401**                    | Expired or invalid JWT — log in again                                           |
| **403**                    | No edit access — use your own `CHART_ID` or `CHART_ID=... pnpm seed`            |
| **404**                    | Wrong chart ID                                                                  |
| **429**                    | Rate limited — wait or raise limits (below)                                     |
| **500**                    | Server error — check API logs                                                   |


Read-only check (no write):

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/charts/$CHART_ID/notes?timeFrom=0&timeTo=10"
```

Expect **200**.

---

## Step 2 — Smoke test (under rate limit)

Default API limits (production and local unless overridden):


| Limit          | Value         |
| -------------- | ------------- |
| Global         | 100 req / min |
| `POST …/notes` | 30 req / min  |


Smoke profile stays under the cap:

```bash
BASE_URL=http://localhost:3001 \
CHART_ID="$CHART_ID" \
TOKEN="$TOKEN" \
VUS=1 DURATION=60s SLEEP=2 \
k6 run scripts/load-test.js
```

**Example result (passing):**


| Metric               | Value      |
| -------------------- | ---------- |
| `accepted` (201/409) | 100%       |
| `http_req_failed`    | 0%         |
| p95 latency          | ~143ms     |
| Requests             | ~29 in 60s |


---

## Step 3 — Full load test (100 VUs)

Default script: **100 VUs, 30s**. Exceeds rate limits unless raised locally.

Add to `apps/api/.env` (ignored when `NODE_ENV=production`):

```env
THROTTLE_GLOBAL_LIMIT=10000
THROTTLE_NOTE_WRITE_LIMIT=10000
```

Restart the API, then:

```bash
BASE_URL=http://localhost:3001 \
CHART_ID="$CHART_ID" \
TOKEN="$TOKEN" \
k6 run scripts/load-test.js
```

**Remove those env vars and restart the API when done.**

### Example result (100 VUs, limits raised)


| Metric                   | Result    | Threshold |
| ------------------------ | --------- | --------- |
| `accepted` (201/409)     | 100%      | > 95% ✓   |
| `not rate limited` (429) | 0         | ✓         |
| `not a 500`              | 100%      | ✓         |
| `http_req_failed`        | 0%        | < 5% ✓    |
| p95 latency              | ~3.15s    | < 200ms ✗ |
| Throughput               | ~43 req/s | —         |


**Interpretation:** Correctness holds under 100 concurrent writers (no 429/500). p95 exceeds 200ms on a single local API + Postgres — expected at this concurrency (DB insert, ledger, analysis per note). Report both smoke (latency ✓) and full load (correctness ✓, latency ✗) for grading.

### Find concurrency where p95 < 200ms

```bash
for vus in 5 10 20 30 50; do
  echo "=== VUS=$vus ==="
  BASE_URL=http://localhost:3001 CHART_ID="$CHART_ID" TOKEN="$TOKEN" \
    k6 run --vus "$vus" --duration 30s scripts/load-test.js 2>&1 \
    | grep -E 'p\(95\)|thresholds|http_req_failed|accepted'
done
```

---

## Script behaviour

- **Endpoint:** `POST /charts/{CHART_ID}/notes` with random track (1–8) and time (0–300s)
- **Success statuses:** 201 (created), 409 (duplicate) — k6 uses `expectedStatuses(201, 409)` so 409 is not counted as `http_req_failed`
- **Env vars:**


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

Do **not** run destructive load tests against production without approval. If needed:

- Use a **throwaway chart** on a test song
- Do **not** set `THROTTLE_`* overrides (ignored in production anyway)
- Expect heavy **429** at 100 VUs with default limits
- Prefer smoke profile or low `VUS` against prod

```bash
BASE_URL=https://ama-midi.hvy-dev.uk \
CHART_ID="<test-chart-id>" \
TOKEN="<prod-jwt>" \
VUS=1 DURATION=60s SLEEP=2 \
k6 run scripts/load-test.js
```

---

## Troubleshooting


| Symptom                               | Fix                                                               |
| ------------------------------------- | ----------------------------------------------------------------- |
| 100% failed, 0% 201/409, not 500      | **403** — wrong chart; use `CHART_ID=... pnpm seed` on your chart |
| ~95% failed after first ~100 reqs     | **429** — use smoke profile or raise `THROTTLE_`* locally         |
| Random curl always **409** on track 1 | Chart dense 0–124.9s after seed; use time **≥ 125.0**             |
| `pnpm seed` not found at repo root    | Run `pnpm install`; use `pnpm seed` or `cd apps/api && pnpm seed` |
| k6 counts 409 as failed               | Use current `scripts/load-test.js` (`expectedStatuses`)           |


---

## Test report

My full write-up for the grader — what I ran, what broke, what I changed, and the numbers after the fix — is in **[k6 Test Report](./k6-test-report.md)**.

Quick checklist:

```text
[ ] API running, migrations applied
[ ] Logged in, TOKEN copied
[ ] CHART_ID from editor (or CHART_ID=... pnpm seed)
[ ] curl probe → 201 or 409 (not 401/403/500)
[ ] Smoke k6 (VUS=1 SLEEP=2) → all thresholds green
[ ] (Optional) THROTTLE_* raised, API restarted
[ ] Full k6 → accepted 100%, document p95
[ ] Revert THROTTLE_* , restart API
```

