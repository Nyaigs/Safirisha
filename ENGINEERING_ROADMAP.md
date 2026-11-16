# Safirisha Engineering Roadmap
**Generated:** 2026-11-16 | **Source:** Full codebase audit | **Total items:** 55

---

## P0 — Security & Revenue (V1 Blocker)
*Must fix before any production deploy. Blocks revenue, exposes data, or enables privilege escalation.*

| ID | Title | Acceptance Criteria |
|----|-------|---------------------|
| **C-01** | CORS allows all origins in production | Production starts only if `CORS_ALLOWED_ORIGINS` is set and validated at startup; dev still allows `*`. |
| **C-02** | No rate limiting on Socket.IO connections | Per-IP connection limit enforced in `io.use()` before auth; excess connections rejected with 429. |
| **C-03** | Chat rate limit uses in-memory Map (not distributed) | Redis-backed sliding-window rate limiter shared across all backend instances. |
| **C-04** | JWT tokens expire in 7 days (too long) | Access tokens ≤30 min; refresh tokens 7 days in httpOnly cookie; refresh endpoint implemented. |
| **C-05** | Legacy JWT fallback has no algorithm pinning | `jwt.verify(token, secret, { algorithms: ['HS256'] })` on all verify paths (REST + Socket). |
| **C-06** | Socket `join_trip_room` re-queries DB per request | Driver profile fetched once at connection, cached on `socket.data.driverProfile`, reused on room joins. |
| **C-07** | File upload path uses `process.cwd()` (path traversal) | Filenames sanitized to `uuid + ext`; stored outside web root; `path.basename` used on original name. |
| **C-08** | No input validation on `updateDriverLocation` heading/speed | Zod schema enforces `heading: 0-360`, `speed: ≥0`; invalid payloads return 400. |
| **C-09** | `sanitizeTripPII` mutates input object directly | Function returns shallow copy with PII omitted; original Prisma result unchanged. |
| **C-10** | Admin endpoints lack audit logging | Every admin mutation writes immutable `AuditLog` entry (userId, action, before/after JSON). |
| **C-11** | **M-Pesa simulation bypasses real payment flow** | Real Daraja STK Push implemented: initiate → callback → status update; simulation path removed for prod. |
| **C-12** | No CSRF protection on state-changing REST endpoints | `helmet.csrf()` enabled for cookie auth; API uses Bearer tokens only (no cookies). |
| **C-13** | Password reset code is 6-digit numeric (1M space) | 8-char alphanumeric codes; per-IP/account attempt counter in Redis; lock after 5 failures. |
| **C-14** | Clerk bootstrap trusts `req.body.role` for driver/admin | Bootstrap defaults to `CUSTOMER`; role assignment only via admin dashboard, never client input. |
| **C-15** | Socket auth doesn't verify `user.isActive` reactively | Periodic re-validation (5 min) or event-driven force-disconnect on `user.deactivated`. |

---

## P1 — Realtime & Reliability
*Data integrity, trip lifecycle correctness, scaling bottlenecks.*

