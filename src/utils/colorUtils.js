/**
 * Compute a readable text color for a given wire color on a dark background.
 * Falls back to a soft light gray if the wire color is too dark to read.
 */
export function getLabelColor(wireColor) {
  if (!wireColor) return 'var(--text-muted)'
  let hex = String(wireColor).replace(/^#/, '')
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  if (hex.length !== 6) return wireColor
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return wireColor
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 0.22 ? '#e0e0e0' : wireColor
}
