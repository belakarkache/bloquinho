/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const NO_CACHE_PATHS = ['/sw.js', '/manifest.webmanifest']

function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, code]) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`,
  )
}

function securityHeaders(supabaseUrl: string): Record<string, string> {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const policy: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", ...inlineScriptHashes(readFileSync('index.html', 'utf8')), "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      supabaseOrigin,
      'https://generativelanguage.googleapis.com',
      'https://huggingface.co',
      'https://*.huggingface.co',
      'https://*.hf.co',
      'https://cdn.jsdelivr.net',
    ].filter(Boolean),
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return {
    'Content-Security-Policy': Object.entries(policy)
      .map(([directive, sources]) => [directive, ...sources].join(' '))
      .join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
  }
}

function headersFile(headers: Record<string, string>): Plugin {
  const lines = (entries: Record<string, string>) => Object.entries(entries).map(([name, value]) => `  ${name}: ${value}`)
  const source = [
    '/*',
    ...lines(headers),
    ...NO_CACHE_PATHS.flatMap((path) => [path, ...lines({ 'Cache-Control': 'no-cache' })]),
    '',
  ].join('\n')

  return {
    name: 'security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source })
    },
  }
}

export default defineConfig(({ mode }) => {
  const headers = securityHeaders(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? '')

  return {
    resolve: {
      conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
    },
    plugins: [
      react(),
      tailwindcss(),
      headersFile(headers),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Bloquinho',
          short_name: 'Bloquinho',
          description: 'Anotações rápidas no navegador, no PC e no celular.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f4f5f7',
          theme_color: '#f4f5f7',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          globIgnores: ['email/**'],
          navigateFallback: 'index.html',
          navigateFallbackAllowlist: [/^\/$/, /^\/kanbaninho\/?$/],
        },
      }),
    ],
    preview: { headers },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_AUTH_GOOGLE: '' },
    },
  }
})
