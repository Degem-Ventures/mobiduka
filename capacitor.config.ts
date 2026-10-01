import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: 'com.mobiduka.pos',
  appName: 'MobiDuka POS',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    ...(serverUrl ? { url: serverUrl } : {}),
  },
}

export default config
