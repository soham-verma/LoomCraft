import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { CONNECTOR_TYPES, DEFAULT_PRESET_ID, COLOR_PRESETS } from '../connectors/config'

const STORAGE_KEY = 'connector-pin-tool'
const PERSIST_DEBOUNCE_MS = 200

const DEFAULT_PRESET = COLOR_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) || COLOR_PRESETS[0]
const DEFAULT_COLOR = DEFAULT_PRESET?.color ?? '#6c757d'

/** Build the full default pin map for a connector. Only call when needed (init / reset / load). */
function getDefaultPinState(connector) {
  return Object.fromEntries(
    Array.from({ length: connector.totalPins }, (_, i) => {
      const pinNumber = i + 1
      const label = connector.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
      return [pinNumber, { label, color: DEFAULT_COLOR, presetId: DEFAULT_PRESET_ID }]
    })
  )
}

/** Cheap single-pin default — avoids allocating the full pin map per render. */
function getSinglePinDefault(connector, pinNumber) {
  const label = connector?.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
  return { label, color: DEFAULT_COLOR, presetId: DEFAULT_PRESET_ID }
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function loadAllState() {
  const data = loadStorage()
  return data.connectors ?? {}
}

function loadSavedConfigs() {
  const data = loadStorage()
  return Array.isArray(data.savedConfigs) ? data.savedConfigs : []
}

/** Persist into the shared storage blob. Returns Error or null. */
function writeStorage(updater) {
  try {
    const data = loadStorage()
    const next = updater(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return null
  } catch (err) {
    return err instanceof Error ? err : new Error('Storage write failed')
  }
}

const EXPORT_VERSION = 2

function buildExportData(extras) {
  const data = loadStorage()
  const base = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    connectors: data.connectors ?? {},
    savedConfigs: Array.isArray(data.savedConfigs) ? data.savedConfigs : [],
    lastConnector: data.lastConnector ?? 'DB25',
  }
  if (extras && typeof extras === 'object') {
    return { ...base, ...extras }
  }
  return base
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function useConnectorState() {
  const [connectorTypeId, setConnectorTypeId] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const data = raw ? JSON.parse(raw) : {}
      return data.lastConnector && CONNECTOR_TYPES[data.lastConnector] ? data.lastConnector : 'DB25'
    } catch {
      return 'DB25'
    }
  })
  const [pinOverrides, setPinOverrides] = useState({})
  const [selectedPinNumber, setSelectedPinNumber] = useState(null)
  const [storageError, setStorageError] = useState(null)
  /** Bumped by applyConnectorConfig to force the init effect to re-run for the same connector type. */
  const [reloadToken, setReloadToken] = useState(0)
  /** When set during a config load, the init effect uses these overrides instead of reading storage. */
  const pendingOverridesRef = useRef(null)

  const connector = CONNECTOR_TYPES[connectorTypeId]
  const isHydrated = connector != null

  // Initialize or switch connector: merge saved overrides with defaults for this connector.
  useEffect(() => {
    if (!connector) return
    const base = getDefaultPinState(connector)
    const pending = pendingOverridesRef.current
    pendingOverridesRef.current = null
    const source = pending ?? loadAllState()[connectorTypeId]?.pinOverrides
    if (source && typeof source === 'object') {
      const next = { ...base }
      Object.entries(source).forEach(([key, value]) => {
        const num = parseInt(key, 10)
        if (num >= 1 && num <= connector.totalPins && value && typeof value === 'object') {
          next[num] = { ...base[num], ...value }
        }
      })
      setPinOverrides(next)
    } else {
      setPinOverrides(base)
    }
    // reloadToken intentionally included so external "load same connector" forces re-init
  }, [connectorTypeId, connector, reloadToken])

  // Persist on change (debounced to coalesce rapid edits and reduce JSON.stringify pressure).
  useEffect(() => {
    if (!connector || Object.keys(pinOverrides).length === 0) return
    const handle = setTimeout(() => {
      const err = writeStorage((data) => {
        const all = data.connectors ?? {}
        all[connectorTypeId] = { pinOverrides }
        return { ...data, connectors: all, lastConnector: connectorTypeId }
      })
      if (err) setStorageError(err.message || 'Failed to save')
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [connectorTypeId, pinOverrides, connector])

  const getPinState = useCallback(
    (pinNumber) => {
      if (pinOverrides[pinNumber]) return pinOverrides[pinNumber]
      return getSinglePinDefault(connector, pinNumber)
    },
    [connector, pinOverrides]
  )

  const updatePin = useCallback((pinNumber, updates) => {
    setPinOverrides((prev) => ({
      ...prev,
      [pinNumber]: { ...prev[pinNumber], ...updates },
    }))
  }, [])

  const resetPin = useCallback(
    (pinNumber) => {
      setPinOverrides((prev) => ({
        ...prev,
        [pinNumber]: getSinglePinDefault(connector, pinNumber),
      }))
    },
    [connector]
  )

  const resetAllPins = useCallback(() => {
    if (!connector) return
    setPinOverrides(getDefaultPinState(connector))
  }, [connector])

  const [savedConfigs, setSavedConfigs] = useState([])
  useEffect(() => {
    setSavedConfigs(loadSavedConfigs())
  }, [])

  const refreshSavedConfigs = useCallback(() => {
    setSavedConfigs(loadSavedConfigs())
  }, [])

  /**
   * Apply a saved single-connector config (type + pin overrides) immediately.
   * Works correctly even when the connector type is the same as the current one,
   * because `reloadToken` is bumped to force the init effect to re-run.
   */
  const applyConnectorConfig = useCallback(({ connectorTypeId: nextId, pinOverrides: nextOverrides }) => {
    if (!nextId || !CONNECTOR_TYPES[nextId]) return
    pendingOverridesRef.current = nextOverrides && typeof nextOverrides === 'object' ? nextOverrides : null
    if (nextId === connectorTypeId) {
      setReloadToken((t) => t + 1)
    } else {
      setConnectorTypeId(nextId)
    }
    setSelectedPinNumber(null)
  }, [connectorTypeId])

  const saveAsConfig = useCallback(
    (name, extras) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return null
      const configs = loadSavedConfigs()
      const newConfig = {
        id: crypto.randomUUID?.() ?? `saved-${Date.now()}`,
        name: trimmed,
        connectorTypeId,
        pinOverrides: { ...pinOverrides },
        ...(extras && typeof extras === 'object' ? extras : {}),
      }
      configs.push(newConfig)
      const err = writeStorage((data) => ({ ...data, savedConfigs: configs }))
      if (err) {
        setStorageError(err.message || 'Failed to save configuration')
        return null
      }
      setSavedConfigs(configs)
      return newConfig
    },
    [connectorTypeId, pinOverrides]
  )

  const loadConfig = useCallback(
    (id) => {
      const configs = loadSavedConfigs()
      const config = configs.find((c) => c.id === id)
      if (!config?.connectorTypeId) return null
      applyConnectorConfig({
        connectorTypeId: config.connectorTypeId,
        pinOverrides: config.pinOverrides ?? {},
      })
      return config
    },
    [applyConnectorConfig]
  )

  const deleteConfig = useCallback((id) => {
    const configs = loadSavedConfigs().filter((c) => c.id !== id)
    const err = writeStorage((data) => ({ ...data, savedConfigs: configs }))
    if (err) {
      setStorageError(err.message || 'Failed to delete configuration')
      return
    }
    setSavedConfigs(configs)
  }, [])

  const exportToFile = useCallback((extras) => {
    const data = buildExportData(extras)
    const filename = `connector-pin-config-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(data, filename)
  }, [])

  /**
   * Import a JSON file.
   * The optional `applyExtras` callback receives the parsed object so callers
   * can hydrate additional state (e.g., cable assembly) atomically.
   */
  const importFromFile = useCallback((file, applyExtras) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = reader.result
          const data = typeof raw !== 'string' ? {} : JSON.parse(raw)
          if (!data || typeof data !== 'object') {
            reject(new Error('Invalid JSON'))
            return
          }
          const connectors = data.connectors && typeof data.connectors === 'object' ? data.connectors : {}
          const incomingSaved = Array.isArray(data.savedConfigs) ? data.savedConfigs : []
          const lastConnector = CONNECTOR_TYPES[data.lastConnector] ? data.lastConnector : 'DB25'
          const toStore = {
            connectors,
            savedConfigs: incomingSaved,
            lastConnector,
          }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
          } catch (writeErr) {
            const message = writeErr?.message || 'Failed to write to storage (quota?)'
            setStorageError(message)
            reject(new Error(message))
            return
          }
          setSavedConfigs(incomingSaved)
          const current = connectors[lastConnector]?.pinOverrides
          applyConnectorConfig({
            connectorTypeId: lastConnector,
            pinOverrides: current && typeof current === 'object' ? current : null,
          })
          if (typeof applyExtras === 'function') {
            try {
              applyExtras(data)
            } catch (extraErr) {
              reject(extraErr)
              return
            }
          }
          resolve(data)
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file, 'UTF-8')
    })
  }, [applyConnectorConfig])

  const clearStorageError = useCallback(() => setStorageError(null), [])

  const connectorTypes = useMemo(() => CONNECTOR_TYPES, [])

  return {
    connectorTypeId,
    setConnectorTypeId,
    connector,
    connectorTypes,
    pinOverrides,
    setPinOverrides,
    applyConnectorConfig,
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
    refreshSavedConfigs,
    exportToFile,
    importFromFile,
    storageError,
    clearStorageError,
  }
}
