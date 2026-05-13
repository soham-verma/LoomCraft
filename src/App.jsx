import React, { useState, useMemo, useCallback } from 'react'
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
    storageError,
    clearStorageError,
  } = useCableAssemblyState()

  const [mode, setMode] = useState('single')
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)
  const [importError, setImportError] = useState(null)
  const fileInputRef = React.useRef(null)

  const isCableMode = mode === 'cable'
  const selectedPin = isCableMode ? selectedCablePin : selectedPinNumber

  // Build the cable list once, preserving indices (no filter that could skew links).
  // Connector 0 is the base; entries 1..N come from `cableConnectorTypes` and may be null
  // if a connector type is unknown (renderers handle null gracefully).
  const cableConnectorsList = useMemo(
    () => [connector, ...cableConnectorTypes],
    [connector, cableConnectorTypes]
  )

  const selectedPinState = useMemo(() => {
    if (selectedPin == null) return null
    if (typeof selectedPin === 'object') {
      return getPinStateAt(selectedPin.connectorIndex, selectedPin.pinNumber)
    }
    return getPinState(selectedPin)
  }, [selectedPin, getPinStateAt, getPinState])

  const otherConnectorsForPanel = useMemo(() => {
    if (!selectedPin || typeof selectedPin !== 'object') return null
    return cableConnectorsList.filter((_, i) => i !== selectedPin.connectorIndex)
  }, [cableConnectorsList, selectedPin])

  const otherConnectorIndices = useMemo(() => {
    if (!selectedPin || typeof selectedPin !== 'object') return null
    return cableConnectorsList.map((_, i) => i).filter((i) => i !== selectedPin.connectorIndex)
  }, [cableConnectorsList, selectedPin])

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

  const handleSelectCablePin = useCallback(
    (connectorIndex, pinNumber) => setSelectedCablePin({ connectorIndex, pinNumber }),
    [setSelectedCablePin]
  )

  const handleUpdateSelectedPin = useCallback(
    (_pinNum, updates) => {
      if (typeof selectedPin === 'object' && selectedPin) {
        updatePinAt(selectedPin.connectorIndex, selectedPin.pinNumber, updates)
      } else if (selectedPin != null) {
        updatePin(selectedPin, updates)
      }
    },
    [selectedPin, updatePinAt, updatePin]
  )

  const handleResetSelectedPin = useCallback(() => {
    if (typeof selectedPin === 'object' && selectedPin) {
      resetPinAt(selectedPin.connectorIndex, selectedPin.pinNumber)
    } else if (selectedPin != null) {
      resetPin(selectedPin)
    }
  }, [selectedPin, resetPinAt, resetPin])

  const closePanel = useCallback(
    () => (isCableMode ? setSelectedCablePin(null) : setSelectedPinNumber(null)),
    [isCableMode, setSelectedCablePin, setSelectedPinNumber]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">LoomCraft</h1>
        <p className="app-subtitle">
          {isCableMode ? 'Link pins between connectors — add as many as you need' : 'Click a pin to edit its label and wire color'}
        </p>
        <div className="app-toolbar">
          <div className="mode-toggle-wrap" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={!isCableMode}
              aria-pressed={!isCableMode}
              className={`mode-toggle-btn ${!isCableMode ? 'mode-toggle-active' : ''}`}
              onClick={() => { setMode('single'); setSelectedCablePin(null); }}
            >
              Single connector
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isCableMode}
              aria-pressed={isCableMode}
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
                      value={i === 0 ? connectorTypeId : (cableConnectors[i - 1]?.connectorTypeId ?? '')}
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
                  {!conn && (
                    <span className="connector-error" role="alert">Unknown connector type</span>
                  )}
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
                  aria-label="Configuration name"
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
                aria-label="Manage saved configurations"
                aria-expanded={showSavedList}
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
                tabIndex={-1}
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
        {storageError && (
          <p className="storage-error" role="alert">
            {storageError}
            <button type="button" className="storage-error-dismiss" onClick={clearStorageError} aria-label="Dismiss storage error">
              ×
            </button>
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
          {!isHydrated ? (
            <div className="app-loading" role="status" aria-live="polite">
              <p>Loading connector…</p>
            </div>
          ) : isCableMode ? (
            cableConnectorsList.some(Boolean) ? (
              <CableAssemblyView
                connectors={cableConnectorsList}
                getPinStateAt={getPinStateAt}
                pinLinks={pinLinks}
                selectedPin={selectedCablePin}
                onSelectPin={handleSelectCablePin}
              />
            ) : (
              <div className="app-empty" role="status">
                <p>No connectors in this assembly. Add one to get started.</p>
              </div>
            )
          ) : (
            <ConnectorView
              connector={connector}
              getPinState={getPinState}
              selectedPinNumber={selectedPinNumber}
              onSelectPin={setSelectedPinNumber}
            />
          )}
        </div>

        {selectedPin != null && (
          <PinSidePanel
            pinNumber={typeof selectedPin === 'object' ? selectedPin.pinNumber : selectedPin}
            pinState={selectedPinState}
            onUpdatePin={handleUpdateSelectedPin}
            onResetPin={handleResetSelectedPin}
            onClose={closePanel}
            connectorIndex={typeof selectedPin === 'object' ? selectedPin.connectorIndex : null}
            otherConnectors={otherConnectorsForPanel}
            connectorIndices={otherConnectorIndices}
            linkedTo={typeof selectedPin === 'object' ? getLinkedPin(selectedPin.connectorIndex, selectedPin.pinNumber) : null}
            onAddLink={addLink}
            onRemoveLink={removeLink}
          />
        )}
      </main>
    </div>
  )
}