| ID | Title | Acceptance Criteria |
|----|-------|---------------------|
| **H-01** | Ghost trips: driver accepts → app crashes → trip stuck `ACCEPTED` | Cron (2 min) finds `ACCEPTED` trips with stale driver heartbeat (>5 min) → reverts to `SEARCHING`, clears `assignedDriverId`, emits `trip_taken`. |
| **H-02** | Socket disconnect mid-trip → no state reconciliation | On disconnect: if driver has active trip, keep `availability=BUSY`; only clear `onlineDrivers` registry; add 30s heartbeat, 2 misses → `OFFLINE`. |
| **H-03** | `findNearbyDrivers` runs N+1 queries (count per driver) | Single aggregation query (`GROUP BY assignedDriverId` with counts) replaces per-driver `count()` calls. |
| **H-04** | Trip status transition matrix allows `CANCELLED` from almost any state | Driver cancel only from `ACCEPTED`/`DRIVER_EN_ROUTE`; customer cancel only from `SEARCHING`/`ACCEPTED`/`DRIVER_EN_ROUTE`/`SCHEDULED`. |
| **H-05** | Scheduled trips: `processScheduledTrips` lacks idempotency key | Cron uses `WHERE releasedAt IS NULL`; sets `releasedAt=now()` in same transaction; duplicate runs no-op. |
| **H-06** | `expireStaleSearchingTrips` doesn't notify offline customer | Push notification (FCM/Expo) sent from cron for `trip_expired`, `trip_cancelled`, and other critical transitions. |
| **H-07** | Driver location update emits to `user:${userId}` AND `trip:${tripId}` | Emit only to `trip:${tripId}`; customer joins that room; `user:${userId}` emit removed. |
| **H-08** | No dead letter handling for failed Socket emits | Critical emits wrapped in try/catch; failures logged + persisted to `Outbox` table with retry worker. |
| **H-09** | Prisma `$transaction` timeout not configured | Complex transactions use `prisma.$transaction(fn, { timeout: 10000 })`. |
| **H-10** | `onlineDrivers` Map never cleaned up on process restart | Driver online state in Redis `SET driver:online:{userId} {socketId} EX 300`; refreshed on heartbeat. |
| **H-11** | Cron jobs skip silently on `P1001` (DB asleep) — no alerting | Skipped cron logs warning + Sentry capture + Prometheus metric `cron_skipped_total{reason="db_asleep"}`; alert if >5/min. |
| **H-12** | Customer `confirmDelivery` sets driver `availability=ONLINE` immediately | Driver set `ONLINE` only after `paymentStatus=PAID` (in `confirmCashPaymentByDriver` / M-Pesa callback). |
| **H-13** | Quote cleanup cron runs every minute | Cron schedule changed to `*/5 * * * *`. |
| **H-14** | `getNearbyTripRequests` loads 50 trips then filters in JS | DB-level filter: `WHERE vehicleType IN (...) AND status IN (...) AND ST_DWithin(...)` (PostGIS or bounding box). |
| **H-15** | No circuit breaker for external Geoapify API | `async-retry` with exponential backoff (3 attempts); 5-min route cache; fallback to cached route. |

---

## P2 — Performance & UI Polish
*Battery life, render performance, memory leaks, code health.*

| ID | Title | Acceptance Criteria |
|----|-------|---------------------|
| **M-01** | Driver GPS updates every 5s (high battery drain) | `expo-location` config: `distanceInterval: 50`, `timeInterval: 30000`; send only if distance >50m OR heading change >15° OR 30s elapsed. |
| **M-02** | No `useMemo`/`useCallback` for heavy JSX in `live-trip.tsx` (901 lines) | Component split into `MapView`, `StatusCard`, `DriverCard`, `PaymentCard`, `ChatModal`; each memoized with `React.memo`. |
| **M-03** | Socket `onDriverLocation` fires on every GPS ping (no client debounce) | Store `setDriverLocation` throttled: only if `Date.now() - lastUpdate > 2000` OR distance >20m. |
| **M-04** | `active-trip.tsx` watches position even when trip is `DELIVERED`/`CANCELLED` | `locationSub?.remove()` called when `currentStatus === 'DELIVERED' || 'CANCELLED'`. |
| **M-05** | MapView re-renders full polyline on every driver location update | Route fetched only on status change (`ACCEPTED`→`DRIVER_EN_ROUTE`); straight-line for intermediate movement. |
| **M-06** | `chatRateLimits` Map never expires old entries | `setInterval` every 5 min deletes entries older than 2 min. |
| **M-07** | `findNearbyDrivers` fetches `user.fullName, phone` for all candidates | Query selects only `userId`; name/phone fetched when driver accepts. |
| **M-08** | Frontend `apiFetch` timeout hardcoded | `ApiFetchOptions` accepts optional `timeout`; default 30s, 60s for payment endpoints. |
| **M-09** | Duplicate `normalizeVehicleType` in 3 files | Extracted to `lib/vehicle.ts`; imported everywhere. |
| **M-10** | `live-trip.tsx` subscribes to `chat_message` but never unsubscribes on trip end | On `onTripUpdated` when `status === 'DELIVERED'`, call `socket.off('chat_message', onChatMessage)`. |

---

## Tracking
- **Total:** 55 items (15 P0, 15 P1, 10 P2, 15 V1 Blockers overlap with P0/P1)
- **Status column:** Add `☐ Todo` / `🔄 In Progress` / `✅ Done` / `🚫 Blocked` as we work
- **Owner:** Assign per item when picked up
- **PR link:** Fill in when merged