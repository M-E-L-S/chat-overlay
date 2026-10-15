import { Component, type ReactNode } from 'react'

// Isolate an unexpected future/malformed event without taking down the overlay.
export class EventBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}
