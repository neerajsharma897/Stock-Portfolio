import { ImageResponse } from "next/og"

// The app's wallet mark (lucide "wallet") on the brand blue, for home-screen icons.
const PRIMARY = "#3f5bd9"
const WALLET_PATHS = [
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
  "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
]

/**
 * A square PNG icon. `maskable` icons fill the square and keep the mark inside
 * the middle 60%, since phones crop them to their own shape.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const mark = Math.round(size * (maskable ? 0.45 : 0.55))
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PRIMARY,
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
      }}
    >
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {WALLET_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>,
    { width: size, height: size },
  )
}
