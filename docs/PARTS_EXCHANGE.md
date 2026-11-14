# Parts Exchange and Studio graphics

Open **Parts Exchange** from the header in any lab. It connects experiments through explicit module copies and adapters. The shared library and display preferences are saved in this browser; exporting JSON creates a portable backup.

## Share a digital circuit

1. Build a circuit in Signals or Computer Builder. Name its INPUT switches and LED outputs; those become the module's boundary ports. A module needs at least one input, one output, and one gate or block, with at most 12 inputs and 12 outputs.
2. Open **Shared modules**, enter a name, and click **Publish module**. This saves a snapshot without condensing or changing your working circuit.
3. Use the module test bench to toggle its inputs and inspect the actual simulated output bits. Preview changes stay in the preview. Clocked parts are shown at their reset state.
4. Choose **Use in Signals** or **Use in Computer**. An independent instance is added to that lab's existing schematic; connect its labeled pins. Undo removes the addition.
5. **Edit a working copy** opens the internal circuit in Signals after confirming replacement of that workspace. Save a named project copy first if you want to retain the current working schematic. Publish a new snapshot to share edits.

**Export module** creates a `.cbmodule.json` package containing the root and only its required nested definitions. Import gives every definition a new identity. Existing modules and projects keep their definitions when another copy is edited or imported. Imports validate ports, dependency references, nesting, recursion, and expansion before changing the library.

The library holds up to 80 definitions. Module files must be smaller than 1 MB; existing digital hierarchy limits of eight nesting levels, 1,600 expanded components, and 4,000 expanded wires also apply.

## Signals → Computer: build the actual ALU

1. In **Connected projects**, choose **Open ALU workshop**. Confirm replacement of the Signals working project. The canvas fits the complete circuit; zoom in to inspect each bit slice.
2. Follow the named nets between the full adders, AND/OR/XOR gates, and multiplexers. Inputs are `A0`–`A3`, `B0`–`B3`, `OP0`–`OP1`; outputs are `Y0`–`Y3`. Bit 0 is least significant. Named nets connect within their module's namespace.
3. Publish it. In the test bench, enter operands from 0–15 and choose an operation: `00` ADD, `01` AND, `10` OR, `11` XOR. The four-bit result wraps modulo 16.
4. Choose **Build computer with this ALU** and confirm replacement of the Computer working project. Step its clock and inspect the accumulator/output bits. The former ALU primitive has been replaced by your module; the hardware simulator executes its gates.

The builder recognizes the boundary port names, so your own circuit with the same interface can be used. This example is the PC/ROM/ALU/accumulator educational datapath. It does not replace the internal ALU of the CASM CPU4 instruction core or define a custom instruction set. Save a Computer project copy before replacing a CASM project.

## Signals → Robotics: logic becomes a controller

Open the enable-gate connected project, publish it, and choose **Use in Robotics**. Click **Attach module** to accept the incoming copy. Review the input sensor mappings and output actuator mappings, then **Upload & run**.

The example maps its inputs to the button and proximity signal. Press the button and bring the distance below the configured threshold: the real AND output turns on the green LED. Remap that output to the servo, upload again, and HIGH commands 90° while LOW commands 0°.

The adapter evaluates the actual combinational circuit against bench inputs every 50 virtual milliseconds during playback, or 100 ms when stepping. It supports up to 200 expanded primitives and rejects clocked parts. Unconnected sensors read LOW. X/Z mapped outputs and conflicting output pins produce faults instead of invented actuator values. Mapping and pin changes stop/reset the controller until another upload.

The attached circuit is a snapshot. JSON exports include that snapshot and its mappings; the current MicroScript source and wiring are retained. See [Robotics Lab](ROBOTICS_LAB.md) for runtime controls and the bench model.

## Analog → Signals: sample a threshold crossing

Run a DC or transient analysis in Analog. Open **Voltage adapter**, choose a component terminal, and enter a threshold in volts. The displayed node voltage is measured to ground; transient readings follow the selected time cursor.

`voltage >= threshold` produces HIGH; lower values produce LOW. **Add sampled source to Signals** appends a fixed source to the Signals project. An invalidated or missing solution cannot be sampled. This transfers one value, not a live mixed-signal simulation; rerun and transfer another sample to refresh it.

## Graphics and animation

**Display** switches between Studio circuit symbols and the Classic neon style. Studio adds conventional gate shapes, IC pin labels and hexadecimal readouts, shaded sources/resistors, LEDs, and a capacitor voltage fill. Resistor bands encode the actual resistance where it has a representable color code. Capacitor fill shows voltage magnitude relative to the circuit's largest independent voltage source (at least 1 V); it is a visual cue, not an additional charge solver.

Signal changes and clock steps trigger bounded 650 ms highlights. Static digital HIGH does not animate indefinitely or imply propagation delay. Analog directional flow uses only solved, unambiguous conventional current. Robotics connection flashes and LED/servo transitions follow real sensor and output values; commanded values change independently of interpolation. CPU highlights replay for the executed instruction.

Turn off **Animate state changes** to stop motion across the app. The local canvas controls can further disable flow or signal motion. Operating-system reduced motion takes precedence and disables all animation and transitions. Display changes never edit circuit data, advance clocks, or alter simulation results.
