import React, { useState, useEffect } from 'react'
import { COLOR_PRESETS } from '../connectors/config'
import './PinSidePanel.css'

export function PinSidePanel({
  pinNumber,
  pinState,
  onUpdatePin,
  onResetPin,
  onClose,
}) {
  const [label, setLabel] = useState(pinState?.label ?? '')
  const [color, setColor] = useState(pinState?.color ?? '#6c757d')
  const [presetId, setPresetId] = useState(pinState?.presetId ?? 'unassigned')

  useEffect(() => {
    setLabel(pinState?.label ?? '')
    setColor(pinState?.color ?? '#6c757d')
    setPresetId(pinState?.presetId ?? 'unassigned')
  }, [pinNumber, pinState])

  const applyPreset = (preset) => {
    setPresetId(preset.id)
    setColor(preset.color)
    onUpdatePin(pinNumber, { color: preset.color, presetId: preset.id })
  }

  const handleLabelBlur = () => {
    const trimmed = label.trim() || `Pin ${pinNumber}`
    setLabel(trimmed)
    onUpdatePin(pinNumber, { label: trimmed })
  }

  const handleColorChange = (e) => {
    const value = e.target.value
    setColor(value)
    setPresetId('')
    onUpdatePin(pinNumber, { color: value, presetId: '' })
  }

  const handleReset = () => {
    onResetPin(pinNumber)
    onClose()
  }

  if (pinNumber == null) return null

  return (
    <div className="pin-side-panel">
      <div className="pin-side-panel-header">
        <h3 className="pin-side-panel-title">Pin {pinNumber}</h3>
        <button type="button" className="pin-side-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="pin-side-panel-body">
        <div className="pin-side-panel-field">
          <label htmlFor="pin-label">Label</label>
          <input
            id="pin-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
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
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pin-side-panel-field">
          <label htmlFor="pin-color">Custom color</label>
          <div className="pin-color-row">
            <input
              id="pin-color"
              type="color"
              value={color}
              onChange={handleColorChange}
              className="pin-color-picker"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              onBlur={() => onUpdatePin(pinNumber, { color, presetId: presetId || undefined })}
              className="pin-color-hex"
            />
          </div>
        </div>

        <div className="pin-side-panel-actions">
          <button type="button" className="pin-btn pin-btn-secondary" onClick={handleReset}>
            Reset to default
          </button>
        </div>
      </div>
    </div>
  )
}
