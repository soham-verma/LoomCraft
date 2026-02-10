import React from 'react'
import { getPinPositions, getConnectorBounds, WIRE_LENGTH, PIN_RADIUS } from '../connectors/connectorGeometry'
import './ConnectorView.css'

export function ConnectorView({ connector, getPinState, selectedPinNumber, onSelectPin }) {
  if (!connector) return null

  const positions = getPinPositions(connector)
  const bounds = getConnectorBounds(connector)
  const svgPadding = 60
  const shape = connector.shape ?? 'dsub'

  const width = bounds.width + svgPadding * 2 + WIRE_LENGTH
  const height = bounds.height + svgPadding * 2

  // Triangle shell for 3-pin power: vertices in content coords, then to shell local
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
    <div className="connector-view">
      <svg
        className="connector-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="shell-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3d4f5f" />
            <stop offset="100%" stopColor="#2a3544" />
          </linearGradient>
        </defs>

        {/* Connector shell: dsub, singleRow, jack35mm (pill), or power3Triangle */}
        <g transform={`translate(${svgPadding + bounds.x}, ${svgPadding + bounds.y})`}>
          {shape === 'jack35mm' ? (
            <rect
              className="connector-shell"
              x={0}
              y={0}
              width={bounds.width}
              height={bounds.height}
              rx={bounds.height / 2}
              ry={bounds.height / 2}
              fill="url(#shell-gradient)"
              stroke="var(--border)"
              strokeWidth="2"
            />
          ) : shape === 'power3Triangle' && trianglePath ? (
            <path
              className="connector-shell"
              d={trianglePath}
              fill="url(#shell-gradient)"
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
              fill="url(#shell-gradient)"
              stroke="var(--border)"
              strokeWidth="2"
            />
          ) : (
            <path
              className="connector-shell"
              d={`M 0 4 L ${bounds.width} 4 L ${bounds.width - 8} ${bounds.height - 4} L 8 ${bounds.height - 4} Z`}
              fill="url(#shell-gradient)"
              stroke="var(--border)"
              strokeWidth="2"
            />
          )}
        </g>

        {/* Wires (behind pins) */}
        <g transform={`translate(${svgPadding}, ${svgPadding})`}>
          {positions.map(({ pinNumber, x, y }) => {
            const state = getPinState(pinNumber)
            const color = state?.color ?? '#6c757d'
            return (
              <line
                key={`wire-${pinNumber}`}
                className="pin-wire"
                x1={x}
                y1={y}
                x2={x + WIRE_LENGTH}
                y2={y}
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Pins: circle in a zoom wrapper so hover only zooms from pin center */}
        <g transform={`translate(${svgPadding}, ${svgPadding})`}>
          {positions.map(({ pinNumber, x, y }) => {
            const state = getPinState(pinNumber)
            const color = state?.color ?? '#6c757d'
            const isSelected = selectedPinNumber === pinNumber
            return (
              <g
                key={pinNumber}
                className="pin-group"
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectPin(pinNumber)}
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
                    filter={isSelected ? 'url(#pin-glow)' : undefined}
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
      </svg>

      {/* Pin labels in two rows matching connector layout */}
      <div className="connector-labels" style={{ width: width, maxWidth: '100%' }}>
        {[0, 1].map((row) => (
          <div key={row} className="pin-label-row">
            {positions
              .filter((p) => p.row === row)
              .map(({ pinNumber, x }) => {
                const state = getPinState(pinNumber)
                const label = state?.label ?? `Pin ${pinNumber}`
                return (
                  <div
                    key={pinNumber}
                    className="pin-label-item"
                    style={{
                      width: 72,
                      marginLeft: row === 0 ? 0 : 12,
                      color: state?.color ?? '#6c757d',
                    }}
                  >
                    <span className="pin-label-num">{pinNumber}</span>
                    <span className="pin-label-text" title={label}>{label}</span>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
