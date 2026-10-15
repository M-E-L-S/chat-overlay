/* eslint-disable @typescript-eslint/no-require-imports */
// -r requires CommonJS. Run only with the development Electron binary.
const { app, BrowserWindow, dialog } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const WebSocket = require('ws')
const { once } = require('node:events')

const work = path.resolve('.cache/qa')
fs.mkdirSync(work, { recursive: true })
const errors = []
dialog.showErrorBox = (title, message) => { errors.push(`${title}: ${message}`); app.quit() }
app.on('browser-window-created', (_event, win) => {
  win.hide()
  win.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message)
  })
})
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let producer
let stage = 'start'
let passed = false
app.on('will-quit', () => { if (!passed) app.exit(1) })
app.whenReady().then(async () => {
  try {
    let win
    stage = 'wait for renderer'
    for (let i = 0; i < 100; i++) {
      win = BrowserWindow.getAllWindows()[0]
      if (win && !win.webContents.isLoading() && await win.webContents.executeJavaScript('!!document.getElementById("title-bar")')) break
      await sleep(100)
    }
    assert.ok(win, 'main window did not start')
    const page = win.webContents
    assert.equal(await page.executeJavaScript('!!document.getElementById("title-bar")'), true)
    stage = 'read managed connection'
    const bridge = await page.executeJavaScript('window.electronAPI.getManagedBridge()')
    assert.equal(bridge.host, '127.0.0.1')
    stage = 'verify credential storage'
    assert.equal(await page.executeJavaScript('JSON.parse(localStorage.getItem("overlay-settings")).state.serverBridgeAuthToken'), '')
    assert.equal(page.getLastWebPreferences().sandbox, true)
    assert.equal(page.getLastWebPreferences().nodeIntegration, false)
    stage = 'send fixture events'
    producer = new WebSocket('ws://127.0.0.1:9696', ['laplace-event-bridge-role-server', bridge.token], { origin: 'https://chat.laplace.live' })
    await once(producer, 'open')
    const events = JSON.parse(fs.readFileSync(path.join(work, 'events.json'), 'utf8'))
    for (const event of events) producer.send(JSON.stringify(event))
    await sleep(1500)
    const rows = await page.executeJavaScript('document.querySelectorAll("[data-slot=event]").length')
    assert.equal(rows, events.length)
    assert.equal(await page.executeJavaScript('typeof window.require'), 'undefined')
    // An invalid IPC value must not affect the native window.
    stage = 'verify IPC and window controls'
    const pinned = win.isAlwaysOnTop()
    await page.executeJavaScript('window.electronAPI.setAlwaysOnTop("true")')
    await sleep(100)
    assert.equal(win.isAlwaysOnTop(), pinned)
    await page.executeJavaScript('window.electronAPI.setAlwaysOnTop(true)')
    await sleep(100)
    assert.equal(win.isAlwaysOnTop(), true)
    await page.executeJavaScript('window.electronAPI.setAlwaysOnTop(false)')
    await page.executeJavaScript('window.electronAPI.setClickThrough(true)')
    await sleep(100)
    await page.executeJavaScript('window.electronAPI.setClickThrough(false)')
    const image = await page.capturePage()
    fs.writeFileSync(path.join(work, 'overlay.png'), image.toPNG())
    stage = 'open settings'
    await page.executeJavaScript('document.getElementById("settings-btn").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, button:0, pointerType:"mouse"}))')
    await sleep(100)
    await page.executeJavaScript('[...document.querySelectorAll("[role=menuitem]")].find(e => e.textContent.includes("Settings")).click()')
    await sleep(200)
    assert.equal(await page.executeJavaScript('!!document.querySelector("[role=dialog]")'), true)
    assert.equal(await page.executeJavaScript('document.getElementById("server-host").readOnly'), true)
    fs.writeFileSync(path.join(work, 'settings.png'), (await page.capturePage()).toPNG())
    await page.executeJavaScript('document.getElementById("server-host").scrollIntoView({block:"center"})')
    await sleep(200)
    fs.writeFileSync(path.join(work, 'bridge-settings.png'), (await page.capturePage()).toPNG())
    // CSP and session filtering must prevent an off-domain request.
    assert.equal(await page.executeJavaScript('fetch("https://example.com/security-smoke").then(()=>false,()=>true)'), true)
    // The refusal above is intentional, not a regression.
    const unexpected = errors.filter(message => !/example\.com|Content Security Policy|Refused to connect|violates.*policy/i.test(message))
    assert.deepEqual(unexpected, [])
    fs.writeFileSync(path.join(work, 'desktop-result.json'), JSON.stringify({ rows, sandbox: true, settings: true, externalRequestBlocked: true, errors: unexpected }, null, 2))
    console.log('Desktop smoke passed: 29 original fixtures, managed connection, settings, IPC and CSP')
    passed = true
    producer.terminate()
    app.quit()
  } catch (error) {
    console.error('Desktop smoke failed:', stage, error, errors)
    fs.writeFileSync(path.join(work, 'desktop-result.json'), JSON.stringify({ stage, error: String(error), errors }, null, 2))
    producer?.terminate()
    process.exitCode = 1
    app.quit()
  }
})
setTimeout(() => { console.error('Desktop smoke timeout', errors); app.quit() }, 30000).unref()
