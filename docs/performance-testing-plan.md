# Performance & Correctness Testing Plan

Step-by-step procedures for validating the three critical correctness and performance properties of AMA-MIDI.

---

## Prerequisites

```bash
# Start full stack (Postgres + Redis + API + Web)
docker-compose up --build

# Or start locally:
pnpm dev
# Then seed 10,000 notes:
cd apps/api && pnpm seed
```

You will need:
- A valid JWT — log in via the web app, open DevTools → Application → Local Storage → copy the `token` value
- A known chart ID — from the seed output or from `GET /songs` response
- k6 installed: `brew install k6` or https://k6.io/docs/get-started/installation/

---

## Test 1: Conflict / Duplicate Prevention

**What it proves:** Two simultaneous writes to the same `(track, time)` position result in exactly one success and one 409 — no double-write, no 500.

**Steps:**

1. Export your JWT:
   ```bash
   export TOKEN="<paste jwt here>"
   export API="http://localhost:3001"
   export CHART_ID="<paste chart id>"
   ```

2. Send two concurrent POST requests to the same position:
   ```bash
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

3. **Expected outcome:**
   - One request returns `201` with a note object
   - The other returns `409` with `{"statusCode":409,"message":"A note already exists at track 1, time 5.0"}`
   - Neither returns `500`
   - Exactly one row in DB: `SELECT count(*) FROM notes WHERE track=1 AND time=5.0 AND deleted_at IS NULL;` → `1`

---

## Test 2: Boundary Validation

**What it proves:** Notes outside the valid range (track 1–8, time 0–300s) are rejected with 400, not silently accepted or 500'd.

**Steps:**

1. Attempt time = 301s (beyond `TIME_MAX`):
   ```bash
   curl -s -X POST "$API/charts/$CHART_ID/notes" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"track":1,"time":301.0,"title":"boundary-test"}' | jq .
   ```
   **Expected:** `400 Bad Request` — `time must not be greater than 300`

2. Attempt time = -1s (below `TIME_MIN`):
   ```bash
   curl -s -X POST "$API/charts/$CHART_ID/notes" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"track":1,"time":-1.0,"title":"boundary-test"}' | jq .
   ```
   **Expected:** `400 Bad Request` — `time must not be less than 0`

3. Attempt track = 9 (above `TRACK_MAX`):
   ```bash
   curl -s -X POST "$API/charts/$CHART_ID/notes" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"track":9,"time":10.0,"title":"boundary-test"}' | jq .
   ```
   **Expected:** `400 Bad Request` — `track must not be greater than 8`

4. Attempt track = 0 (below `TRACK_MIN`):
   ```bash
   curl -s -X POST "$API/charts/$CHART_ID/notes" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"track":0,"time":10.0,"title":"boundary-test"}' | jq .
   ```
   **Expected:** `400 Bad Request` — `track must not be less than 1`

---

## Test 3: Load Test (API throughput)

**What it proves:** API sustains 100 concurrent users with p95 response time < 200ms for note creation, and 409 conflicts do not surface as 500s.

**Steps:**

1. Install k6:
   ```bash
   brew install k6     # macOS
   # or: https://k6.io/docs/get-started/installation/
   ```

2. Run the load test against local API:
   ```bash
   BASE_URL=http://localhost:3001 \
   CHART_ID="<your chart id>" \
   TOKEN="<your jwt>" \
   k6 run scripts/load-test.js
   ```

3. **Expected output:**
   ```
   ✓ status is 201 or 409
   ✓ not a 500

   http_req_duration............: avg=XXms  p(95)<200ms ✓
   http_req_failed..............: 0.00%
   ```
   - `http_req_duration p(95) < 200ms` threshold must pass
   - `http_req_failed rate < 5%` threshold must pass
   - All checks `status is 201 or 409` must pass (zero 500s)

4. Run against production (after deploy):
   ```bash
   BASE_URL=https://api.ama-midi.up.railway.app \
   CHART_ID="<prod chart id>" \
   TOKEN="<prod jwt>" \
   k6 run scripts/load-test.js
   ```

---

## Test 4: 10,000-Note Rendering Performance

**What it proves:** The piano roll renders 10,000 notes without freezing, and the viewport clamp keeps live DOM nodes to ~60–120 regardless of total note count.

**Steps:**

1. Seed 10,000 notes (if not already seeded):
   ```bash
   cd apps/api && pnpm seed
   ```
   Seed output shows the chart ID — note it.

2. Open the web app at `http://localhost:3000` and navigate to the seeded song's editor.

3. Open DevTools → Performance tab → click Record.

4. Scroll through the full piano roll from 0s to 300s over ~10 seconds.

5. Stop recording. Check:
   - No frame drops below 30fps (green bar in Performance timeline)
   - Scripting time per frame < 16ms

6. Open DevTools → Elements tab. While the piano roll is visible, search for elements with `data-note` attribute:
   ```
   Ctrl+F in Elements: data-note
   ```
   **Expected:** count is between 50 and 200 (not 10,000).

7. Open DevTools → Memory tab → Take heap snapshot. Filter by `NoteCircle`. Confirm only visible instances are mounted (not all 10,000).

---

## Test 5: Real-time Collaboration Correctness

**What it proves:** Two concurrent composers see each other's note changes in < 1 second with no state corruption.

**Steps:**

1. Open the same song in two browser windows (or two browsers).
2. Log in as two different users (use an incognito window for the second user).
3. In Window A: place a note at Track 3, Time 45.0s.
4. **Expected:** The note appears in Window B within 1 second without a page refresh.
5. In Window B: delete the note just placed.
6. **Expected:** The note disappears from Window A within 1 second.
7. Both windows place notes simultaneously at the same position (Track 2, Time 10.0s).
8. **Expected:** Exactly one note exists; one window shows a conflict toast (409).
