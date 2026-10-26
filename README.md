# CircuitBuilder v0.3 — Neon Time Lab

**New in v0.3:** Free-ended traces, right-click menus, real capacitors and inductors, and a time-position scrubber over an RLC transient simulation.

## Free wiring and junctions

- Click any glowing terminal to begin a wire.
- **Click blank grid** to leave a free endpoint; the free tip glows pink. Continue the path with more clicks, or press **ESC** to leave it dangling.
- To add a part later, drag and position one of its terminals exactly over the free tip. The contact is electrically recognized when a pin matches the free wire endpoint. The editor uses a **24 px visual grid with 12 px snapping** so every kind of pin (including ground) can meet a dangling tip.
- A free endpoint laid on an existing wire forms a junction (no component required). You can also **right-click a wire → START BRANCH HERE**.
- Right-click empty canvas to **START FREE WIRE HERE** or place one of eight components.
- **Right-click a component** to edit its numeric value, rotate, toggle a switch, start a wire from a particular pin, adjust a potentiometer wiper, or delete it.
- **Right-click a wire** to branch or delete it. The inspector remains available for detailed readings.
- Mid-wire crossings without explicit wire endpoints or component pads do **not** connect. Older terminal-to-terminal wiring behavior is retained.

## Transient RLC analysis

Two new energy-storage components join the existing six basic analog parts:

| Component | Default value | Unit |
| --- | --- | --- |
| Capacitor (C) | 100 µF | Farads (100 µF = 0.0001 F) |
| Inductor (L) | 100 mH | Henrys (100 mH = 0.1 H) |

Select the **RC CHARGING** or **RL RESPONSE** lab in the left palette, then click **RUN TRANSIENT** in the **TIME MACHINE** panel. You can:

1. Choose a time window in **milliseconds**.
2. Drag the time slider to any simulated time step, or use **PLAY / PAUSE**.
3. See the voltages/currents update on your canvas and inspector at the selected time.
4. Select another part and switch between **V** and **I** graphs to inspect its waveform.

Transient analysis uses **Backward Euler** companion models and Modified Nodal Analysis. It simulates a **constant independent DC source step starting at t = 0**, with **initial capacitor voltages of 0 V and initial inductor currents of 0 A**. The default timeline uses 240 equal time steps. This is a linear lumped-circuit simulator, not a full SPICE transient system: no nonlinear diodes, varying waveforms, switches changing state mid-run, arbitrary user-set initial conditions, or adaptive step size yet.

Steady-state **DC** still works: a capacitor is an open circuit and an inductor is an ideal short. v0.1 and v0.2 exported documents remain readable because the document schema version stays at 1.

---

## Background: v0.2 Neon Arcade

A neon pixel-arcade **analog circuit workbench** powered by real circuit equations. Place components, wire their glowing terminal pins, run DC analysis, and explore how voltage and current flow.

The interface is intentionally playful; the circuit math is not faked.

## Quick start

Requires Node.js 20+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173/).

```bash
npm run build
npm test
```

## Features

- Neon-retro CRT aesthetic, luminous wire paths, pixel-art component sprites, scanline finish and animated activity indicators.
- Canvas editor with 24 px grid snapping, pan, zoom, drag, rotate, select and wire removal.
- **Six** basic linear DC components:
  - Resistor (R), in ohms
  - Independent ideal voltage source (V), in volts
  - Ground (GND)
  - **SPST switch (S)** — open / closed
  - **Independent ideal current source (I)** — amps, signed A → B
  - **Three-terminal potentiometer (P)** — total ohms and adjustable A/W/B wiper
- Inspect component properties, branch current, voltage, and power.
- Run real Modified Nodal Analysis (MNA) with pivoted Gaussian elimination.
- Save automatically in your browser and export/import v1-compatible JSON.
- Four instant labs: voltage divider, switch control, current source, potentiometer.

## Controls

