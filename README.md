# CircuitBuilder v0.8 — Computer Foundations & CPU Home Screen

CircuitBuilder is becoming a hardware design workbench. Alongside Analog Lab's DC/RLC electrical solver, Signal Lab can now simulate **combinational AND sequential digital circuits**, including small RAM, programmable ROM, registers, counters, and a 4-bit arithmetic/logic unit. The app opens to a new **retro neon home screen featuring a live CPU datapath**.

## What you can build today

The v0.8 foundation can build an actual *small clocked digital computer datapath* using these new parts:

| New part | Pins and behavior |
| --- | --- |
| CLOCK SOURCE | OUT; emits one logical 0→1→0 pulse on every CLOCK STEP |
| D FLIP-FLOP | D, CLK → Q; captures D on a **rising** clock edge |
| T FLIP-FLOP | T, CLK → Q; toggles when T=1 on a rising edge |
| 4-BIT REGISTER | D0–D3, CLK, EN → Q0–Q3; stores one 4-bit word when EN=1 |
| 4-BIT COUNTER | CLK, EN, RESET → Q0–Q3; synchronous 4-bit increment and reset |
| 16×4 RAM | A0–A3, D0–D3, WE, CLK → Q0–Q3; 16 words of 4 bits, synchronous write and asynchronous read |
| 16×4 ROM | A0–A3 → Q0–Q3; editable program table persisted in the circuit JSON |
| 4-BIT ALU | A0–A3, B0–B3, OP0, OP1 → Y0–Y3, CARRY, ZERO; ADD / AND / OR / XOR |

The bit numbering convention is **bit 0 = least-significant bit (LSB)**. Clocked parts update together based on the previous state, so a chain of registers won't accidentally propagate several cycles in one edge. The CPU datapath uses that exact behavior.

### How to try the CPU demo

1. Open the **Home** page. The CPU chip illustration is **live**: use **CLOCK STEP**, **+8 CYCLES**, or **RESET** to watch the program counter and accumulator evolve.
2. Click **OPEN THE 4-BIT CPU DEMO** to load its actual wired schematic in Signal Lab. This starter connects a CLOCK to a PC counter and accumulator; PC → ROM → ALU → ACC with ACC feedback to ALU and output LEDs.
3. Open the **▣ CPU** tab in Signal Lab to step once, run 8/16 cycles, autoplay at 1/2/4/8 Hz, or reset the simulation state.
4. Select the ROM and edit its **16 hexadecimal words** in the Inspector, then save the program. ROM bytes (nibbles) are stored in the JSON schematic, while runtime register and RAM values reset when restarting simulation or editing circuit topology.
5. Probe any pin or wire using right-click and open **WAVEFORM** to inspect the changes after each tick. The existing binary input tester also supports manual rising-edge triggers when an INPUT switch is wired to CLK.
6. Try the **D Flip-Flop** and **Clocked 4-Bit Counter** samples. For arithmetic, connect four ALU output bits to LEDs and wire its OP0/OP1 lines to choose a logical operation.

### Simulation model

- CLOCK STEP creates one **discrete logical event**, not a calibrated nanosecond time delay.
- On a rising clock edge, all stateful components sample *pre-edge* values simultaneously. RAM writes only if WE=1 at the edge; RAM reads are asynchronous.
- Clocked state is separate from schematic geometry. Simulation resets clear registers/counters/RAM, while ROM definitions are part of the saved circuit.
- Every 4-bit data channel uses **four separate named pins and wires**. Bundled multi-bit buses are a future UI/data-model feature.
- Four-state signal semantics are preserved: 0, 1, X (unknown), Z (undriven). The digital engine reports floating pins and output-driver conflicts.
- Truth tables remain available for **combinational** designs. Sequential circuits use clock stepping and waveform analysis, not a misleading static truth table.

### What would still be required for a more advanced computer?

You can build educational 4-bit CPU *datapaths* now, but **not yet a complete programmable general-purpose CPU**. The provided CPU example repeatedly adds ROM data to an accumulator; it does not decode or execute machine instructions. To expand toward an 8/16/32-bit computer, planned milestones include:

