/**
 * Connector type definitions: pin count, rows, shape, and default labels.
 * Pin positions are in "connector space": row index and column index.
 * shape: 'dsub' (trapezoid) or 'singleRow' (rounded rect). Omitted = dsub.
 */

function pinLabels(n) {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, `Pin ${i + 1}`]))
}

export const CONNECTOR_TYPES = {
  DB25: {
    id: 'DB25',
    name: 'DB-25',
    shape: 'dsub',
    rows: [13, 12],
    totalPins: 25,
    defaultLabels: {
      1: 'Frame GND',
      2: 'TX',
      3: 'RX',
      4: 'RTS',
      5: 'CTS',
      6: 'DSR',
      7: 'Signal GND',
      8: 'CD',
      9: '+Tx',
      10: '-Tx',
      11: 'Unassigned',
      12: 'Secondary CD',
      13: 'Secondary CTS',
      14: 'Secondary TX',
      15: 'Tx Clk',
      16: 'Secondary RX',
      17: 'RC Clk',
      18: 'Unassigned',
      19: 'Secondary RTS',
      20: 'DTR',
      21: 'Signal Quality',
      22: 'RI',
      23: 'Data Rate',
      24: 'Ext Clk',
      25: 'Unassigned',
    },
  },
  DB9: {
    id: 'DB9',
    name: 'DB-9 (DE-9)',
    shape: 'dsub',
    rows: [5, 4],
    totalPins: 9,
    defaultLabels: {
      1: 'CD',
      2: 'RX',
      3: 'TX',
      4: 'DTR',
      5: 'Signal GND',
      6: 'DSR',
      7: 'RTS',
      8: 'CTS',
      9: 'RI',
    },
  },
  RS232: {
    id: 'RS232',
    name: 'RS-232 (9-pin)',
    shape: 'dsub',
    rows: [5, 4],
    totalPins: 9,
    defaultLabels: {
      1: 'CD',
      2: 'RX',
      3: 'TX',
      4: 'DTR',
      5: 'Signal GND',
      6: 'DSR',
      7: 'RTS',
      8: 'CTS',
      9: 'RI',
    },
  },
  JACK_35MM_2: {
    id: 'JACK_35MM_2',
    name: '3.5mm jack (2-pin)',
    shape: 'jack35mm',
    rows: [2],
    totalPins: 2,
    defaultLabels: { 1: 'Tip', 2: 'Sleeve' },
  },
  JACK_35MM_3: {
    id: 'JACK_35MM_3',
    name: '3.5mm jack (3-pin TRS)',
    shape: 'jack35mm',
    rows: [3],
    totalPins: 3,
    defaultLabels: { 1: 'Tip', 2: 'Ring', 3: 'Sleeve' },
  },
  JACK_35MM_4: {
    id: 'JACK_35MM_4',
    name: '3.5mm jack (4-pin TRRS)',
    shape: 'jack35mm',
    rows: [4],
    totalPins: 4,
    defaultLabels: { 1: 'Tip', 2: 'Ring1', 3: 'Ring2', 4: 'Sleeve' },
  },
  USB2: {
    id: 'USB2',
    name: 'USB 2.0 (4-pin)',
    shape: 'singleRow',
    rows: [4],
    totalPins: 4,
    defaultLabels: { 1: 'VCC', 2: 'D-', 3: 'D+', 4: 'GND' },
  },
  POWER_3: {
    id: 'POWER_3',
    name: '3-pin power',
    shape: 'power3Triangle',
    layout: 'triangle',
    rows: [3],
    totalPins: 3,
    defaultLabels: { 1: 'VCC', 2: 'GND', 3: 'Signal' },
  },
  JST_GH_4: {
    id: 'JST_GH_4',
    name: 'JST GH (4-pin)',
    shape: 'singleRow',
    rows: [4],
    totalPins: 4,
    defaultLabels: pinLabels(4),
  },
  JST_GH_5: {
    id: 'JST_GH_5',
    name: 'JST GH (5-pin)',
    shape: 'singleRow',
    rows: [5],
    totalPins: 5,
    defaultLabels: pinLabels(5),
  },
  JST_GH_6: {
    id: 'JST_GH_6',
    name: 'JST GH (6-pin)',
    shape: 'singleRow',
    rows: [6],
    totalPins: 6,
    defaultLabels: pinLabels(6),
  },
  JST_GH_8: {
    id: 'JST_GH_8',
    name: 'JST GH (8-pin)',
    shape: 'singleRow',
    rows: [8],
    totalPins: 8,
    defaultLabels: pinLabels(8),
  },
  JST_GH_10: {
    id: 'JST_GH_10',
    name: 'JST GH (10-pin)',
    shape: 'singleRow',
    rows: [10],
    totalPins: 10,
    defaultLabels: pinLabels(10),
  },
  JST_GH_12: {
    id: 'JST_GH_12',
    name: 'JST GH (12-pin)',
    shape: 'singleRow',
    rows: [12],
    totalPins: 12,
    defaultLabels: pinLabels(12),
  },
}

/** Connector groups for dropdown optgroup. Order matches display order. */
export const CONNECTOR_GROUPS = [
  { label: 'D-Sub / Serial', ids: ['DB25', 'DB9', 'RS232'] },
  { label: '3.5mm jack', ids: ['JACK_35MM_2', 'JACK_35MM_3', 'JACK_35MM_4'] },
  { label: 'USB', ids: ['USB2'] },
  { label: 'JST GH', ids: ['JST_GH_4', 'JST_GH_5', 'JST_GH_6', 'JST_GH_8', 'JST_GH_10', 'JST_GH_12'] },
  { label: 'Power', ids: ['POWER_3'] },
]

/**
 * Color presets for wire/pin types.
 */
export const COLOR_PRESETS = [
  { id: 'live', label: 'Live', color: '#dc3545', description: 'Power / Live' },
  { id: 'ground', label: 'Ground', color: '#212529', description: 'Ground' },
  { id: 'can-high', label: 'CAN High', color: '#0d6efd', description: 'CAN bus high' },
  { id: 'can-low', label: 'CAN Low', color: '#0dcaf0', description: 'CAN bus low' },
  { id: 'tx', label: 'TX', color: '#198754', description: 'Transmit' },
  { id: 'rx', label: 'RX', color: '#fd7e14', description: 'Receive' },
  { id: 'signal', label: 'Signal', color: '#6f42c1', description: 'Generic signal' },
  { id: 'unassigned', label: 'Unassigned', color: '#6c757d', description: 'Not assigned' },
]

export const DEFAULT_PRESET_ID = 'unassigned'
