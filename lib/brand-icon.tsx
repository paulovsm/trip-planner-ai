import { ImageResponse } from "next/og"

export const BRAND_COLOR = "#0e6377"

/**
 * App icon (map pin over a route) rendered with next/og, so there are no binary
 * assets to maintain. `padding` > 0 produces a maskable icon (safe zone ≈ 80%).
 */
export function brandIcon(size: number, { padding = 0, rounded = true } = {}) {
  const inner = size * (1 - padding * 2)
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_COLOR,
          borderRadius: rounded && padding === 0 ? size * 0.22 : 0,
        }}
      >
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24" fill="none">
          <path
            d="M3 19c3-1 4-4 7-4s4 2 7 1"
            stroke="#7fd3e3"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="1.5 2"
          />
          <path
            d="M12 2.5c-3.6 0-6.5 2.8-6.5 6.3 0 4.6 6.5 10.7 6.5 10.7s6.5-6.1 6.5-10.7c0-3.5-2.9-6.3-6.5-6.3Z"
            fill="#ffffff"
          />
          <circle cx="12" cy="8.8" r="2.4" fill={BRAND_COLOR} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
