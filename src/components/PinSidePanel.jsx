import React, { useState, useEffect, useId, useMemo } from 'react'
import { COLOR_PRESETS } from '../connectors/config'
import './PinSidePanel.css'

const DEFAULT_COLOR = '#6c757d'

function PinSidePanelImpl({
  pinNumber,
  pinState,
  onUpdatePin,
  onResetPin,
  onClose,
  /** Cable mode: connectorIndex, other connectors + indices, link helpers */
  connectorIndex,
  otherConnectors,
  connectorIndices,
  linkedTo,
  onAddLink,
  onRemoveLink,
}) {
  // Pull out primitive fields so the sync effect only re-runs on actual value
  // changes (not on every parent rerender that creates a new pinState object).
  const externalLabel = pinState?.label ?? ''
  const externalColor = pinState?.color ?? DEFAULT_COLOR
  const externalPresetId = pinState?.presetId ?? 'unassigned'

  const [label, setLabel] = useState(externalLabel)
  const [color, setColor] = useState(externalColor)
  const [presetId, setPresetId] = useState(externalPresetId)

  // Sync external -> local only on actual primitive changes or when the selected
  // pin/connector context changes. This prevents in-progress edits from being
  // overwritten by an identical-valued rerender.
  useEffect(() => {
    setLabel(externalLabel)
    setColor(externalColor)
    setPresetId(externalPresetId)
  }, [pinNumber, connectorIndex, externalLabel, externalColor, externalPresetId])

  const applyPreset = (preset) => {
    setPresetId(preset.id)
    setColor(preset.color)
    setLabel(preset.label)
    onUpdatePin(pinNumber, { color: preset.color, presetId: preset.id, label: preset.label })
  }

  const handleLabelBlur = () => {
    const trimmed = label.trim() || `Pin ${pinNumber}`
    if (trimmed !== label) setLabel(trimmed)
    if (trimmed !== externalLabel) onUpdatePin(pinNumber, { label: trimmed })
  }

  const handleLabelKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setLabel(externalLabel)
      e.currentTarget.blur()
    }
  }

  const handleColorChange = (e) => {
    const value = e.target.value
    setColor(value)
    setPresetId('')
    onUpdatePin(pinNumber, { color: value, presetId: '' })
  }

  const handleHexBlur = () => {
    if (color !== externalColor) {
      onUpdatePin(pinNumber, { color, presetId: presetId || undefined })
    }
  }

  const handleReset = () => {
    onResetPin(pinNumber)
    onClose()
  }

  const labelId = useId()
  const colorId = useId()

  const pinTitle = useMemo(
    () => (connectorIndex != null ? `Connector ${connectorIndex + 1} — Pin ${pinNumber}` : `Pin ${pinNumber}`),
    [connectorIndex, pinNumber]
  )

  if (pinNumber == null) return null

  return (
    <div className="pin-side-panel">
      <div className="pin-side-panel-header">
        <h3 className="pin-side-panel-title">{pinTitle}</h3>
        <button type="button" className="pin-side-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="pin-side-panel-body">
        <div className="pin-side-panel-field">
          <label htmlFor={labelId}>Label</label>
          <input
            id={labelId}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            placeholder={`Pin ${pinNumber}`}
            className="pin-side-panel-input"
          />
        </div>

        <div className="pin-side-panel-field">
          <label>Wire color</label>
          <div className="pin-side-panel-presets">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`pin-preset-btn ${presetId === preset.id ? 'pin-preset-active' : ''}`}
                style={{ '--preset-color': preset.color }}
                onClick={() => applyPreset(preset)}
                title={preset.description}
                aria-pressed={presetId === preset.id}
                aria-label={`Apply preset ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pin-side-panel-field">
          <label htmlFor={colorId}>Custom color</label>
          <div className="pin-color-row">
            <input
              id={colorId}
              type="color"
              value={color}
              onChange={handleColorChange}
              className="pin-color-picker"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              onBlur={handleHexBlur}
              className="pin-color-hex"
              aria-label="Custom color hex value"
            />
          </div>
        </div>

        {connectorIndex != null && otherConnectors?.length > 0 && connectorIndices && (
          <div className="pin-side-panel-field pin-link-field">
            <label>Point-to-point link</label>
            {linkedTo != null ? (
              <div className="pin-link-status">
                <span className="pin-link-text">Linked to Connector {linkedTo.connectorIndex + 1} pin {linkedTo.pinNumber}</span>
                <button type="button" className="pin-btn pin-btn-unlink" onClick={() => onRemoveLink?.(connectorIndex, pinNumber)}>
                  Unlink
                </button>
              </div>
            ) : (
              <select
                className="pin-side-panel-input pin-link-select"
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) {
                    const [targetIdx, targetPin] = v.split(':').map(Number)
                    onAddLink?.(connectorIndex, pinNumber, targetIdx, targetPin)
                  }
                  e.target.value = ''
                }}
                aria-label="Link to pin on another connector"
              >
                <option value="">— Link to connector —</option>
                {connectorIndices.map((targetIdx, idx) => {
                  const other = otherConnectors[idx]
                  if (!other) return null
                  return (
                    <optgroup key={targetIdx} label={`Connector ${targetIdx + 1}`}>
                      {Array.from({ length: other.totalPins }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={`${targetIdx}:${n}`}>
                          Pin {n} {other.defaultLabels?.[n] ? `(${other.defaultLabels[n]})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            )}
          </div>
        )}

        <div className="pin-side-panel-actions">
          <button type="button" className="pin-btn pin-btn-secondary" onClick={handleReset}>
            Reset to default
          </button>
        </div>
      </div>
    </div>
  )
}

export const PinSidePanel = React.memo(PinSidePanelImpl)
