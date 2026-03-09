import React, { useState } from 'react'
import { useCableAssemblyState } from './hooks/useCableAssemblyState'
import { CONNECTOR_GROUPS } from './connectors/config'
import { ConnectorView } from './components/ConnectorView'
import { CableAssemblyView } from './components/CableAssemblyView'
import { PinSidePanel } from './components/PinSidePanel'
import './App.css'

export default function App() {
  const {
    connectorTypeId,
    setConnectorTypeId,
    connector,
    connectorTypes,
    getPinState,
    updatePin,
    resetPin,
    resetAllPins,
    selectedPinNumber,
    setSelectedPinNumber,
    isHydrated,
    savedConfigs,
    saveAsConfig,
    loadConfig,
    deleteConfig,
    exportToFile,
    importFromFile,
    cableConnectors,
    cableConnectorTypes,
    getConnector,
    getPinStateAt,
    updatePinAt,
    setConnectorTypeAt,
    addConnector,
    removeConnector,
    pinLinks,
    addLink,
    removeLink,
    getLinkedPin,
    selectedCablePin,
    setSelectedCablePin,
    resetAllPinsAt,
    resetPinAt,
  } = useCableAssemblyState()

  const [mode, setMode] = useState('single')
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)
  const [importError, setImportError] = useState(null)
  const fileInputRef = React.useRef(null)

  const isCableMode = mode === 'cable'
  const selectedPin = isCableMode ? selectedCablePin : selectedPinNumber

  const cableConnectorsList = [connector, ...cableConnectorTypes.filter(Boolean)]

  const selectedPinState =
    selectedPin != null
      ? typeof selectedPin === 'object'
        ? getPinStateAt(selectedPin.connectorIndex, selectedPin.pinNumber)
        : getPinState(selectedPin)
      : null

  const handleSaveAs = () => {
    if (saveName.trim()) {
      saveAsConfig(saveName.trim())
      setSaveName('')
      setShowSaveInput(false)
    }
  }

  const handleLoadSelect = (e) => {
    const id = e.target.value
    if (id) {
      loadConfig(id)
      e.target.value = ''
    }
  }

  const handleUploadClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    importFromFile(file)
      .then(() => setImportError(null))
      .catch((err) => setImportError(err?.message || 'Failed to import file'))
    e.target.value = ''
  }

  const handleResetAllCable = () => {
    cableConnectorsList.forEach((_, i) => resetAllPinsAt(i))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">LoomCraft</h1>
        <p className="app-subtitle">
          {isCableMode ? 'Link pins between connectors — add as many as you need' : 'Click a pin to edit its label and wire color'}
        </p>
        <div className="app-toolbar">
          <div className="mode-toggle-wrap">
            <button
              type="button"
              className={`mode-toggle-btn ${!isCableMode ? 'mode-toggle-active' : ''}`}
              onClick={() => { setMode('single'); setSelectedCablePin(null); }}
            >
              Single connector
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${isCableMode ? 'mode-toggle-active' : ''}`}
              onClick={() => { setMode('cable'); setSelectedPinNumber(null); }}
            >
              Cable assembly
            </button>
          </div>

          {isCableMode ? (
            <div className="cable-connectors-wrap">
              {cableConnectorsList.map((conn, i) => (
                <div key={i} className="connector-select-wrap cable-connector-item">
                  <label htmlFor={`connector-${i}`}>Connector {i + 1}</label>
                  <div className="connector-select-row">
                    <select
                      id={`connector-${i}`}
                      value={i === 0 ? connectorTypeId : cableConnectors[i - 1]?.connectorTypeId}
                      onChange={(e) => {
                        setConnectorTypeAt(i, e.target.value)
                        setSelectedCablePin(null)
                      }}
                      className="connector-select"
                    >
                      {CONNECTOR_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.ids.map((id) => {
                            const c = connectorTypes[id]
                            if (!c) return null
                            return (
                              <option key={id} value={id}>
                                {c.name}
                              </option>
                            )
                          })}
                        </optgroup>
                      ))}
                    </select>
                    {cableConnectorsList.length > 1 && i > 0 && (
                      <button
                        type="button"
                        className="btn-remove-connector"
                        onClick={() => removeConnector(i)}
                        title="Remove connector"
                        aria-label={`Remove connector ${i + 1}`}
                      >
                        −
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-add-connector"
                onClick={addConnector}
                title="Add connector"
              >
                + Add connector
              </button>
            </div>
          ) : (
            <div className="connector-select-wrap">
              <label htmlFor="connector-type">Connector</label>
              <select
                id="connector-type"
                value={connectorTypeId}
                onChange={(e) => {
                  setConnectorTypeId(e.target.value)
                  setSelectedPinNumber(null)
                }}
                className="connector-select"
              >
                {CONNECTOR_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.ids.map((id) => {
                      const c = connectorTypes[id]
                      if (!c) return null
                      return (
                        <option key={id} value={id}>
                          {c.name}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <button type="button" className="btn-reset-all" onClick={isCableMode ? handleResetAllCable : resetAllPins}>
            Reset all pins
          </button>

          <div className="save-load-wrap">
            {showSaveInput ? (
              <span className="save-as-inline">
                <input
                  type="text"
                  placeholder="Configuration name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
                  className="save-as-input"
                  autoFocus
                />
                <button type="button" className="btn-save-as" onClick={handleSaveAs}>
                  Save
                </button>
                <button type="button" className="btn-cancel" onClick={() => { setShowSaveInput(false); setSaveName('') }}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className="btn-save-as-toggle" onClick={() => setShowSaveInput(true)}>
                Save as…
              </button>
            )}

            <div className="load-saved-wrap">
              <select
                className="load-saved-select"
                value=""
                onChange={handleLoadSelect}
                aria-label="Load saved configuration"
              >
                <option value="">— Load saved —</option>
                {savedConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.connectorTypeId})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-manage-saved"
                onClick={() => setShowSavedList((v) => !v)}
                title="Manage saved configurations"
              >
                ⋮
              </button>
            </div>

            <span className="import-export-divider" aria-hidden>|</span>
            <div className="import-export-wrap">
              <button type="button" className="btn-export-json" onClick={exportToFile} title="Download configuration as JSON file">
                Download JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="file-input-hidden"
                aria-hidden
              />
              <button type="button" className="btn-import-json" onClick={handleUploadClick} title="Upload a previously exported JSON file">
                Upload JSON
              </button>
            </div>
          </div>
        </div>
        {importError && (
          <p className="import-error" role="alert">
            {importError}
          </p>
        )}

        {showSavedList && (
          <div className="saved-list-panel">
            <div className="saved-list-header">
              <span>Saved configurations</span>
              <button type="button" className="btn-close-panel" onClick={() => setShowSavedList(false)} aria-label="Close">×</button>
            </div>
            {savedConfigs.length === 0 ? (
              <p className="saved-list-empty">No saved configurations. Use &quot;Save as…&quot; to save the current pin setup.</p>
            ) : (
              <ul className="saved-list">
                {savedConfigs.map((c) => (
                  <li key={c.id} className="saved-list-item">
                    <span className="saved-list-name">{c.name}</span>
                    <span className="saved-list-connector">{c.connectorTypeId}</span>
                    <button type="button" className="btn-load-config" onClick={() => { loadConfig(c.id); setShowSavedList(false); }}>Load</button>
                    <button type="button" className="btn-delete-config" onClick={() => deleteConfig(c.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      <main className="app-main">
        <div className="app-canvas">
          {isHydrated && isCableMode && cableConnectorsList.some(Boolean) ? (
            <CableAssemblyView
              connectors={cableConnectorsList}
              getPinStateAt={getPinStateAt}
              pinLinks={pinLinks}
              selectedPin={selectedCablePin}
              onSelectPin={(connectorIndex, pinNumber) => setSelectedCablePin({ connectorIndex, pinNumber })}
            />
          ) : isHydrated ? (
            <ConnectorView
              connector={connector}
              getPinState={getPinState}
              selectedPinNumber={selectedPinNumber}
              onSelectPin={setSelectedPinNumber}
            />
          ) : null}
        </div>

        {selectedPin != null && (
          <PinSidePanel
            pinNumber={typeof selectedPin === 'object' ? selectedPin.pinNumber : selectedPin}
            pinState={selectedPinState}
            onUpdatePin={typeof selectedPin === 'object' ? (_pinNum, updates) => updatePinAt(selectedPin.connectorIndex, selectedPin.pinNumber, updates) : updatePin}
            onResetPin={typeof selectedPin === 'object' ? () => resetPinAt(selectedPin.connectorIndex, selectedPin.pinNumber) : resetPin}
            onClose={() => (isCableMode ? setSelectedCablePin(null) : setSelectedPinNumber(null))}
            connectorIndex={typeof selectedPin === 'object' ? selectedPin.connectorIndex : null}
            otherConnectors={typeof selectedPin === 'object' ? cableConnectorsList.filter((_, i) => i !== selectedPin.connectorIndex) : null}
            connectorIndices={typeof selectedPin === 'object' ? cableConnectorsList.map((_, i) => i).filter((i) => i !== selectedPin.connectorIndex) : null}
            linkedTo={typeof selectedPin === 'object' ? getLinkedPin(selectedPin.connectorIndex, selectedPin.pinNumber) : null}
            onAddLink={addLink}
            onRemoveLink={removeLink}
          />
        )}
      </main>
    </div>
  )
}