1. **Instruction decoder / control unit, program branching, flags and jump conditions**.
2. **Register files, RAM/ROM scaling, integrated multi-bit buses and signal grouping**.
3. **Assembler or machine-code program loader, ISA definition and debugger**.
4. **Large-design performance, stronger sequential/timing tests, validation tools, memory addressing and peripherals**.
5. **Configurable propagation delays and richer clock scheduling**, if physical timing becomes a goal.

A modern multicore computer also needs sophisticated pipelines, caches, interrupts, external IO and an optimized simulation backend. v0.8 makes the fundamentals possible without implying those features already exist.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

Your original Analog Lab, Signal Lab Boolean gates, searchable catalog, clockless custom modules, JSON files, and block drilldown remain supported.

---

## Previous release notes

# CircuitBuilder v0.7 — Arcade Parts Catalog & Advanced Digital Components

Signal Lab's neon pixel-art parts library now contains **20 built-in components**, searchable and organized into categories with favorites and recently used shortcuts. The digital engine supports three-input logic, fixed logic levels, data routing, and two-output arithmetic devices. Analog Lab and saved reusable blocks remain supported.

## Search and organize digital components

- Expand **PARTS** and use the search box, or press **/** to focus the search when the catalog is visible. Search by part name, circuit concept, or alias: \`mux\`, \`carry\`, \`3-input\`, \`inverter\`, \`ground\`, \`majority\`.
- Browse categorized sections: **Inputs & Sources**, **Basic Logic Gates**, **Multi-Input Gates**, **Data Routing**, **Binary Arithmetic**, and **Output & Display**.
- Choose a category filter to narrow the catalog. Fold any section to get more canvas space.
- Star a component using **☆** to pin it under Favorites. Recently placed components appear in a second quick-access strip. Favorite and recent kinds persist locally across browser reloads.
- Saved user-designed circuit blocks remain under **Your Reusable Blocks**, searchable by block name.
- Right-click an empty grid cell for an organized list of components to place at the clicked position. Click or drag built-in parts directly from the catalog.

## 10 new simulated components

| Part | Pins | Digital behavior |
| --- | --- | --- |
| Logic HIGH | OUT | Constant digital \`1\`; not a user-toggleable input |
| Logic LOW | OUT | Constant digital \`0\`; not a user-toggleable input |
| 3-input AND | A, B, C → OUT | HIGH when all three inputs are HIGH |
| 3-input OR | A, B, C → OUT | HIGH when any input is HIGH |
| 3-input XOR | A, B, C → OUT | Odd parity across three input bits |
| Majority | A, B, C → OUT | HIGH when two or more inputs are HIGH |
| MUX 2:1 | A, B, SEL → OUT | Select A when SEL=0, B when SEL=1 |
| DEMUX 1:2 | IN, SEL → OUT0, OUT1 | Route IN to one output; unused output LOW |
| Half Adder | A, B → SUM, CARRY | SUM = A xor B; CARRY = A and B |
| Full Adder | A, B, CIN → SUM, CARRY | SUM = A xor B xor CIN; CARRY = majority(A,B,CIN) |

**Full adder example:** three inputs \`A=1,B=1,CIN=0\` produce \`SUM=0,CARRY=1\`. Connect independent LEDs to SUM and CARRY, or capture the full circuit as a reusable module and combine modules for larger arithmetic circuits.

The Boolean engine retains four-state semantics: HIGH (1), LOW (0), unknown/conflict (X), undriven (Z). Known controlling values produce deterministic results, even alongside unknowns where mathematically justified (for example \`AND3(0,X,Z)=0\` and \`MAJORITY(1,1,Z)=1\`). These are combinational components, not clocked or propagation-delay models.



### Analog Lab search and organization

Analog Lab now shares the neon search-and-category experience. Its existing eight
simulated parts are grouped under **Passives & Reference**, **Sources & Controls**,
and **Energy Storage**, with collapsible categories, quick category filters,
and keyword searching (for example \`coil\`, \`current\`, or \`variable resistor\`).
No analog component model or solver behavior has been changed.

## Improvements under the hood

- A single part-definition catalog drives search, category navigation, and right-click placement.
- New multi-pin, multi-output component geometry is shared between the canvas and electrical connectivity checks.
- The hierarchical compiler and Boolean solver now handle any number of named inputs and outputs on a primitive; reusable blocks can contain the new devices.
- Full-adder and demultiplexer outputs are independent signal nets rather than a combined fake output.
- Automated tests cover Boolean truth tables, four-state propagation, pin geometry and wiring, hierarchy compatibility, and catalog search/favorites.

## Update & run

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.6.1 — Block Wiring & Circuit Drilldown

This release fixes Signal Lab's reusable-block pin connections and adds a direct way to edit the original circuit inside any saved module.

## Connect a reusable block

- **Block input pins** are named \`in0\`, \`in1\`, etc.; outputs are \`out0\`, \`out1\`, etc. The editor now uses the component's actual declared pins during wiring, so these are accepted just like AND/OR/XOR gate pins.
- Click an INPUT or gate output pin, then a block input, to wire a block. Click a block output and another gate or LED input to connect its result.
- Free-ended wires and intentional junctions remain supported. A component input placed directly onto a drawn trace is still recognized as connected.
- Named pin labels (for example \`A\`, \`B\`, \`SUM\`, \`CARRY\`) remain visible on the block body.

## Open and edit a block

1. **Double-click** any placed block on the Signal Lab canvas. Or select it and choose **OPEN & EDIT BLOCK** in the inspector, or right-click the block and choose **OPEN & EDIT INTERNAL CIRCUIT**.
2. The canvas switches to the block's *original, expanded* schematic. A breadcrumb bar shows **ROOT CIRCUIT › BLOCK NAME**, including nested levels.
3. Change internal gates, move parts, reroute traces, or rename interface INPUT switches and LED outputs. Undo/redo remains available inside the draft.
4. Choose **SAVE BLOCK** to validate and publish the edited schematic. Every instance referencing that same saved block now uses the new logic. The parent schematic returns automatically.
5. Choose **CANCEL / BACK** to discard the current level's uncommitted edits and return to the parent without altering it.

Saving edits to a nested module updates the shared definition of that nested module. External pin identities remain stable, so an edit cannot silently disconnect pre-existing wires. For this first editor, keep the original boundary INPUT and LED components; add or remove internal gates freely. If you need a different number of boundary pins, capture a new block with the desired interface.

While editing internals, the app persists the last committed parent schematic, **not the temporary draft**. Save the block before refreshing. Existing v1 Signal Lab and Analog Lab documents remain compatible.

## Verify locally

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous release notes

# CircuitBuilder v0.6 — Signal Lab Modules + Waveform Tools

CircuitBuilder has two separate neon pixel-art workbenches: Analog Lab and Signal Lab. This release expands **Signal Lab** with *reusable circuit blocks*, a four-channel logic-event waveform graph, and a typed input-vector tester.

## Condense a circuit into a block
1. Create a combinational digital circuit with one or more **INPUT switches**, at least one gate (or existing block), and one or more **LED outputs**.
2. Open **Signal Lab → Parts Library → Reusable Circuit Blocks → Capture Current Circuit**.
3. Give the module a descriptive name and click **Save as Block**.
4. INPUT switches automatically become external module **IN** pins and LED indicators become **OUT** pins. The full circuit is stored as an immutable module definition.
5. The current workspace is replaced with the condensed block and wired input/output controls. **Undo** brings back the original uncondensed design.
6. Find the block under **Reusable Circuit Blocks**. Drag or click to insert another instance into an existing or newly created circuit. Each instance has isolated internal gate state and independently connected pins.

Saved modules persist in their own browser library. Exported Signal Lab schematics embed their referenced module definitions and dependencies, so imported circuits remain portable. Larger blocks can contain instances of smaller blocks; self-referential definitions are rejected.

Blocks support up to 12 external inputs and 12 outputs. Module definitions are snapshots: changing the source circuit afterward does not retroactively alter already saved modules. Regenerate a new module to publish an updated design.

## Signal waveform probing
- Right-click any **wire** and choose **Graph This Wire**, or right-click a component and choose **Probe** beside a named pin.
- Alternatively, choose up to **four** pins/wires in the **WAVEFORM** panel.
- Switch inputs to record a waveform, or enter a series of vectors in INPUT TEST. The chart plots the resulting 0/1/X/Z states against **input-change event number**.
- Click the graph or enter an exact **Event #** to inspect the states recorded at that event, then use previous/next buttons.
- The buffer stores the last 160 changes and can be reset.

**Important:** A combinational simulator evaluates logic without real nanosecond timing or physical gate propagation delays. Therefore this chart is an **event history**, not an oscilloscope with real propagation-time measurements. Clock sources, propagation delays and sequential logic are future upgrades.

## Type binary inputs and read outputs
Open **INPUT TEST** in Signal Lab:
- Enter a binary vector matching the number of INPUT switches (e.g. \`01\` for two inputs).
- Click **Apply & Evaluate** to set every switch simultaneously and immediately read the LED output vector.
- Enter a comma-separated sequence such as \`00, 01, 11, 10\` to step through several input combinations; the waveform panel records each event. Up to 32 vectors per submitted sequence.
- Input order and output order are shown explicitly, using the circuit's component order.

The digital engine supports four states: HIGH 1, LOW 0, undefined/conflict X, and undriven Z. Truth tables and embedded blocks use the same pure Boolean evaluation engine.

## Development
\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

This release retains the existing **Analog Lab** with its separate Modified Nodal Analysis and transient engine. It also preserves compatibility with previous Signal Lab documents lacking reusable blocks.

---

## Previous release notes

# CircuitBuilder v0.5 · Analog Lab + Signal Lab

Two neon pixel-art electronics laboratories, one React/TypeScript application.

## Switch labs
Use the laboratory navigator across the top of the app:
- **01 Analog Lab:** existing analog DC and RLC simulation workbench. The underlying Modified Nodal Analysis engine and saved analog schematics remain intact.
- **02 Signal Lab:** a standalone Boolean logic engine, its own editor, local autosave, and dedicated .signal.json document schema.

### Signal Lab v0.1 — what's included
- **Eight gates:** AND, OR, NOT, XOR, NAND, NOR, XNOR, BUFFER.
- **Inputs:** click an INPUT switch to change between 0 and 1.
- **Outputs:** LED indicators glow for HIGH, dim for LOW, pink for undefined.
- **Digital netlist and logic engine:** electrically connected terminals drive signal nets; switching inputs instantly recomputes results. There is no analog solver dependency.
- **Four-state simulation:** HIGH (1), LOW (0), unknown/conflict (X), and undriven (Z). Multiple output drivers on a net are flagged as conflicts. Floating gate inputs are reported.
- **Automatic truth tables:** enumerate every combination of up to six input switches, including all LED outputs (up to 64 rows).
- **Retro editor:** glowing signal traces, pixel-drawn gates, snap/pan/zoom, free-ended wires and junctions, right-click editing, multi-select, copy/paste, undo/redo.
- **Examples:** XOR Playground, AND Gate Lab, NOT Gate Lab and a two-output half adder.

### Quick start in Signal Lab
1. Click **SIGNAL LAB** in the top lab switcher.
2. Drop two INPUT components, one gate, and an LED.
3. Click terminal pins to connect. You may leave a wire dangling in empty space and attach it later.
4. Click the INPUT switches to toggle their bits. Observe live wire colors and LED state.
5. Open **TRUTH TABLE** and click **GENERATE TRUTH TABLE** to evaluate all input permutations.
6. Export via **FILE → EXPORT .SIGNAL.JSON**, import later through the same menu.

Signal files include \`"lab": "signal"\` and \`"version": 1\`, preventing accidental loading into Analog Lab. Each lab maintains its own browser autosave; switching labs does not delete the other lab's work.

### Visual semantics
- HIGH/1: luminous mint green, with animated propagation markers.
- LOW/0: dim blue.
- X: bright pink for invalid or undefined results.
- Z: gray for undriven signals.

Signal animations are decorative representations of logical HIGH propagation, not a physical delay or current model. Pure trace crossings do not connect; free-end junctions and terminal contacts do.

### Scope
Signal Lab currently handles **combinational logic**. Clocks, flip-flops, buses, counters, propagation delay and waveform timing are future milestones; feedback that fails to stabilize returns X. This engine is separate from Analog Lab's DC/transient solver.

## Development
Requires Node.js 20+ (22 recommended).

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

GitHub Actions validates both laboratories on each pull request.

---

## Previous Analog Lab release notes

# CircuitBuilder v0.4 — Arcade Editor Polish

**Latest:** animated conventional-current particles on electrically unbranched wires, voltage-based neon coloring, deliberately marked junctions, undo/redo, group editing, quick SI-unit input, and hideable panels. The physics is still computed by the existing DC / transient MNA solvers.

## A calmer workbench

- Top toolbar consolidates **Undo**, **Redo**, **Copy**, **Paste**, **DC**, **RLC**, and toggles for the **Parts** and **Panel** sidebars.
- The right sidebar now has **INSPECT / SIMULATE** tabs; shortcuts are tucked under an expandable reference.
- Circuit presets remain in **Parts Library → Instant Labs** (collapsed by default).
- The schematic hides voltage text on unrelated components until selected, while highlighting the selected component's A-terminal net or the selected wire's entire electrical net.
- `◉ FLOW` on the lower right of the canvas toggles the animation. The preference persists, and operating systems requesting reduced motion disable the effect.

## Editing shortcuts

| Action | Shortcut or gesture |
| --- | --- |
| Undo / redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z (Ctrl+Y also redoes) |
| Multi-select | Shift-click several components |
| Move selection | Drag any selected component to move them together |
| Select all | Ctrl/Cmd+A |
| Copy / paste | Ctrl/Cmd+C / Ctrl/Cmd+V |
| Duplicate | Ctrl/Cmd+D |
| Rotate | R |
| Delete selected parts / wire | Delete / Backspace |
| Move a free wire end | Shift-drag its glowing endpoint |
| Straighten a wire | Right-click wire → STRAIGHTEN ROUTE |
| Edit values | Type `4.7k`, `100uF`, `10mH`, `5mA`, etc., then Enter or leave the field |

Copy/paste recreates internal wires for selected components using new component and wire IDs. A drag creates one undo-history entry instead of hundreds of entries for each mouse movement. History is limited to the last 80 editing actions; it is not persisted between browser reloads. Existing circuit JSON files remain schema version 1.

## Electrical honesty of the animation

Animated dots represent **conventional current** (positive charge-flow direction), derived from signed simulated branch currents. They are intentionally shown only when a wire belongs to an electrically unbranched net with two terminals and a single wire. On branching and ideal-wire networks, segment current distribution may not be uniquely determined by the ideal circuit model, so those traces remain illuminated according to their **simulated node voltage** without misleading directional particles. Particle speed is illustrative, not a physical drift velocity or calibrated current meter. Use the inspector and time panel for quantitative readings.

## Transient resolution

The Time Machine exposes **60, 120, 240, and 500 sample steps** across the chosen time window. Higher steps improve time resolution at increased computational cost. The solver still assumes constant DC excitation from t=0 with initially uncharged capacitors and zero inductor currents (Backward Euler, fixed-step).

---
## Troubleshooting electrical connections (v0.3 repair)

Component terminals placed directly on a drawn wire now electrically connect to the trace. Previously, the graph could show an attached pin but omit it from the solver, leading to a misleading singular-matrix error. Pure wire crossings without endpoints still do not join.

If DC analysis reports a floating node, its message names affected component pins (for example R2.A). Check those contacts. Capacitors and open switches do not conduct in steady-state DC even when correctly wired; use transient analysis for charging behavior.

If an ideal voltage source is shorted by a wire, you receive a direct short diagnosis. Parallel ideal sources and loops of ideal shorts can also make the equations singular.

---
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
