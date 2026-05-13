import { useState, useEffect, useCallback, useMemo } from 'react'
import { useConnectorState } from './useConnectorState'
import { CONNECTOR_TYPES, DB25_HYP_SEED_CONFIG } from '../connectors/config'

const CABLE_STORAGE_KEY = 'connector-cable-assembly'
const STORAGE_KEY = 'connector-pin-tool'
const PERSIST_DEBOUNCE_MS = 200

function loadMainStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function loadSavedConfigs() {
  const data = loadMainStorage()
  return Array.isArray(data.savedConfigs) ? data.savedConfigs : []
}

function persistSavedConfigs(configs) {
  try {
    const data = loadMainStorage()
    data.savedConfigs = configs
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return null
  } catch (err) {
    return err instanceof Error ? err : new Error('Storage write failed')
  }
}

let db25HypSeeded = false
function seedDb25HypConfigIfNeeded() {
  if (db25HypSeeded) return
  db25HypSeeded = true
  const configs = loadSavedConfigs()
  if (configs.some((c) => c.id === DB25_HYP_SEED_CONFIG.id || c.name === DB25_HYP_SEED_CONFIG.name)) return
  configs.unshift(DB25_HYP_SEED_CONFIG)
  persistSavedConfigs(configs)
}

function loadCableState() {
  try {
    const raw = localStorage.getItem(CABLE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveCableState(state) {
  try {
    localStorage.setItem(CABLE_STORAGE_KEY, JSON.stringify(state))
    return null
  } catch (err) {
    return err instanceof Error ? err : new Error('Storage write failed')
  }
}

function getDefaultPinOverrides(connector) {
  return Object.fromEntries(
    Array.from({ length: connector.totalPins }, (_, i) => {
      const pinNumber = i + 1
      const label = connector.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
      return [pinNumber, { label, color: '#6c757d', presetId: 'unassigned' }]
    })
  )
}

/**
 * Migrate legacy A:/B: pinLinks (and stray non-string values) to the canonical
 * "ci:pn" -> "cj:pn2" string-pair format.
 */
function migratePinLinks(links) {
  if (!links || typeof links !== 'object') return {}
  const next = {}
  Object.entries(links).forEach(([key, value]) => {
    const k = key.replace(/^A:/, '0:').replace(/^B:/, '1:')
    if (typeof value === 'number') {
      const targetSide = key.startsWith('A:') ? '1' : key.startsWith('B:') ? '0' : null
      if (targetSide == null) return
      const targetKey = `${targetSide}:${value}`
      next[k] = targetKey
      next[targetKey] = k
    } else if (typeof value === 'string' && value.includes(':')) {
      next[k] = value
      next[value] = k
    }
  })
  return next
}

function sanitizeCableConnectors(arr) {
  if (!Array.isArray(arr)) return null
  return arr.map((c) => ({
    connectorTypeId: c?.connectorTypeId && CONNECTOR_TYPES[c.connectorTypeId] ? c.connectorTypeId : 'DB9',
    pinOverrides: c?.pinOverrides && typeof c.pinOverrides === 'object' ? c.pinOverrides : {},
  }))
}

/**
 * Drop any links that reference an out-of-bounds connector index, an unknown
 * connector type, or a pin number outside the connector's range. Also drops
 * self-links and asymmetric pairs.
 */
function sanitizeLinks(links, baseConnectorTypeId, cableConnectors) {
  if (!links || typeof links !== 'object') return {}
  const totals = []
  const baseConn = baseConnectorTypeId ? CONNECTOR_TYPES[baseConnectorTypeId] : null
  totals.push(baseConn?.totalPins ?? 0)
  for (const c of cableConnectors) {
    const conn = c?.connectorTypeId ? CONNECTOR_TYPES[c.connectorTypeId] : null
    totals.push(conn?.totalPins ?? 0)
  }
  const isValid = (ci, pn) => Number.isFinite(ci) && ci >= 0 && ci < totals.length && pn >= 1 && pn <= totals[ci]

  const next = {}
  Object.entries(links).forEach(([k, v]) => {
    if (typeof k !== 'string' || typeof v !== 'string' || !v.includes(':')) return
    const [ci, pn] = k.split(':').map(Number)
    const [cj, pn2] = v.split(':').map(Number)
    if (!isValid(ci, pn) || !isValid(cj, pn2)) return
    if (ci === cj && pn === pn2) return
    next[k] = v
  })
  // Ensure bidirectional consistency: every link points back to itself.
  Object.entries({ ...next }).forEach(([k, v]) => {
    if (next[v] !== k) next[v] = k
  })
  return next
}

/**
 * Extends useConnectorState to support cable assembly mode: N connectors
 * with pin-to-pin links for point-to-point cable assemblies.
 */
export function useCableAssemblyState() {
  seedDb25HypConfigIfNeeded()
  const base = useConnectorState()
  // Destructure stable callback identities so we don't put the whole `base`
  // object (a fresh reference each render) into other useCallback deps.
  const {
    setConnectorTypeId,
    applyConnectorConfig,
    refreshSavedConfigs,
    connector: baseConnector,
    saveAsConfig: baseSaveAsConfig,
    loadConfig: baseLoadConfig,
    exportToFile: baseExportToFile,
    importFromFile: baseImportFromFile,
    getPinState: baseGetPinState,
    updatePin: baseUpdatePin,
    resetPin: baseResetPin,
    resetAllPins: baseResetAllPins,
    storageError: baseStorageError,
    clearStorageError,
  } = base

  const [cableConnectors, setCableConnectors] = useState(() => {
    const saved = loadCableState()
    const sanitized = sanitizeCableConnectors(saved.connectors)
    if (sanitized && sanitized.length >= 1) return sanitized
    if (saved.connectorTypeIdB && CONNECTOR_TYPES[saved.connectorTypeIdB]) {
      const overrides = saved.connectorB?.[saved.connectorTypeIdB]?.pinOverrides
      return [{
        connectorTypeId: saved.connectorTypeIdB,
        pinOverrides: overrides && typeof overrides === 'object' ? overrides : {},
      }]
    }
    return [{ connectorTypeId: 'DB9', pinOverrides: {} }]
  })

  const [pinLinks, setPinLinks] = useState(() => {
    const saved = loadCableState()
    const links = saved.pinLinks && typeof saved.pinLinks === 'object' ? saved.pinLinks : {}
    const migrated = migratePinLinks(links)
    const main = loadMainStorage()
    const baseTypeId = main.lastConnector && CONNECTOR_TYPES[main.lastConnector] ? main.lastConnector : 'DB25'
    const cableArr = sanitizeCableConnectors(saved.connectors) ?? []
    return sanitizeLinks(migrated, baseTypeId, cableArr)
  })

  const [selectedCablePin, setSelectedCablePin] = useState(null)
  const [cableStorageError, setCableStorageError] = useState(null)

  // Memoize derived list of resolved connector types for consumers.
  const cableConnectorTypes = useMemo(
    () => cableConnectors.map((c) => CONNECTOR_TYPES[c.connectorTypeId] ?? null),
    [cableConnectors]
  )

  const getConnector = useCallback(
    (index) => {
      if (index === 0) return baseConnector
      const c = cableConnectors[index - 1]
      return c ? CONNECTOR_TYPES[c.connectorTypeId] ?? null : null
    },
    [baseConnector, cableConnectors]
  )

  const getPinStateAt = useCallback(
    (connectorIndex, pinNumber) => {
      if (connectorIndex === 0) return baseGetPinState(pinNumber)
      const c = cableConnectors[connectorIndex - 1]
      if (!c) return { label: `Pin ${pinNumber}`, color: '#6c757d', presetId: 'unassigned' }
      const override = c.pinOverrides[pinNumber]
      if (override) return override
      const conn = CONNECTOR_TYPES[c.connectorTypeId]
      const label = conn?.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
      return { label, color: '#6c757d', presetId: 'unassigned' }
    },
    [baseGetPinState, cableConnectors]
  )

  const updatePinAt = useCallback(
    (connectorIndex, pinNumber, updates) => {
      if (connectorIndex === 0) return baseUpdatePin(pinNumber, updates)
      setCableConnectors((prev) => {
        const idx = connectorIndex - 1
        const target = prev[idx]
        if (!target) return prev
        const next = [...prev]
        next[idx] = {
          ...target,
          pinOverrides: {
            ...target.pinOverrides,
            [pinNumber]: { ...target.pinOverrides[pinNumber], ...updates },
          },
        }
        return next
      })
    },
    [baseUpdatePin]
  )

  const setConnectorTypeAt = useCallback(
    (connectorIndex, connectorTypeId) => {
      if (connectorIndex === 0) return setConnectorTypeId(connectorTypeId)
      setCableConnectors((prev) => {
        const idx = connectorIndex - 1
        if (!prev[idx]) return prev
        const next = [...prev]
        const conn = CONNECTOR_TYPES[connectorTypeId]
        const baseDefaults = conn ? getDefaultPinOverrides(conn) : {}
        next[idx] = { connectorTypeId, pinOverrides: baseDefaults }
        return next
      })
      // When the type changes, drop any links targeting now-invalid pin numbers.
      setPinLinks((prev) => pruneLinksForConnector(prev, connectorIndex, CONNECTOR_TYPES[connectorTypeId]))
    },
    [setConnectorTypeId]
  )

  const addConnector = useCallback(() => {
    setCableConnectors((prev) => [...prev, { connectorTypeId: 'DB9', pinOverrides: {} }])
  }, [])

  const removeConnector = useCallback((connectorIndex) => {
    if (connectorIndex === 0) return
    setCableConnectors((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== connectorIndex - 1)
    })
    setPinLinks((prev) => removeAndShiftLinks(prev, connectorIndex))
    setSelectedCablePin(null)
  }, [])

  const addLink = useCallback((connectorIndexFrom, pinFrom, connectorIndexTo, pinTo) => {
    setPinLinks((prev) => {
      const next = { ...prev }
      const keyFrom = `${connectorIndexFrom}:${pinFrom}`
      const keyTo = `${connectorIndexTo}:${pinTo}`
      const oldTarget = next[keyFrom]
      const oldFrom = next[keyTo]
      if (oldTarget) delete next[oldTarget]
      if (oldFrom) delete next[oldFrom]
      next[keyFrom] = keyTo
      next[keyTo] = keyFrom
      return next
    })
  }, [])

  const removeLink = useCallback((connectorIndex, pinNumber) => {
    setPinLinks((prev) => {
      const next = { ...prev }
      const key = `${connectorIndex}:${pinNumber}`
      const linked = next[key]
      if (linked) {
        delete next[key]
        delete next[linked]
      }
      return next
    })
  }, [])

  const getLinkedPin = useCallback(
    (connectorIndex, pinNumber) => {
      const key = `${connectorIndex}:${pinNumber}`
      const v = pinLinks[key]
      if (!v || typeof v !== 'string') return null
      const [ci, pn] = v.split(':')
      return { connectorIndex: parseInt(ci, 10), pinNumber: parseInt(pn, 10) }
    },
    [pinLinks]
  )

  const resetAllPinsAt = useCallback(
    (connectorIndex) => {
      if (connectorIndex === 0) return baseResetAllPins()
      setCableConnectors((prev) => {
        const c = prev[connectorIndex - 1]
        if (!c) return prev
        const conn = CONNECTOR_TYPES[c.connectorTypeId]
        if (!conn) return prev
        const next = [...prev]
        next[connectorIndex - 1] = { ...c, pinOverrides: getDefaultPinOverrides(conn) }
        return next
      })
    },
    [baseResetAllPins]
  )

  const resetPinAt = useCallback(
    (connectorIndex, pinNumber) => {
      if (connectorIndex === 0) return baseResetPin(pinNumber)
      setCableConnectors((prev) => {
        const c = prev[connectorIndex - 1]
        if (!c) return prev
        const conn = CONNECTOR_TYPES[c.connectorTypeId]
        const def = conn?.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
        const next = [...prev]
        next[connectorIndex - 1] = {
          ...c,
          pinOverrides: {
            ...c.pinOverrides,
            [pinNumber]: { label: def, color: '#6c757d', presetId: 'unassigned' },
          },
        }
        return next
      })
    },
    [baseResetPin]
  )

  // Debounced persistence of cable state.
  useEffect(() => {
    const handle = setTimeout(() => {
      const payload = {
        connectors: cableConnectors.map((c) => ({ connectorTypeId: c.connectorTypeId, pinOverrides: c.pinOverrides })),
        pinLinks,
      }
      const err = saveCableState(payload)
      if (err) setCableStorageError(err.message || 'Failed to save cable assembly')
    }, PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [cableConnectors, pinLinks])

  /**
   * Replace cable state from a config or an import payload.
   * `baseTypeIdHint` lets callers (load/import) sanitize links against the
   * incoming base connector type, since base state is updated in parallel.
   */
  const applyCableState = useCallback((next, baseTypeIdHint) => {
    if (!next || typeof next !== 'object') {
      setCableConnectors([{ connectorTypeId: 'DB9', pinOverrides: {} }])
      setPinLinks({})
      setSelectedCablePin(null)
      return
    }
    const sanitized = sanitizeCableConnectors(next.connectors)
    const cableArr = sanitized && sanitized.length >= 1
      ? sanitized
      : [{ connectorTypeId: 'DB9', pinOverrides: {} }]
    setCableConnectors(cableArr)
    const baseTypeId = baseTypeIdHint && CONNECTOR_TYPES[baseTypeIdHint] ? baseTypeIdHint : null
    setPinLinks(sanitizeLinks(migratePinLinks(next.pinLinks), baseTypeId, cableArr))
    setSelectedCablePin(null)
  }, [])

  const saveAsConfig = useCallback(
    (name) => {
      const extras = {
        cableConnectors: cableConnectors.map((c) => ({ connectorTypeId: c.connectorTypeId, pinOverrides: { ...c.pinOverrides } })),
        pinLinks: { ...pinLinks },
      }
      return baseSaveAsConfig(name, extras)
    },
    [baseSaveAsConfig, cableConnectors, pinLinks]
  )

  const loadConfig = useCallback(
    (id) => {
      const config = baseLoadConfig(id)
      if (!config) return null
      if (Array.isArray(config.cableConnectors)) {
        applyCableState(
          { connectors: config.cableConnectors, pinLinks: config.pinLinks },
          config.connectorTypeId
        )
      } else {
        applyCableState(null)
      }
      refreshSavedConfigs?.()
      return config
    },
    [baseLoadConfig, applyCableState, refreshSavedConfigs]
  )

  const exportToFile = useCallback(() => {
    baseExportToFile({
      cableAssembly: {
        connectors: cableConnectors.map((c) => ({ connectorTypeId: c.connectorTypeId, pinOverrides: c.pinOverrides })),
        pinLinks,
      },
    })
  }, [baseExportToFile, cableConnectors, pinLinks])

  const importFromFile = useCallback(
    (file) =>
      baseImportFromFile(file, (data) => {
        const cable = data?.cableAssembly && typeof data.cableAssembly === 'object' ? data.cableAssembly : null
        const baseTypeIdHint = data?.lastConnector
        applyCableState(cable, baseTypeIdHint)
      }),
    [baseImportFromFile, applyCableState]
  )

  const storageError = baseStorageError || cableStorageError
  const clearAllStorageErrors = useCallback(() => {
    clearStorageError()
    setCableStorageError(null)
  }, [clearStorageError])

  return {
    ...base,
    saveAsConfig,
    loadConfig,
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
    storageError,
    clearStorageError: clearAllStorageErrors,
  }
}

/** Drop links that target invalid pin numbers on the given connector after a type change. */
function pruneLinksForConnector(prev, connectorIndex, newConnector) {
  if (!prev || typeof prev !== 'object') return {}
  const max = newConnector?.totalPins ?? 0
  const next = {}
  Object.entries(prev).forEach(([k, v]) => {
    const [ci, pn] = k.split(':').map(Number)
    const [cj, pn2] = String(v).split(':').map(Number)
    const involvesThis = ci === connectorIndex || cj === connectorIndex
    if (!involvesThis) {
      next[k] = v
      return
    }
    const ourPin = ci === connectorIndex ? pn : pn2
    if (ourPin >= 1 && ourPin <= max) next[k] = v
  })
  return next
}

/** Remove all links touching `connectorIndex` and shift remaining indices > connectorIndex down by 1. */
function removeAndShiftLinks(prev, connectorIndex) {
  const pairs = []
  const seen = new Set()
  Object.entries(prev).forEach(([k, v]) => {
    const canon = [k, v].sort().join('|')
    if (seen.has(canon)) return
    seen.add(canon)
    const [ci, pn] = k.split(':').map(Number)
    const [cj, pn2] = String(v).split(':').map(Number)
    if (ci === connectorIndex || cj === connectorIndex) return
    const newCi = ci > connectorIndex ? ci - 1 : ci
    const newCj = cj > connectorIndex ? cj - 1 : cj
    pairs.push([`${newCi}:${pn}`, `${newCj}:${pn2}`])
  })
  const next = {}
  pairs.forEach(([a, b]) => {
    next[a] = b
    next[b] = a
  })
  return next
}
