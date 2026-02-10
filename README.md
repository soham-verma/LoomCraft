# Connector Pin Tool

A visual tool to view and edit pin assignments for D-Sub connectors (DB-25, DB-9, and more). Each pin has an editable label and a wire color; presets include Live (red), Ground (black), CAN High, CAN Low, TX, RX, and more.

## Features

- **Connector types**: DB-25 and DB-9 (extensible for more later).
- **Visual connector**: SVG view of the connector with pins and colored “wires” so you can see which wire connects to which pin.
- **Click to edit**: Click a pin to open a side panel and edit its label and color.
- **Color presets**: Live (red), Ground (black), CAN High, CAN Low, TX, RX, Signal, Unassigned; plus custom color picker.
- **Persistence**: Pin labels and colors are saved per connector in `localStorage`.

## Run locally

```bash
cd tools/db25_pintool
npm install
npm run dev
```

Then open the URL shown (e.g. http://localhost:5173).

## Build

```bash
npm run build
npm run preview   # preview production build
```
