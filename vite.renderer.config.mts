import path from 'node:path'
import { fileURLToPath } from 'node:url'
// https://github.com/tailwindlabs/tailwindcss/discussions/16250
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { contentSecurityPolicy } from './src/security-policy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config
export default defineConfig({
  plugins: [tailwindcss(), {
    name: 'local-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy() }, injectTo: 'head-prepend' }]
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
