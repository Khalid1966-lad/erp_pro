import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// JWT verification — mirrors src/lib/auth.ts verifyToken logic
// ---------------------------------------------------------------------------
function verifyToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const secret = process.env.JWT_SECRET || 'gema-erp-pro-secret-key-2024'
    const signingInput = `${parts[0]}.${parts[1]}`
    const expectedSig = createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url')

    if (parts[2] !== expectedSig) return null

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null

    if (!payload.userId) return null

    return { userId: payload.userId }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// HTTP POST /emit — allows backend API routes to push events to user rooms
// Body: { event: string, userId: string, data: any }
// ---------------------------------------------------------------------------
function handleEmit(req: IncomingMessage, res: ServerResponse, ioServer: Server) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Verify caller with a shared secret — using EMIT_SECRET env var
  const authHeader = req.headers['authorization']
  const emitSecret = process.env.EMIT_SECRET || 'gema-erp-pro-emit-secret'
  if (!authHeader || authHeader !== `Bearer ${emitSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      const { event, userId, data } = body

      if (!event || !userId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing event or userId' }))
        return
      }

      const room = `user:${userId}`
      ioServer.to(room).emit(event, data)

      console.log(`[WS] /emit → room ${room}, event "${event}"`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, event, userId }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }
  })
}

// ---------------------------------------------------------------------------
// HTTP + Socket.io server
// ---------------------------------------------------------------------------
const httpServer = createServer()

const io = new Server(httpServer, {
  // Caddy proxies to this path — MUST be '/'
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Intercept engine.io's HTTP request handler to route /emit to our handler.
// With path:'/', engine.io intercepts ALL GET/POST requests and returns
// "Transport unknown" for non-Socket.io ones. We patch it to skip /emit.
// ---------------------------------------------------------------------------
const engine = io.engine as any
const originalHandleRequest: (req: IncomingMessage, res: ServerResponse) => void =
  engine.handleRequest.bind(engine)

engine.handleRequest = (req: IncomingMessage, res: ServerResponse) => {
  // Custom HTTP endpoints — skip engine.io entirely
  if (req.url === '/emit') {
    handleEmit(req, res, io)
    return
  }
  // Everything else goes through engine.io / Socket.io
  return originalHandleRequest(req, res)
}

// ---------------------------------------------------------------------------
// Socket.io — connection lifecycle
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[WS] Socket connected: ${socket.id}`)

  // Client authenticates by sending { token } immediately after connecting
  socket.on('auth', (data: { token: string }) => {
    const user = verifyToken(data.token)

    if (!user) {
      console.log(`[WS] Auth failed for socket ${socket.id}`)
      socket.emit('auth:error', { error: 'Invalid or expired token' })
      socket.disconnect()
      return
    }

    const room = `user:${user.userId}`
    socket.join(room)
    socket.data.userId = user.userId

    console.log(`[WS] Socket ${socket.id} authenticated → ${room}`)
    socket.emit('auth:ok', { userId: user.userId })
  })

  // --- notification event (broadcast to a specific user's room) ---
  socket.on('notification', (data: { userId: string; payload: unknown }) => {
    const room = `user:${data.userId}`
    io.to(room).emit('notification', data.payload)
  })

  // --- message event (broadcast to all conversation participants) ---
  socket.on('message', (data: { participants: string[]; payload: unknown }) => {
    const rooms = (data.participants ?? []).map((p) => `user:${p}`)
    for (const room of rooms) {
      io.to(room).emit('message', data.payload)
    }
  })

  // --- disconnect ---
  socket.on('disconnect', (reason) => {
    const userId: string | undefined = socket.data.userId
    console.log(`[WS] Socket ${socket.id} disconnected (userId=${userId ?? 'unauth'}, reason=${reason})`)
  })

  socket.on('error', (err) => {
    console.error(`[WS] Socket error (${socket.id}):`, err)
  })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = 3003

httpServer.listen(PORT, () => {
  console.log(`[WS] GEMA WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[WS] Received ${signal}, shutting down…`)
  httpServer.close(() => {
    console.log('[WS] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
