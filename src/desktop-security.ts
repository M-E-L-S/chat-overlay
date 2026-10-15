import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserWindow, Session } from 'electron'

import { contentSecurityPolicy, isMediaURL } from './security-policy.ts'

export function isAppPage(url: string, rendererFile: string, devURL?: string): boolean {
  try {
    const parsed = new URL(url)
    if (devURL) {
      const dev = new URL(devURL)
      return parsed.origin === dev.origin && parsed.pathname === dev.pathname
    }
    return parsed.protocol === 'file:' && path.resolve(fileURLToPath(parsed)) === path.resolve(rendererFile)
  } catch { return false }
}

export function secureWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-frame-navigate', event => event.preventDefault())
  window.webContents.on('will-redirect', event => event.preventDefault())
  window.webContents.on('will-attach-webview', event => event.preventDefault())
}

export function secureSession(session: Session, rendererFile: string, devURL?: string) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
  session.on('will-download', event => event.preventDefault())
  const rendererRoot = path.dirname(rendererFile)
  const devOrigin = devURL ? new URL(devURL).origin : ''
  session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false
    try {
      const url = new URL(details.url)
      if (url.protocol === 'file:') {
        const relative = path.relative(rendererRoot, fileURLToPath(url))
        allowed = !relative.startsWith('..') && !path.isAbsolute(relative)
      } else if (devURL && (url.origin === devOrigin || url.origin === devOrigin.replace(/^http/, 'ws'))) {
        allowed = true
      } else if (url.hostname === '127.0.0.1' && url.port === '9696' && !url.username && !url.password) {
        allowed = (url.protocol === 'ws:' && details.resourceType === 'webSocket') ||
          (url.protocol === 'http:' && url.pathname === '/info' && details.resourceType === 'xhr')
      } else if (['image', 'font', 'stylesheet'].includes(details.resourceType)) {
        allowed = isMediaURL(details.url) || url.protocol === 'data:' || url.protocol === 'blob:'
      }
    } catch { /* malformed or unsupported URL */ }
    callback({ cancel: !allowed })
  })
  session.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame') { callback({}); return }
    callback({ responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [contentSecurityPolicy(devURL)],
      'X-Content-Type-Options': ['nosniff'],
    } })
  })
}
