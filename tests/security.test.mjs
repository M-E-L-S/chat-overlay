import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import WebSocket from 'ws'
import { authorizeBridgeRequest, PRODUCER_ORIGIN } from '../src/bridge-gateway.ts'
import { startManagedBridge } from '../src/bridge-process.ts'
import { roomAllowed, validateEvent } from '../src/event-validation.ts'
import { contentSecurityPolicy, isExternalURL, isMediaURL } from '../src/security-policy.ts'

const token = randomBytes(32).toString('base64url')
const role = 'laplace-event-bridge-role-server'
const clientRole = 'laplace-event-bridge-role-client'
const req = (origin, auth = token, selectedRole = role) => ({
  url: '/', headers: { origin, 'sec-websocket-protocol': `${selectedRole}, ${auth}` },
})

test('origin, authentication and producer role are enforced independently', () => {
  assert.equal(authorizeBridgeRequest(req(PRODUCER_ORIGIN), token), true)
  for (const origin of [undefined, 'null', 'file://', 'http://chat.laplace.live', 'https://chat.laplace.live.evil.test', 'https://evil.test']) {
    assert.equal(authorizeBridgeRequest(req(origin), token), false)
  }
  assert.equal(authorizeBridgeRequest(req(PRODUCER_ORIGIN, 'wrong'), token), false)
  assert.equal(authorizeBridgeRequest(req('file://', token, clientRole), token), true)
  assert.equal(authorizeBridgeRequest(req('https://evil.test', token, clientRole), token), false)
})

test('passive CDN media remains usable, script and URL escape routes are blocked', () => {
  assert.equal(isMediaURL('https://i0.hdslb.com/bfs/face/avatar.png'), true)
  for (const url of ['http://i0.hdslb.com/a', 'https://hdslb.com.evil.test/a', 'https://127.0.0.1/a', 'file:///C:/secret', 'https://i0.hdslb.com:9696/a']) {
    assert.equal(isMediaURL(url), false)
  }
  assert.equal(isExternalURL('https://chat.laplace.live'), true)
  assert.equal(isExternalURL('javascript:alert(1)'), false)
  const csp = contentSecurityPolicy()
  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /unsafe-eval/)
})

test('valid rich messages survive unchanged; malformed and excessive events do not', () => {
  const event = { type: 'message', id: '1', origin: 123, username: '用户', message: '你好[表情]', bmotes: { '[表情]': { url: 'https://i0.hdslb.com/a.png' } } }
  assert.equal(validateEvent(event), true)
  assert.equal(roomAllowed(event, '123,456'), true)
  assert.equal(roomAllowed(event, '456'), false)
  assert.equal(roomAllowed({ type: 'message' }, '123'), false)
  for (const value of [null, [], { ...event, message: {} }, { ...event, bmotes: { x: null } }, { ...event, message: 'x'.repeat(65537) }, { type: 'toast', id: '2', message: 'hello', toastAmountUnit: {} }, { type: 'online-update', online: Infinity }]) {
    assert.equal(validateEvent(value), false)
  }
  assert.equal(validateEvent({ type: 'online-update', online: 100 }), true)
})

async function open(origin, auth = token, selectedRole = role) {
  const socket = new WebSocket('ws://127.0.0.1:9696', [selectedRole, auth], origin ? { origin } : {})
  await once(socket, 'open')
  return socket
}

test('real official release: launch, authenticated broadcast, denied origins, port collision and shutdown', { timeout: 25000 }, async () => {
  const service = await startManagedBridge({
    executable: path.resolve('resources/bridge/leb-server-windows-x64.exe'), token,
    onFailure: () => assert.fail('official bridge exited unexpectedly'),
  })
  const sockets = []
  try {
    await assert.rejects(open('https://evil.test'), /403/)
    await assert.rejects(open(PRODUCER_ORIGIN, 'wrong'), /403/)
    await assert.rejects(open(undefined), /403/)
    const producer = await open(PRODUCER_ORIGIN)
    sockets.push(producer)
    const client = await open('file://', token, clientRole)
    sockets.push(client)
    // Skip the welcome and test an actual event through both proxy directions.
    const event = { type: 'message', id: 'security-test', origin: 123, username: '测试', message: '正常弹幕与表情保持原样' }
    const received = new Promise(resolve => client.on('message', bytes => {
      const value = JSON.parse(bytes)
      if (value.id === event.id) resolve(value)
    }))
    producer.send(JSON.stringify(event))
    const value = await received
    assert.deepEqual({ ...value, source: undefined }, { ...event, source: undefined })
    await assert.rejects(startManagedBridge({
      executable: path.resolve('resources/bridge/leb-server-windows-x64.exe'), token,
      onFailure() {},
    }), /EADDRINUSE/)
  } finally {
    for (const socket of sockets) socket.terminate()
    await service.stop()
  }
  assert.throws(() => process.kill(service.pid, 0), /ESRCH/)
  const response = await fetch('http://127.0.0.1:9696').then(() => true, () => false)
  assert.equal(response, false)
})
