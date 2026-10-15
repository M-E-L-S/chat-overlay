import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'resources/bridge/leb-server-windows-x64.exe')
const expected = 'f312bc92ff9988a6753a2d53745baea8af9dce9c17f4f94b105892ab98594ab1'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

try {
  const bytes = await readFile(file)
  if (digest(bytes) !== expected) throw new Error('Existing bridge hash mismatch; restore the pinned official 0.3.21 release.')
  console.log('Official bridge 0.3.21 verified:', file)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  console.log('Downloading official bridge 0.3.21 to:', file)
  console.log('Source: GitHub official release asset; no installer or global runtime is added.')
  const response = await fetch('https://github.com/laplace-live/event-bridge/releases/download/%40laplace.live/event-bridge-server%400.3.21/leb-server-windows-x64.exe', {
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`Bridge download failed: HTTP ${response.status}`, { cause: error })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (digest(bytes) !== expected) throw new Error('Downloaded bridge hash mismatch; file was not installed.', { cause: error })
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.download-${process.pid}`
  try {
    await writeFile(temporary, bytes, { flag: 'wx' })
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
  console.log('Official bridge verified:', file)
}
