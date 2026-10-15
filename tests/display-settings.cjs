/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated renderer regression: no managed bridge, live stream or user profile.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const profile = path.resolve('.cache/display-settings/profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let passed = false
let stage = 'start'
app.on('will-quit', () => { if (!passed) app.exit(1) })
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: path.join(__dirname, 'display-settings-preload.cjs'),
    } })
    const page = win.webContents
    page.on('console-message', event => { if (event.level === 'error') console.error('Renderer:', event.message) })
    stage = 'prepare isolated page'
    await page.loadURL('about:blank')
    page.debugger.attach('1.3')
    await page.debugger.sendCommand('Page.enable')
    await page.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('overlay-settings', JSON.stringify({state: {
        showInteractionEvents: true, showGiftFree: true, showEntryEffect: true,
        allowedOrigins: '', customCSS: '', serverBridgeAuthToken: ''
      }, version: 0}));
      const sockets = [];
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 0;
        constructor() { sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.({}); }, 10); }
        send() {}
        close() { this.readyState = 3; }
      };
      window.__sendTestEvent = event => sockets.filter(s => s.readyState === 1).forEach(s => s.onmessage?.({data:JSON.stringify(event)}));
      window.fetch = async () => new Response('', {status:404});
    ` })
    stage = 'load renderer'
    await page.loadFile(path.resolve('.vite/renderer/main_window/index.html'))
    for (let i = 0; i < 50 && !await page.executeJavaScript('!!document.getElementById("title-bar")'); i++) await sleep(50)
    await sleep(100)
    stage = 'generate fixtures'
    const { buildPreviewEvents } = await require('jiti').createJiti(__filename).import('../src/dev/preview-events.ts')
    const events = buildPreviewEvents()
    stage = 'send fixture events'
    await page.executeJavaScript(`${JSON.stringify(events)}.forEach(window.__sendTestEvent)`)
    await sleep(100)
    const count = () => page.executeJavaScript('document.querySelectorAll("[data-slot=event]").length')
    const types = () => page.executeJavaScript('[...document.querySelectorAll("[data-slot=event]")].map(e => e.dataset.eventType)')
    assert.equal(await count(), events.length)
    stage = 'open settings'
    await page.executeJavaScript('document.getElementById("settings-btn").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true,button:0,pointerType:"mouse"}))')
    await sleep(50)
    await page.executeJavaScript('[...document.querySelectorAll("[role=menuitem]")].find(e=>e.textContent.includes("Settings")).click()')
    await sleep(100)
    async function setFlag(id, enabled) {
      stage = `toggle ${id}: ${enabled}`
      await page.executeJavaScript(`(() => {
        const checkbox = document.getElementById(${JSON.stringify(id)});
        if ((checkbox.getAttribute('aria-checked') === 'true') !== ${enabled}) checkbox.click();
      })()`)
      await sleep(100)
    }
    await setFlag('show-interaction-events', false)
    assert.equal(await page.executeJavaScript('JSON.parse(localStorage.getItem("overlay-settings")).state.showInteractionEvents'), false)
    const nonInteractive = events.filter(e => !['interaction', 'like-click'].includes(e.type)).length
    assert.equal(await count(), nonInteractive)
    assert.ok(!(await types()).includes('interaction'))
    assert.ok(!(await types()).includes('like-click'))
    const interaction = events.find(e => e.type === 'interaction')
    await page.executeJavaScript(`window.__sendTestEvent(${JSON.stringify({ ...interaction, id: 'new-hidden-interaction' })})`)
    await sleep(100)
    assert.equal(await count(), nonInteractive, 'new entry events must remain hidden')
    await setFlag('show-interaction-events', true)
    assert.equal(await count(), events.length + 1, 're-enabling must reveal existing and new interactions')
    await setFlag('show-entry-effect', false)
    assert.ok(!(await types()).includes('entry-effect'))
    assert.ok((await types()).includes('interaction'), 'entry effects and interactions use separate controls')
    await setFlag('show-entry-effect', true)
    await setFlag('show-gift-free', false)
    const freeGifts = events.filter(e => e.type === 'gift' && e.coinType === 'silver').length
    assert.ok(freeGifts > 0)
    assert.equal(await count(), events.length + 1 - freeGifts)
    await setFlag('show-gift-free', true)
    assert.equal(await count(), events.length + 1)
    const settings = await page.executeJavaScript('JSON.parse(localStorage.getItem("overlay-settings")).state')
    assert.equal(settings.showInteractionEvents, true)
    console.log('Display settings passed: existing/new interactions, likes, entry effects and free gifts')
    passed = true
    win.destroy()
    app.quit()
  } catch (error) { console.error(error); app.quit() }
})
setTimeout(() => { console.error('Display settings timeout:', stage); app.quit() }, 20000).unref()
