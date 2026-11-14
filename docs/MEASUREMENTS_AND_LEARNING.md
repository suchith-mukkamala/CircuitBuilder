# Measure and learn in the existing labs

## Analog: click-to-measure

Run **DC** for steady-state results or **RLC** for a time-domain result. Clicking a wire shows its node voltage. Clicking a component body shows the signed voltage across it (A − B), current (A → B, or A → W for a potentiometer), and absorbed power. Negative power means the component delivers energy to the circuit.

Choose **Inspect points** above the canvas to click a terminal, wire, or component without editing it. In Edit & wire mode, terminal clicks still create wires; Inspect mode separates measurement from editing. Middle-drag or dragging blank canvas pans, the wheel zooms about the pointer, and Fit centers the circuit. Escape closes a readout or cancels a pending wire. On phones, measurements appear below the canvas so the card cannot block the next probe point.

Node voltages use ground as their default reference. To compare two points:

1. Inspect the reference terminal or wire.
2. Choose **Use as reference**.
3. Inspect another point. The readout is V(point) − V(reference).
4. Choose **Use ground** to return to the 0 V reference.

All points on one ideal net have the same voltage. A node does not have one unique current: current divides between branches, and ideal wire-segment currents are not always uniquely determined. Select a component to measure its branch current. Geometric wire crossings do not connect unless an actual terminal or endpoint forms a junction; the selected electrical net is highlighted.

Editing a circuit invalidates its results. A readout then asks for another analysis instead of retaining stale voltages. Removing a probe target removes its readout. If a custom reference was removed, the display identifies that missing reference; select Use ground or another reference.

### Transient instrument

Choose a primary component and optionally a comparison component, then select voltage or current. Both traces use the same units and vertical scale. Auto-scale includes zero; turn it off to enter a minimum and maximum in volts or amps. Invalid limits temporarily fall back to auto-scale.

Drag the graph or move the Simulation time slider to choose a sample. The canvas, point readouts, and trace values all use the same frame. **Expand graph** opens a larger, keyboard-accessible instrument. Time controls retain the simulator's existing backward-Euler behavior: constant sources step on at t = 0, capacitors start uncharged, and inductors start at zero current.

## Signals: inspect and test

Click a wire or chip for its states, or use Inspect points to read an exact terminal without toggling an input. Readouts distinguish:

| State | Meaning |
| --- | --- |
| HIGH / 1 | A driven logical one |
| LOW / 0 | A driven logical zero |
| X | An unknown or conflicting value |
| Z | An undriven terminal/net |

These are Boolean states, not simulated analog voltages. Bus readouts display bits from most significant to least significant and the unsigned decimal/hexadecimal value when every bit is known. Bit 0 is the least significant bit.

**Record waveform** attaches a probe to the inspected pin or wire and opens the existing event analyzer. Its horizontal axis records input-change/clock events, not physical propagation time. The Tools menu provides the analyzer, input tests, and the truth table.

Generate a truth table, then choose **Apply** beside a row to set those inputs in the actual circuit. The live row is highlighted and outputs update using the same digital engine.

## Computer Builder: follow instructions

The guided 3 + 5 project loads a complete CASM CPU and opens Code Studio. Step through LDI, ADD, OUT, and HLT. The explanation is derived from the actual register transition and executed instruction byte, with live datapath values underneath. Highlighted blocks belong to the last instruction; the ROM readout shows the instruction at the current PC, including the HLT instruction when stopped.

The next source line is marked only when the editor's assembled bytes match the ROM. Draft edits do not alter the running hardware. Inject to apply them. CPU4 is a single-cycle teaching processor: one rising clock edge executes one instruction. The general Hardware clock step can also advance other sequential components in the circuit.

## Guided projects

Each of the first three labs has a Guided project strip. Loading a lesson asks before replacing the working circuit; save a project copy first if needed. Checklist steps are completed by actual simulation outcomes, including probing the divider's midpoint, testing the half-adder's four combinations, and reaching the CPU's expected register values. Lesson progress is session-local; the circuit itself remains editable and saved as usual.

## Saved copies and panel sizes

**Projects** opens a separate shelf per lab, with up to 12 named snapshots. Save new copy preserves the current circuit; Open restores a chosen snapshot after confirmation, and Replace/Delete affect only the selected saved copy. Computer snapshots also preserve CASM drafts, while runtime state and clock history reset on restore.

The active working circuit and named copies remain local to this browser. Export JSON for a portable backup. Indicators check the persisted working copy rather than unconditionally claiming success. If browser storage is full or blocked, editing and simulation continue in memory; export before leaving. A malformed shelf is reported and never silently overwritten.

On desktop, drag a divider beside Parts or the instrument panel to resize it. Focus a divider and use Left/Right arrows for keyboard resizing. Widths and open/closed preferences are saved separately for each lab. Phone panels stack vertically instead.

## Validation

```bash
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

Tests cover measurement polarity, node identity, crossing wires, time-frame accuracy, graph scaling, CPU explanations, snapshot validation, and storage failure. Desktop and phone browser workflows exercise the guides, reference measurements, chart controls, bus values, project restore, and all previously implemented Robotics Lab flows.
