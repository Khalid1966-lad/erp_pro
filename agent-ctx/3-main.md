# Task ID: 3 — WebSocket Mini-Service

## Agent: main

## Task
Create WebSocket mini-service for real-time notifications and messages in `mini-services/ws/`.

## Work Log

### Files Created
- **`mini-services/ws/package.json`** — Package definition with `socket.io@^4.8.1` dependency
- **`mini-services/ws/index.ts`** — Full Socket.io + HTTP server on port 3003

### Implementation Details

**Server Setup:**
- HTTP server + Socket.io on port 3003
- Socket.io path: `/` (required for Caddy proxy)
- CORS: origin `*`, methods GET/POST
- PingTimeout: 60000, PingInterval: 25000

**JWT Authentication:**
- Client sends `{ token: string }` via `auth` event after connecting
- Verification mirrors `src/lib/auth.ts`: split JWT, HMAC-SHA256 signature check, base64url payload decode, expiry check
- Secret from `JWT_SECRET` env var (default: `gema-erp-pro-secret-key-2024`)
- On success: socket joins room `user:{userId}`, emits `auth:ok`
- On failure: emits `auth:error`, disconnects socket

**Socket Events:**
- `notification` — broadcasts payload to `user:{userId}` room
- `message` — broadcasts payload to all participant rooms from array

**HTTP POST `/emit` Endpoint:**
- Auth via `Authorization: Bearer {EMIT_SECRET}` (env var, default: `gema-erp-pro-emit-secret`)
- Body: `{ event: string, userId: string, data: any }`
- Emits event to `user:{userId}` room via Socket.io
- Returns 401/405/400/200 as appropriate

**Key Technical Decision — Engine.io Interception:**
- With Socket.io `path: '/'`, engine.io intercepts ALL HTTP requests and returns "Transport unknown" for non-Socket.io ones
- Solution: monkey-patched `io.engine.handleRequest` to route `/emit` to our custom handler before engine.io processes it
- This preserves the required `path: '/'` while allowing custom HTTP endpoints

### Test Results (all passing)
| Test | Expected | Actual |
|------|----------|--------|
| POST /emit no auth | 401 | ✅ 401 |
| POST /emit valid auth | 200 | ✅ 200 |
| POST /emit missing userId | 400 | ✅ 400 |
| GET /emit | 405 | ✅ 405 |
| POST /emit bad JSON | 400 | ✅ 400 |
| Socket.io handshake | 200 + engine.io payload | ✅ 200 |

### Dependencies Installed
- `socket.io@4.8.3` (22 packages total)

## Stage Summary
- WebSocket mini-service fully operational on port 3003
- JWT auth matches auth.ts logic for token verification
- `/emit` HTTP endpoint available for server-to-client push
- Engine.io patched to coexist with custom HTTP endpoints
- Graceful shutdown handlers for SIGTERM/SIGINT
