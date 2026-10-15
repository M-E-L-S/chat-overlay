/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge } = require('electron')
const noop = () => {}
contextBridge.exposeInMainWorld('electronAPI', {
  setWindowOpacity: noop, setAlwaysOnTop: noop, setClickThrough: noop,
  setClickThroughSuspended: noop, setIgnoreMouseEvents: noop,
  setTitleBarHeight: noop, notifyTitleBarHovered: noop,
  onClickThroughEnabled: () => noop,
  getAppVersion: async () => 'test', getManagedBridge: async () => null,
  copyBridgeToken: noop, openExternal: noop,
})
