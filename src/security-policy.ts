// Keep remote media passive: the app never needs a remote script, frame or worker.
export const MEDIA_HOSTS = ['hdslb.com', 'biliimg.com', 'bilibili.com', 'laplace.live']

export function isMediaURL(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      MEDIA_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export function isExternalURL(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'github.com' || url.hostname === 'chat.laplace.live' || url.hostname === 'laplace.live')
  } catch {
    return false
  }
}

export function contentSecurityPolicy(devURL?: string): string {
  const dev = devURL ? new URL(devURL).origin : ''
  const hotReload = dev.replace(/^http/, 'ws')
  return [
    "default-src 'self'",
    `script-src 'self'${dev ? ` ${dev}` : ''}`,
    // Radix, Tailwind, animation and user CSS use inline styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MEDIA_HOSTS.map(host => `https://${host} https://*.${host}`).join(' ')}`,
    `font-src 'self' data: ${MEDIA_HOSTS.map(host => `https://${host} https://*.${host}`).join(' ')}`,
    `connect-src ws://127.0.0.1:9696 http://127.0.0.1:9696${dev ? ` ${dev} ${hotReload}` : ''}`,
    "object-src 'none'", "frame-src 'none'", "worker-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ')
}
