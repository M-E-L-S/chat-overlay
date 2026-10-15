import type { LaplaceEvent } from '@laplace.live/event-types'

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

// Bounds are deliberately generous for real events, including rich gifts/emotes.
// Reject malformed events as a whole; do not truncate or restyle valid content.
export function validateEvent(value: unknown): value is LaplaceEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || value.type.length > 128) return false
  if (['ping', 'pong', 'established', 'broadcast-success', 'client-message-received'].includes(value.type)) return false
  let nodes = 0
  let chars = 0
  function bounded(v: unknown, depth = 0): boolean {
    if (++nodes > 12000 || depth > 16) return false
    if (typeof v === 'string') { chars += v.length; return v.length <= 65536 && chars <= 1048576 }
    if (typeof v === 'number') return Number.isFinite(v)
    if (Array.isArray(v)) return v.length <= 2000 && v.every(item => bounded(item, depth + 1))
    if (isRecord(v)) return Object.entries(v).every(([key, item]) =>
      key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && bounded(item, depth + 1))
    return v === null || typeof v === 'boolean'
  }
  if (!bounded(value)) return false
  if (value.type === 'online-update') return typeof value.online === 'number' && value.online >= 0
  if (typeof value.id !== 'string' && typeof value.id !== 'number') return false
  if (value.origin !== undefined && typeof value.origin !== 'string' && typeof value.origin !== 'number') return false
  for (const key of ['message', 'username', 'avatar', 'giftName', 'giftAction', 'giftIcon', 'toastName', 'toastAmountUnit', 'rewardName']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false
  }
  for (const key of ['priceNormalized', 'giftAmount', 'toastAmount', 'toastType', 'action', 'guardType']) {
    if (value[key] !== undefined && typeof value[key] !== 'number') return false
  }
  if (value.type === 'toast' && (typeof value.message !== 'string' || typeof value.toastAmountUnit !== 'string')) return false
  if (value.emote != null && (!isRecord(value.emote) || typeof value.emote.url !== 'string')) return false
  if (value.bmotes != null && (!isRecord(value.bmotes) || !Object.values(value.bmotes).every(item => isRecord(item) && typeof item.url === 'string'))) return false
  if (value.blindGift != null && (!isRecord(value.blindGift) || typeof value.blindGift.gift_tip_price !== 'number')) return false
  if (value.relation != null && (!isRecord(value.relation) || typeof value.relation.type !== 'number' ||
    (value.relation.icon !== undefined && typeof value.relation.icon !== 'string') ||
    (value.relation.text !== undefined && typeof value.relation.text !== 'string'))) return false
  if (value.list != null && (!Array.isArray(value.list) || !value.list.every(isRecord))) return false
  if (value.type === 'red-envelope-start' && Array.isArray(value.list) && !value.list.every(item =>
    typeof item.gift_pic === 'string' && typeof item.gift_name === 'string' && typeof item.num === 'number')) return false
  return true
}

export function roomAllowed(event: { origin?: unknown; type: string }, rooms: string): boolean {
  const allowed = rooms.split(',').map(room => room.trim()).filter(Boolean)
  // System events legitimately have no room. Other events must match when filtered.
  return allowed.length === 0 || (event.type === 'system' && event.origin === undefined) || allowed.includes(String(event.origin))
}
