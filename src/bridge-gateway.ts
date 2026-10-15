import { timingSafeEqual } from 'node:crypto'
import http, { type IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'

export const PRODUCER_ORIGIN = 'https://chat.laplace.live'
const CLIENT = 'laplace-event-bridge-role-client'
const PRODUCER = 'laplace-event-bridge-role-server'

export function validToken(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

export function authorizeBridgeRequest(req: Pick<IncomingMessage, 'headers' | 'url'>, token: string, devOrigin?: string) {
  const protocols = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(part => part.trim())
  const [role, headerToken] = protocols
  if (role !== CLIENT && role !== PRODUCER) return false
  let url: URL
  try { url = new URL(req.url ?? '/', 'http://127.0.0.1') } catch { return false }
  if (url.pathname !== '/') return false
  if (!validToken(headerToken || url.searchParams.get('token') || '', token)) return false
  const origin = req.headers.origin
  if (role === PRODUCER) return origin === PRODUCER_ORIGIN
  return origin === PRODUCER_ORIGIN || origin === 'file://' || origin === 'null' ||
    origin === undefined || (devOrigin !== undefined && origin === devOrigin)
}

// A bounded HTTP upgrade proxy, not a second bridge implementation. The official
// binary still owns WebSocket framing, heartbeat and event broadcasting.
export async function startBridgeGateway(options: {
  port: number; backendPort: number; token: string; backendToken: string; devOrigin?: string
}) {
  const sockets = new Set<Socket>()
  const server = http.createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192 }, (_req, res) => {
    res.writeHead(404, { 'Cache-Control': 'no-store', Connection: 'close' }).end()
  })
  server.maxConnections = 16
  server.on('connection', socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.on('clientError', (_error, socket) => socket.destroy())
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy())
    const host = req.headers.host
    if ((host !== `127.0.0.1:${options.port}` && host !== `localhost:${options.port}`) ||
      !authorizeBridgeRequest(req, options.token, options.devOrigin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      return
    }
    socket.pause()
    const role = req.headers['sec-websocket-protocol']!.split(',')[0].trim()
    const upstream = http.request({
      host: '127.0.0.1', port: options.backendPort, path: '/', method: 'GET',
      headers: {
        Host: `127.0.0.1:${options.backendPort}`,
        Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': req.headers['sec-websocket-key'] ?? '',
        'Sec-WebSocket-Protocol': `${role}, ${options.backendToken}`,
      },
    })
    const timer = setTimeout(() => upstream.destroy(new Error('Bridge handshake timed out')), 5000)
    upstream.on('upgrade', (response, backend, backendHead) => {
      clearTimeout(timer)
      if (socket.destroyed) { backend.destroy(); return }
      sockets.add(backend)
      backend.on('close', () => { sockets.delete(backend); socket.destroy() })
      backend.on('error', () => socket.destroy())
      socket.on('close', () => backend.destroy())
      socket.on('error', () => backend.destroy())
      if (response.statusCode !== 101 || response.headers['sec-websocket-protocol'] !== role) {
        backend.destroy(); socket.destroy(); return
      }
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${response.headers['sec-websocket-accept']}\r\nSec-WebSocket-Protocol: ${role}\r\n\r\n`)
      if (backendHead.length) socket.write(backendHead)
      if (head.length) backend.write(head)
      socket.pipe(backend).pipe(socket)
      socket.resume()
    })
    upstream.on('response', response => { response.resume(); upstream.destroy(); socket.destroy() })
    upstream.on('error', () => { clearTimeout(timer); socket.destroy() })
    socket.on('close', () => { clearTimeout(timer); upstream.destroy() })
    upstream.end()
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, '127.0.0.1', () => { server.removeListener('error', reject); resolve() })
  })
  return {
    async stop() {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}
