/**
 * Compute pin positions for SVG. All values in same scale (e.g. pixels).
 * Supports single row (rows: [n]), two rows (rows: [topCount, bottomCount]),
 * or layout 'triangle' for 3-pin power.
 */
export function getPinPositions(connectorType) {
  const { rows, layout } = connectorType
  const pinSpacing = 24
  const rowGap = 28
  const startX = 8
  const topY = 24
  const bottomY = topY + rowGap

  const positions = []
  let pinNum = 1

  // 3-pin power: triangular layout (pin 1 top, 2 bottom-left, 3 bottom-right)
  if (layout === 'triangle' && connectorType.totalPins === 3) {
    const cx = startX + pinSpacing
    const cy = topY + 20
    const r = 28
    const angles = [-90, 150, 30].map((deg) => (deg * Math.PI) / 180)
    angles.forEach((a, i) => {
      positions.push({
        pinNumber: i + 1,
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
        row: 0,
      })
    })
    return positions
  }

  if (rows.length === 1) {
    // Single row
    const count = rows[0]
    for (let i = 0; i < count; i++) {
      positions.push({
        pinNumber: pinNum,
        x: startX + i * pinSpacing,
        y: topY,
        row: 0,
      })
      pinNum++
    }
    return positions
  }

  // Two rows (D-sub style)
  const [topCount, bottomCount] = rows
  for (let i = 0; i < topCount; i++) {
    positions.push({
      pinNumber: pinNum,
      x: startX + i * pinSpacing,
      y: topY,
      row: 0,
    })
    pinNum++
  }
  for (let i = 0; i < bottomCount; i++) {
    positions.push({
      pinNumber: pinNum,
      x: startX + pinSpacing / 2 + i * pinSpacing,
      y: bottomY,
      row: 1,
    })
    pinNum++
  }

  return positions
}

/**
 * Bounding box for the connector body.
 * For layout 'triangle', uses center + radius so the triangular shell fits.
 */
export function getConnectorBounds(connectorType) {
  const positions = getPinPositions(connectorType)
  if (positions.length === 0) return { x: 0, y: 0, width: 80, height: 60 }
  const padding = 20

  if (connectorType.layout === 'triangle' && positions.length === 3) {
    const cx = (positions[0].x + positions[1].x + positions[2].x) / 3
    const cy = (positions[0].y + positions[1].y + positions[2].y) / 3
    const r = Math.max(...positions.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 14
    return {
      x: cx - r - padding,
      y: cy - r - padding,
      width: 2 * r + padding * 2,
      height: 2 * r + padding * 2,
    }
  }

  const xs = positions.map((p) => p.x)
  const ys = positions.map((p) => p.y)
  return {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - 14,
    width: Math.max(...xs) - Math.min(...xs) + padding * 2,
    height: Math.max(...ys) - Math.min(...ys) + padding + 10,
  }
}

/**
 * Wire segment: from pin to a point to the right (cable side).
 */
export const WIRE_LENGTH = 36
export const PIN_RADIUS = 6
