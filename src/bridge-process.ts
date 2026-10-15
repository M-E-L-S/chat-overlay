import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import net from 'node:net'

import { startBridgeGateway } from './bridge-gateway.ts'

export const BRIDGE_SHA256 = 'f312bc92ff9988a6753a2d53745baea8af9dce9c17f4f94b105892ab98594ab1'

async function unusedPort(): Promise<number> {
  const server = net.createServer()
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

async function probe(port: number, token: string): Promise<boolean> {
  return new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, ['laplace-event-bridge-role-client', token])
    const finish = (ok: boolean) => { clearTimeout(timer); ws.close(); resolve(ok) }
    const timer = setTimeout(() => finish(false), 500)
    ws.onmessage = event => {
      try { finish(JSON.parse(String(event.data)).type === 'established') } catch { finish(false) }
    }
    ws.onerror = () => finish(false)
  })
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve() }, 3000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    child.kill()
  })
}

export async function startManagedBridge(options: {
  executable: string; token: string; devOrigin?: string; onFailure: () => void
}) {
  const digest = createHash('sha256').update(await readFile(options.executable)).digest('hex')
  if (digest !== BRIDGE_SHA256) throw new Error('官方桥接器完整性校验失败，未运行该文件。请恢复已核验的 0.3.21 发布版。')
  const backendPort = await unusedPort()
  const backendToken = randomBytes(32).toString('base64url')
  // Claim the public endpoint first. Never silently connect to another process.
  const gateway = await startBridgeGateway({ port: 9696, backendPort, token: options.token, backendToken, devOrigin: options.devOrigin })
  const child = spawn(options.executable, ['--host', '127.0.0.1', '--port', String(backendPort), '--auth', backendToken], {
    windowsHide: true, shell: false, stdio: 'ignore',
  })
  let failed = false
  let stopping = false
  let ready = false
  child.on('error', () => { failed = true })
  child.on('exit', () => {
    failed = true
    if (ready && !stopping) {
      void gateway.stop()
      options.onFailure()
    }
  })
  try {
    for (let attempt = 0; attempt < 40 && !failed; attempt++) {
      if (await probe(backendPort, backendToken)) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!ready || failed) throw new Error('官方桥接器未能启动；请检查文件是否被系统拦截。')
  } catch (error) {
    stopping = true
    await gateway.stop()
    await stopChild(child)
    throw error
  }
  return {
    pid: child.pid,
    async stop() {
      stopping = true
      await gateway.stop()
      await stopChild(child)
    },
  }
}
