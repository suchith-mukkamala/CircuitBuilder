# CircuitBuilder v0.1

A retro pixel-inspired **analog circuit workbench** with a real, deterministic DC simulation engine. Build circuits, wire up pins, edit values, analyze voltages and currents, and save your schematic — all in the browser.

## Features

- **Schematic canvas** with 24 px snapping grid, pan, zoom, move, select, and rotate.
- **Wiring** by clicking two green component terminals; select wires to delete them.
- **Analog parts:** resistors, independent ideal DC voltage sources, and ground.
- **DC solver** using Modified Nodal Analysis and Gaussian elimination with partial pivoting.
- **Inspector** for component values (SI base units), rotation, and DC readings.
- **Persistence:** autosave to browser local storage, export/import versioned JSON.
- **Example:** 10 V / 1 kΩ / 1 kΩ voltage divider, preloaded on first visit.

## Run locally

Requires Node.js 20+ (recommended 22).

    npm install
    npm run dev

Open the local URL shown by Vite (typically http://localhost:5173).

Run tests and production build:

    npm test
    npm run build

## How to use

1. Drag a component from the left sidebar onto the grid, or click it to add one.
2. Click a green **terminal**, then another terminal to connect them.
3. Select a component to edit its resistance in **ohms** or source voltage in **volts**.
4. Press **RUN DC ANALYSIS** to display results and node voltages on the grid.
5. Save happens automatically in this browser. Click **EXPORT** for portable JSON, **IMPORT** to reopen it.

| Shortcut | Action |
| --- | --- |
| R | Rotate selected component 90° |
| Delete / Backspace | Delete selected part or wire |
| Esc | Cancel wire in progress |
| Ctrl/Cmd + S | Save in local storage |
| Mouse wheel | Zoom around cursor |
| Drag empty canvas | Pan |

### Electrical conventions

- Voltage source **a** terminal is positive relative to **b**.
- Resistor and source current readings are signed from pin **a** toward pin **b**.
- Ideal voltage-source power is negative when it delivers energy to the circuit.
- All ground symbols represent the same 0 V reference node.
- Resistors must be between 0.001 Ω and 1 GΩ. Zero-ohm wires should be modeled as wires.
- A DC solution requires properly connected terminals and a non-singular circuit matrix.

### Deliberate v0.1 limitations

Only linear DC resistors and ideal voltage sources are supported. No transient analysis, capacitors, inductors, diodes, junction-on-wire editing, undo history, user accounts, cloud saves, or collaboration yet. Wiring connects **component terminals**, not arbitrary midpoints on a line. An imported document must follow the v1 schema.

## Architecture

- src/circuit — versioned circuit schema, pin geometry, connectivity validation.
- src/simulation — pure TypeScript Modified Nodal Analysis (no React dependence).
- src/state — Zustand editor state and local-storage persistence.
- src/components — React controls and HTML Canvas 2D schematic renderer.

The electrical model is separate from layout and pixel-art rendering. This makes it possible to extend the simulator later without coupling its math to UI code.

## Future roadmap

- **v0.2:** capacitor/inductor models and time-domain simulation
- **v0.3:** diode/LED nonlinear DC analysis
- **v0.4:** interactive probes and an oscilloscope-style waveform viewer

The app is a learning and portfolio tool, **not** a safety-certified circuit simulator. Independently verify real-world electrical designs.
