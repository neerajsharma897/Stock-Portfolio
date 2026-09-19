import { appIcon } from "@/lib/pwa/icon"

// iPhones use this when the app is added to the home screen.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return appIcon(180, { maskable: true })
}
