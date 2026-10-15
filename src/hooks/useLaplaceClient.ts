import { ConnectionState, LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'
import type { LaplaceEvent } from '@laplace.live/event-types'
import { useEffect, useRef } from 'react'

import { useRuntimeStore } from '../store/useRuntimeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { roomAllowed, validateEvent } from '../event-validation'

export function useLaplaceClient() {
  const clientRef = useRef<LaplaceEventBridgeClient | null>(null)

  const { serverHost, serverPort, serverBridgeAuthToken, allowedOrigins } = useSettingsStore()
  const { setConnectionState, setOnlineUserCount, addMessage, clearMessages } = useRuntimeStore()

  // Use ref for allowedOrigins to avoid stale closures
  const allowedOriginsRef = useRef(allowedOrigins)
  useEffect(() => {
    allowedOriginsRef.current = allowedOrigins
  }, [allowedOrigins])

  useEffect(() => {
    // Disconnect previous client if exists
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }

    // Initialize the event bridge client
    const websocketUrl =
      serverHost.startsWith('ws://') || serverHost.startsWith('wss://')
        ? `${serverHost}:${serverPort}`
        : `ws://${serverHost}:${serverPort}`

    const client = new LaplaceEventBridgeClient({
      url: websocketUrl,
      token: serverBridgeAuthToken,
      reconnect: true,
    })

    // Handle incoming events
    const handleEvent = (event: LaplaceEvent) => {
      if (!validateEvent(event) || !roomAllowed(event, allowedOriginsRef.current)) return

      // Handle online-update event separately
      if (event.type === 'online-update') {
        setOnlineUserCount(event.online)
        return // Don't add to messages
      }

      // Add other events to messages
      addMessage(event)
    }

    // Handle connection state changes
    const handleConnectionStateChange = (state: ConnectionState) => {
      console.log(`Connection state changed to: ${state}`)
      setConnectionState(state)
    }

    // Set up event listeners
    client.onAny(handleEvent)
    client.onConnectionStateChange(handleConnectionStateChange)

    // Connect to the event bridge
    client.connect().catch(err => {
      console.error('Failed to connect to event bridge:', err)
    })

    clientRef.current = client

    // Cleanup on unmount or when server settings change
    return () => {
      client.offAny(handleEvent)
      client.offConnectionStateChange(handleConnectionStateChange)
      client.disconnect()
      clientRef.current = null
      clearMessages()
    }
  }, [serverHost, serverPort, serverBridgeAuthToken, setConnectionState, setOnlineUserCount, addMessage, clearMessages])

  // Return the client instance if needed for direct access
  return clientRef.current
}
