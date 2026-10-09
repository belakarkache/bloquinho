import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const iconBackground = { resizeOptions: { background: '#0b0c0e' } }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, ...iconBackground },
    apple: { ...minimal2023Preset.apple, padding: 0.1, ...iconBackground },
  },
  images: ['public/icon.svg'],
})
