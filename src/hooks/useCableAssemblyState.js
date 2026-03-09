import { useState, useEffect, useCallback } from 'react'
import { useConnectorState } from './useConnectorState'
import { CONNECTOR_TYPES, DB25_HYP_SEED_CONFIG } from '../connectors/config'

const CABLE_STORAGE_KEY = 'connector-cable-assembly'
const STORAGE_KEY = 'connector-pin-tool'

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
  } catch (_) {}
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
  } catch (_) {}
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

/** Migrate A/B pinLinks to 0/1 format */
function migratePinLinks(links) {
  if (!links || typeof links !== 'object') return {}
  const next = {}
  Object.entries(links).forEach(([key, value]) => {
    const k = key.replace(/^A:/, '0:').replace(/^B:/, '1:')
    if (typeof value === 'number') {
      next[k] = `1:${value}`
      if (key.startsWith('A:')) next[`1:${value}`] = `0:${key.slice(2)}`
      else if (key.startsWith('B:')) next[`0:${value}`] = `1:${key.slice(2)}`
    } else if (typeof value === 'string' && value.includes(':')) {
      next[k] = value
      const [ci, pn] = value.split(':')
      next[value] = k
    }
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

  const [cableConnectors, setCableConnectors] = useState(() => {
    const saved = loadCableState()
    const arr = saved.connectors
    if (Array.isArray(arr) && arr.length >= 1) {
      return arr.map((c) => ({
        connectorTypeId: c?.connectorTypeId && CONNECTOR_TYPES[c.connectorTypeId] ? c.connectorTypeId : 'DB9',
        pinOverrides: c?.pinOverrides && typeof c.pinOverrides === 'object' ? c.pinOverrides : {},
      }))
    }
    if (saved.connectorTypeIdB && CONNECTOR_TYPES[saved.connectorTypeIdB]) {
      const overrides = saved.connectorB?.[saved.connectorTypeIdB]?.pinOverrides
      return [{ connectorTypeId: saved.connectorTypeIdB, pinOverrides: overrides && typeof overrides === 'object' ? overrides : {} }]
    }
    return [
      { connectorTypeId: 'DB9', pinOverrides: {} },
    ]
  })

  const [pinLinks, setPinLinks] = useState(() => {
    const saved = loadCableState()
    const links = saved.pinLinks && typeof saved.pinLinks === 'object' ? saved.pinLinks : {}
    return migratePinLinks(links)
  })

  const [selectedCablePin, setSelectedCablePin] = useState(null) // { connectorIndex: number, pinNumber: number }

  const cableConnectorTypes = cableConnectors.map((c) => CONNECTOR_TYPES[c.connectorTypeId])

  const getConnector = useCallback(
    (index) => {
      if (index === 0) return base.connector
      const c = cableConnectors[index - 1]
      return c ? CONNECTOR_TYPES[c.connectorTypeId] : null
    },
    [base.connector, cableConnectors]
  )

  const getPinStateAt = useCallback(
    (connectorIndex, pinNumber) => {
      if (connectorIndex === 0) return base.getPinState(pinNumber)
      const c = cableConnectors[connectorIndex - 1]
      if (!c) return { label: `Pin ${pinNumber}`, color: '#6c757d', presetId: 'unassigned' }
      const conn = CONNECTOR_TYPES[c.connectorTypeId]
      if (c.pinOverrides[pinNumber]) return c.pinOverrides[pinNumber]
      const label = conn?.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
      return { label, color: '#6c757d', presetId: 'unassigned' }
    },
    [base, cableConnectors]
  )

  const updatePinAt = useCallback(
    (connectorIndex, pinNumber, updates) => {
      if (connectorIndex === 0) return base.updatePin(pinNumber, updates)
      setCableConnectors((prev) => {
        const next = [...prev]
        const idx = connectorIndex - 1
        if (!next[idx]) return prev
        next[idx] = { ...next[idx], pinOverrides: { ...next[idx].pinOverrides, [pinNumber]: { ...next[idx].pinOverrides[pinNumber], ...updates } } }
        return next
      })
    },
    [base]
  )

  const setConnectorTypeAt = useCallback((connectorIndex, connectorTypeId) => {
    if (connectorIndex === 0) return base.setConnectorTypeId(connectorTypeId)
    setCableConnectors((prev) => {
      const next = [...prev]
      const idx = connectorIndex - 1
      if (!next[idx]) return prev
      const conn = CONNECTOR_TYPES[connectorTypeId]
      const baseDefaults = conn ? getDefaultPinOverrides(conn) : {}
      next[idx] = { connectorTypeId, pinOverrides: baseDefaults }
      return next
    })
  }, [base])

  const addConnector = useCallback(() => {
    setCableConnectors((prev) => [...prev, { connectorTypeId: 'DB9', pinOverrides: {} }])
  }, [])

  const removeConnector = useCallback((connectorIndex) => {
    if (connectorIndex === 0) return
    setCableConnectors((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== connectorIndex - 1)
      return next
    })
    setPinLinks((prev) => {
      const pairs = []
      const seen = new Set()
      Object.entries(prev).forEach(([k, v]) => {
        const canon = [k, v].sort().join('|')
        if (seen.has(canon)) return
        seen.add(canon)
        const ci = parseInt(k.split(':')[0], 10)
        const cj = parseInt(String(v).split(':')[0], 10)
        if (ci === connectorIndex || cj === connectorIndex) return
        const [pn, pn2] = [k.split(':')[1], String(v).split(':')[1]]
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
    })
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
      if (connectorIndex === 0) return base.resetAllPins()
      const c = cableConnectors[connectorIndex - 1]
      if (!c) return
      const conn = CONNECTOR_TYPES[c.connectorTypeId]
      if (!conn) return
      setCableConnectors((prev) => {
        const next = [...prev]
        next[connectorIndex - 1] = { ...next[connectorIndex - 1], pinOverrides: getDefaultPinOverrides(conn) }
        return next
      })
    },
    [base, cableConnectors]
  )

  const resetPinAt = useCallback(
    (connectorIndex, pinNumber) => {
      if (connectorIndex === 0) return base.resetPin(pinNumber)
      const c = cableConnectors[connectorIndex - 1]
      const conn = CONNECTOR_TYPES[c?.connectorTypeId]
      if (!conn) return
      const def = conn.defaultLabels?.[pinNumber] ?? `Pin ${pinNumber}`
      updatePinAt(connectorIndex, pinNumber, { label: def, color: '#6c757d', presetId: 'unassigned' })
    },
    [base, cableConnectors, updatePinAt]
  )

  useEffect(() => {
    const saved = loadCableState()
    saved.connectors = cableConnectors.map((c) => ({ connectorTypeId: c.connectorTypeId, pinOverrides: c.pinOverrides }))
    saved.pinLinks = pinLinks
    saveCableState(saved)
  }, [cableConnectors, pinLinks])

  const saveAsConfig = useCallback(
    (name) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return
      const configs = loadSavedConfigs()
      const newConfig = {
        id: crypto.randomUUID?.() ?? `saved-${Date.now()}`,
        name: trimmed,
        connectorTypeId: base.connectorTypeId,
        pinOverrides: { ...base.pinOverrides },
        cableConnectors: cableConnectors.map((c) => ({ connectorTypeId: c.connectorTypeId, pinOverrides: { ...c.pinOverrides } })),
        pinLinks: { ...pinLinks },
      }
      configs.push(newConfig)
      persistSavedConfigs(configs)
      base.refreshSavedConfigs?.()
    },
    [base.connectorTypeId, base.pinOverrides, base.refreshSavedConfigs, cableConnectors, pinLinks]
  )

  const loadConfig = useCallback(
    (id) => {
      const configs = loadSavedConfigs()
      const config = configs.find((c) => c.id === id)
      if (!config) return
      const connectorTypeId = config.connectorTypeId
      const pinOverrides = config.pinOverrides ?? {}
      const data = loadMainStorage()
      const all = data.connectors ?? {}
      all[connectorTypeId] = { pinOverrides }
      data.connectors = all
      data.lastConnector = connectorTypeId
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      base.setConnectorTypeId(connectorTypeId)
      if (Array.isArray(config.cableConnectors) && config.cableConnectors.length > 0) {
        setCableConnectors(
          config.cableConnectors.map((c) => ({
            connectorTypeId: c?.connectorTypeId && CONNECTOR_TYPES[c.connectorTypeId] ? c.connectorTypeId : 'DB9',
            pinOverrides: c?.pinOverrides && typeof c.pinOverrides === 'object' ? c.pinOverrides : {},
          }))
        )
        if (config.pinLinks && typeof config.pinLinks === 'object') {
          setPinLinks(config.pinLinks)
        }
      } else {
        setCableConnectors([{ connectorTypeId: 'DB9', pinOverrides: {} }])
        setPinLinks({})
      }
      setSelectedCablePin(null)
      base.refreshSavedConfigs?.()
    },
    [base]
  )

  return {
    ...base,
    saveAsConfig,
    loadConfig,
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
  }
}