| Action | How |
| --- | --- |
| Add a part | Drag from Parts Library or click a palette item |
| Connect wires | Click the glowing terminal on one part, then on another |
| Pan | Drag empty canvas |
| Zoom | Mouse wheel or +/- bottom-right |
| Rotate | Select component then press **R** or click Rotate in inspector |
| Flip an SPST switch | Double-click switch sprite, select + press **Space**, or use inspector |
| Adjust potentiometer | Select pot, then move wiper slider between 1% and 99% |
| Remove a part or wire | Select it then press **Delete** / **Backspace** |
| Cancel wiring | **Esc** |
| Save in browser | Autosave, SAVE button, or **Ctrl/Cmd + S** |
| Export | EXPORT downloads a JSON schematic |
| Import | IMPORT opens compatible JSON |
| Try a new component | Select one of the **Instant Labs** presets |

## Circuit model and conventions

- All **ground** symbols refer to the same zero-voltage node.
- Resistors are stamped as conductances, \(1/R\).
- A **closed SPST** is an ideal 0-volt constrained branch (its current is calculated); an **open SPST** has zero current.
- An independent **current source** forces current *from* pin **A** *to* pin **B** (current injection is negative at A and positive at B).
- A **potentiometer** is modeled as two resistors A–W and W–B. A wiper setting of 25% yields A–W = 0.25 × total resistance and W–B = 0.75 × total resistance.
- A resistor's current and an ideal source's current are signed **A → B**. Potentiometer current shown in the inspector is the A → W segment current (wiper load can make A → W and W → B currents different).
- Power is signed \(P = V I\) using the passive sign convention. Negative source power means delivering power.
- Potentiometer power reports the **sum of dissipated power** in its two internal segments.
- Solver detects singular configurations such as floating nodes, shorts on ideal voltage sources, and conflicting ideal-source loops.
- Resistive values range from 0.001 Ω to 1 GΩ. Wiper range 0.1–99.9% internally, adjusted through a 1–99% UI slider.

### File format

Schematics use a versioned JSON object: `{ version: 1, name, components, wires }`.
New v0.2 kinds are additive to the v0.1 schema; existing exported schematics and locally saved documents remain compatible.

```json
{
  "version": 1,
  "name": "A little switch",
  "components": [
    { "id": "s1", "kind": "switch", "x": 240, "y": 240, "rotation": 0, "value": 0, "closed": true }
  ],
  "wires": []
}
```

Switches have two pins A/B. Potentiometers have three pins A/B/W. Resistors, independent sources, and switches use A/B. Ground uses G.

## Tech stack

- React 19 + TypeScript
- Vite
- HTML Canvas 2D for sharp, precise vector/pixel-art schematics
- Zustand for application state and browser persistence
- Vitest for solver regressions and component behavior
- GitHub Actions for build + test verification on pushes / pull requests

### Code layout

```text
src/
  circuit/
    types.ts             Serialized model, pins and geometry
    connectivity.ts      Terminal-level union-find connectivity graph
    sample.ts            Four playable circuit labs
  simulation/
    dc.ts                Standalone MNA engine and Gaussian solver
    dc.test.ts           Existing voltage-divider/validation regressions
    newComponents.test.ts Switch, current-source and potentiometer tests
  state/
    useCircuitStore.ts   Editor actions, simulation state and browser saves
  components/
    CircuitCanvas.tsx    Schematics, sprites, glowing wires, pan/zoom
    Inspector.tsx        Numeric inputs, switch toggle, pot slider, results
    Palette.tsx          Component library and instant lab presets
  App.tsx
  styles.css             Base layout
  neon.css               Neon arcade theme and CRT finish
```

## Scope of v0.2

This is a **linear DC** simulator, not full SPICE. No time-domain transients, capacitors, inductors, diode nonlinearities, frequency response, probes, mid-wire junction editing, or cloud accounts yet. If opening a switch leaves a fully floating circuit, MNA will report a clear singular-network error rather than invent node voltages. All wire connections are currently terminal-to-terminal.

Future ideas: transient RLC simulation, LED/diodes, SPDT switches, oscilloscopes, shared schematics, undo/redo, better signal instruments.

> Educational portfolio project only. Verify electrical calculations independently before building real hardware.
