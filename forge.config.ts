import path from 'node:path'
import fs from 'node:fs'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'

// Environment-specific app icon without extension: Packager picks the format per platform, and
// the Windows installer reuses the .ico
const APP_ICON = `src/assets/icons/${process.env.NODE_ENV === 'development' ? 'dev' : 'prod'}/icon`

const config: ForgeConfig = {
  outDir: process.env.CHAT_OVERLAY_BUILD_DIR,
  packagerConfig: {
    asar: true,
    extraResource: [path.resolve('resources/bridge')],
    download: {
      cacheRoot: path.resolve('..', '.cache', 'electron'),
      checksums: JSON.parse(fs.readFileSync(path.resolve('node_modules/electron/checksums.json'), 'utf8')),
    },
    icon: APP_ICON,
    executableName: 'chat-overlay',
    appBundleId: 'live.laplace.chat-overlay',
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
