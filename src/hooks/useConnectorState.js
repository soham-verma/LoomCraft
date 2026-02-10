import { useState, useEffect, useCallback } from 'react'
import { CONNECTOR_TYPES, DEFAULT_PRESET_ID, COLOR_PRESETS } from '../connectors/config'

const STORAGE_KEY = 'connector-pin-tool'

function getDefaultPinState(connector) {
  const preset = COLOR_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) || COLOR_PRESETS[0]
  return Object.fromEntries(
    Array.from({ length: connector.totalPins }, (_, i) => {
      const pinNumber = i + 1
      const label = connector.defaultLabels[pinNumber] ?? `Pin ${pinNumber}`
      return [pinNumber, { label, color: preset.color, presetId: DEFAULT_PRESET_ID }]
    })
  )
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

function saveState(connectorTypeId, pinOverrides) {
  try {
    const data = loadStorage()
    const all = data.connectors ?? {}
    all[connectorTypeId] = { pinOverrides }
    data.connectors = all
    data.lastConnector = connectorTypeId
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

function persistSavedConfigs(configs) {
  try {
    const data = loadStorage()
    data.savedConfigs = configs
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

const EXPORT_VERSION = 1

function buildExportData() {
  const data = loadStorage()
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    connectors: data.connectors ?? {},
    savedConfigs: Array.isArray(data.savedConfigs) ? data.savedConfigs : [],
    lastConnector: data.lastConnector ?? 'DB25',
  }
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

  const connector = CONNECTOR_TYPES[connectorTypeId]
  const isHydrated = connector != null

  // Initialize or switch connector: merge saved overrides with defaults for this connector
  useEffect(() => {
    if (!connector) return
    const allSaved = loadAllState()
    const saved = allSaved[connectorTypeId]
    const base = getDefaultPinState(connector)
    if (saved && saved.pinOverrides) {
      setPinOverrides((prev) => {
        const next = { ...base }
        Object.entries(saved.pinOverrides).forEach(([key, value]) => {
          const num = parseInt(key, 10)
          if (num >= 1 && num <= connector.totalPins && value && typeof value === 'object') {
            next[num] = { ...base[num], ...value }
          }
        })
        return next
      })
    } else {
      setPinOverrides(base)
    }
  }, [connectorTypeId])

  // Persist on change
  useEffect(() => {
    if (!connector || Object.keys(pinOverrides).length === 0) return
    saveState(connectorTypeId, pinOverrides)
  }, [connectorTypeId, pinOverrides])

  const getPinState = useCallback(
    (pinNumber) => {
      if (pinOverrides[pinNumber]) return pinOverrides[pinNumber]
      const def = getDefaultPinState(connector)
      return def[pinNumber] ?? { label: `Pin ${pinNumber}`, color: '#6c757d', presetId: DEFAULT_PRESET_ID }
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
      const def = getDefaultPinState(connector)[pinNumber]
      setPinOverrides((prev) => ({ ...prev, [pinNumber]: def }))
    },
    [connector]
  )

  const resetAllPins = useCallback(() => {
    setPinOverrides(getDefaultPinState(connector))
  }, [connector])

  const [savedConfigs, setSavedConfigs] = useState([])
  useEffect(() => {
    setSavedConfigs(loadSavedConfigs())
  }, []) // load once on mount; will refresh after save/delete

  const refreshSavedConfigs = useCallback(() => {
    setSavedConfigs(loadSavedConfigs())
  }, [])

  const saveAsConfig = useCallback(
    (name) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return
      const configs = loadSavedConfigs()
      const newConfig = {
        id: crypto.randomUUID?.() ?? `saved-${Date.now()}`,
        name: trimmed,
        connectorTypeId,
        pinOverrides: { ...pinOverrides },
      }
      configs.push(newConfig)
      persistSavedConfigs(configs)
      setSavedConfigs(configs)
    },
    [connectorTypeId, pinOverrides]
  )

  const loadConfig = useCallback((id) => {
    const configs = loadSavedConfigs()
    const config = configs.find((c) => c.id === id)
    if (!config?.pinOverrides) return
    saveState(config.connectorTypeId, config.pinOverrides)
    setConnectorTypeId(config.connectorTypeId)
    setPinOverrides(config.pinOverrides)
    setSelectedPinNumber(null)
  }, [])

  const deleteConfig = useCallback((id) => {
    const configs = loadSavedConfigs().filter((c) => c.id !== id)
    persistSavedConfigs(configs)
    setSavedConfigs(configs)
  }, [])

  const exportToFile = useCallback(() => {
    const data = buildExportData()
    const filename = `connector-pin-config-${new Date().toISOString().slice(0, 10)}.json`
    downloadJson(data, filename)
  }, [])

  const importFromFile = useCallback((file) => {
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
          const savedConfigs = Array.isArray(data.savedConfigs) ? data.savedConfigs : []
          const lastConnector = CONNECTOR_TYPES[data.lastConnector] ? data.lastConnector : 'DB25'
          const toStore = {
            connectors,
            savedConfigs,
            lastConnector,
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
          setSavedConfigs(savedConfigs)
          setConnectorTypeId(lastConnector)
          const current = connectors[lastConnector]?.pinOverrides
          if (current && typeof current === 'object') {
            setPinOverrides(current)
          } else {
            setPinOverrides(getDefaultPinState(CONNECTOR_TYPES[lastConnector]))
          }
          setSelectedPinNumber(null)
          resolve()
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file, 'UTF-8')
    })
  }, [])

  return {
    connectorTypeId,
    setConnectorTypeId,
    connector,
    connectorTypes: CONNECTOR_TYPES,
    pinOverrides,
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
  }
}
