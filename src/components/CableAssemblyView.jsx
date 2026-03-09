import React from 'react'
import {
  getPinPositions,
  getConnectorBounds,
  WIRE_LENGTH,
  PIN_RADIUS,
} from '../connectors/connectorGeometry'
import './CableAssemblyView.css'

const PAD = 60
const CABLE_GAP = 80

/** Return a readable text color for dark backgrounds when wire color is too dark */
function getLabelColor(wireColor) {
  if (!wireColor) return 'var(--text-muted)'
  let hex = wireColor.replace(/^#/, '')
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 0.4 ? '#e0e0e0' : wireColor
}

function ConnectorBlock({
  connector,
  getPinState,
  selectedPinNumber,
  onSelectPin,
  baseX,
  baseY,
  connectorIndex,
  defsId,
}) {
  if (!connector) return null

  const positions = getPinPositions(connector)
  const bounds = getConnectorBounds(connector)
  const shape = connector.shape ?? 'dsub'

  const blockWidth = bounds.width + PAD * 2 + WIRE_LENGTH
  const blockHeight = bounds.height + PAD * 2

  const trianglePath =
    shape === 'power3Triangle' && positions.length === 3
      ? (() => {
          const cx = positions.reduce((s, p) => s + p.x, 0) / 3
          const cy = positions.reduce((s, p) => s + p.y, 0) / 3
          const r = Math.max(...positions.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 14
          const angles = [-90, 150, 30].map((deg) => (deg * Math.PI) / 180)
          const verts = angles.map((a) => ({
            x: cx + r * Math.cos(a) - bounds.x,
            y: cy + r * Math.sin(a) - bounds.y,
          }))
          return `M ${verts[0].x} ${verts[0].y} L ${verts[1].x} ${verts[1].y} L ${verts[2].x} ${verts[2].y} Z`
        })()
      : null

  return (
    <g transform={`translate(${baseX}, ${baseY})`}>
      <defs>
        <filter id={`pin-glow-${defsId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`shell-gradient-${defsId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3d4f5f" />
          <stop offset="100%" stopColor="#2a3544" />
        </linearGradient>
      </defs>

      {/* Shell */}
      <g transform={`translate(${PAD}, ${PAD}) translate(${bounds.x}, ${bounds.y})`}>
        {shape === 'jack35mm' ? (
          <rect
            className="connector-shell"
            x={0}
            y={0}
            width={bounds.width}
            height={bounds.height}
            rx={bounds.height / 2}
            ry={bounds.height / 2}
            fill={`url(#shell-gradient-${defsId})`}
            stroke="var(--border)"
            strokeWidth="2"
          />
        ) : shape === 'power3Triangle' && trianglePath ? (
          <path
            className="connector-shell"
            d={trianglePath}
            fill={`url(#shell-gradient-${defsId})`}
            stroke="var(--border)"
            strokeWidth="2"
          />
        ) : shape === 'singleRow' ? (
          <rect
            className="connector-shell"
            x={0}
            y={0}
            width={bounds.width}
            height={bounds.height}
            rx={8}
            ry={8}
            fill={`url(#shell-gradient-${defsId})`}
            stroke="var(--border)"
            strokeWidth="2"
          />
        ) : (
          <path
            className="connector-shell"
            d={`M 0 4 L ${bounds.width} 4 L ${bounds.width - 8} ${bounds.height - 4} L 8 ${bounds.height - 4} Z`}
            fill={`url(#shell-gradient-${defsId})`}
            stroke="var(--border)"
            strokeWidth="2"
          />
        )}
      </g>

      {/* Pins */}
      <g transform={`translate(${PAD}, ${PAD})`}>
        {positions.map(({ pinNumber, x, y }) => {
          const state = getPinState(pinNumber)
          const color = state?.color ?? '#6c757d'
          const isSelected = selectedPinNumber?.pinNumber === pinNumber && selectedPinNumber?.connectorIndex === connectorIndex
          return (
            <g
              key={pinNumber}
              className="pin-group"
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectPin(connectorIndex, pinNumber)}
              style={{ cursor: 'pointer' }}
            >
              <g className="pin-zoom">
                <circle
                  className={`pin-circle ${isSelected ? 'pin-selected' : ''}`}
                  cx={0}
                  cy={0}
                  r={PIN_RADIUS}
                  fill={color}
                  stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.3)'}
                  strokeWidth={isSelected ? 3 : 1}
                  filter={isSelected ? `url(#pin-glow-${defsId})` : undefined}
                />
              </g>
              <text
                className="pin-number-label"
                x={0}
                y={-PIN_RADIUS - 4}
                textAnchor="middle"
                fill="var(--text-muted)"
              >
                {pinNumber}
              </text>
            </g>
          )
        })}
      </g>
    </g>
  )
}

export function CableAssemblyView({
  connectors,
  getPinStateAt,
  pinLinks,
  selectedPin,
  onSelectPin,
}) {
  if (!connectors || connectors.length === 0) return null

  const blockWidths = connectors.map((c) => {
    if (!c) return PAD * 2 + WIRE_LENGTH
    const bounds = getConnectorBounds(c)
    return bounds.width + PAD * 2 + WIRE_LENGTH
  })

  const blockHeights = connectors.map((c) => {
    if (!c) return PAD * 2
    const bounds = getConnectorBounds(c)
    return bounds.height + PAD * 2
  })

  const totalWidth = blockWidths.reduce((a, b) => a + b, 0) + CABLE_GAP * (connectors.length - 1)
  const totalHeight = Math.max(...blockHeights, 1)

  let x = 0
  const blockPositions = connectors.map((_, i) => {
    const pos = x
    x += blockWidths[i] + (i < connectors.length - 1 ? CABLE_GAP : 0)
    return pos
  })

  const getWireEnd = (connectorIndex, pinNumber, towardRight) => {
    const conn = connectors[connectorIndex]
    if (!conn) return null
    const positions = getPinPositions(conn)
    const pos = positions.find((p) => p.pinNumber === pinNumber)
    if (!pos) return null
    const baseX = blockPositions[connectorIndex]
    if (towardRight) {
      return { x: baseX + PAD + pos.x + WIRE_LENGTH, y: PAD + pos.y }
    }
    return { x: baseX + PAD + pos.x - WIRE_LENGTH, y: PAD + pos.y }
  }

  const linkPaths = []
  const seen = new Set()
  Object.entries(pinLinks || {}).forEach(([key, value]) => {
    const canon = [key, value].sort().join('|')
    if (seen.has(canon)) return
    seen.add(canon)
    const [ci, pn] = key.split(':').map(Number)
    const [cj, pn2] = String(value).split(':').map(Number)
    const leftIdx = Math.min(ci, cj)
    const rightIdx = Math.max(ci, cj)
    const start = leftIdx === ci ? getWireEnd(ci, pn, true) : getWireEnd(cj, pn2, true)
    const end = rightIdx === cj ? getWireEnd(cj, pn2, false) : getWireEnd(ci, pn, false)
    if (!start || !end) return
    const color = getPinStateAt(ci, pn)?.color ?? '#6c757d'
    linkPaths.push({ start, end, color })
  })

  return (
    <div className="cable-assembly-view">
      <svg
        className="cable-assembly-svg"
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="cable-links">
          {linkPaths.map(({ start, end, color }, i) => (
            <path
              key={i}
              className="cable-link-path"
              d={`M ${start.x} ${start.y} C ${start.x + 40} ${start.y}, ${end.x - 40} ${end.y}, ${end.x} ${end.y}`}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}
        </g>

        {connectors.map((conn, i) => (
          <React.Fragment key={i}>
            <ConnectorBlock
              connector={conn}
              getPinState={(pn) => getPinStateAt(i, pn)}
              selectedPinNumber={selectedPin}
              onSelectPin={onSelectPin}
              baseX={blockPositions[i]}
              baseY={0}
              connectorIndex={i}
              defsId={`c${i}`}
            />
            {i < connectors.length - 1 && (
              <rect
                className="cable-body"
                x={blockPositions[i] + blockWidths[i]}
                y={totalHeight / 2 - 12}
                width={CABLE_GAP}
                height={24}
                rx={4}
                fill="var(--bg-dark)"
                stroke="var(--border)"
                strokeWidth="1"
              />
            )}
          </React.Fragment>
        ))}
      </svg>

      <div className="cable-assembly-labels">
        {connectors.map((conn, i) => {
          if (!conn) return null
          const positions = getPinPositions(conn)
          return (
            <div key={i} className="cable-connector-labels">
              <span className="cable-connector-name">Connector {i + 1}</span>
              <div className="pin-label-row">
                {positions.map(({ pinNumber }) => {
                  const state = getPinStateAt(i, pinNumber)
                  const label = state?.label ?? `Pin ${pinNumber}`
                  const linked = pinLinks?.[`${i}:${pinNumber}`]
                  return (
                    <div
                      key={pinNumber}
                      className="pin-label-item"
                      style={{ color: getLabelColor(state?.color ?? '#6c757d') }}
                    >
                      <span className="pin-label-num">{pinNumber}</span>
                      <span className="pin-label-text" title={label}>
                        {label}
                        {linked ? ` → ${linked}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
