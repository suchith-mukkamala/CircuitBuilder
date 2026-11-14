# Lab 04 — Robotics & control

The first milestone is a browser-based controller bench. Open **Robotics** in the main navigation, or visit `/#robotics`.

## Start experimenting

1. Choose **Traffic light**, **Automatic door**, or **Obstacle detector**.
2. Click **Upload & run** (Ctrl/Cmd+Enter). The program repeats from top to bottom.
3. Change the distance slider, analog dial, or button input. The button toggles between pressed and released.
4. Pause the controller and use **Step 100 ms** to advance virtual time. **Reset** pauses, clears outputs, and returns the clock to zero while retaining your program and connections.
5. Edit the code, then upload again. Until upload, the controller continues using its previous program. Changing the pin map clears the uploaded program and resets the controller.

Projects save in browser local storage. Export `.robotics.json` for a separate backup. Import validates the document before replacing anything; modified projects require confirmation. Reloading or leaving the lab keeps the draft and wiring, but stops and clears the running controller. Upload again to resume an experiment.

## MicroScript

MicroScript is a small line-based teaching language. It is not Arduino C++, JavaScript, or an instruction-set emulator. No source text is evaluated with `eval` or `Function`.

| Command | Behavior |
| --- | --- |
| `write D2 HIGH` | Set digital output D2 to 1. `LOW`, `0`, and `1` are also accepted. |
| `servo D5 90` | Set the servo connected to D5 to 90 degrees; allowed angles are 0–180. |
| `wait 1000` | Wait 1,000 virtual milliseconds. Accepted range: 1–60,000 ms. |
| `if distance < 35` | Execute the next block when the sensor is below 35 cm. |
| `else` | Optional alternate block for the preceding `if`. |
| `end` | Close an `if` block. |
| `# comment` | Ignore the rest of the line. |

Commands and pin names are case-insensitive. Use one instruction per line; indent for readability. Every repeating path must eventually wait. Conditions support `<`, `>`, `<=`, `>=`, `==`, and `!=`, comparing a named input or pin against an integer, HIGH, or LOW. Up to eight nested conditions, 300 source lines, and 16,000 characters are supported.

### Inputs and default wiring

| Device | Default pin | Value |
| --- | --- | --- |
| Button | D0 | Released = 0; pressed = 1 |
| Distance sensor | A0 | 0–400 centimeters |
| Analog dial | A1 | 0–1023 |
| Red LED | D2 | LOW = off; HIGH = on |
| Amber LED | D3 | LOW = off; HIGH = on |
| Green LED | D4 | LOW = off; HIGH = on |
| Servo | D5 | 0–180 degrees |

Read inputs as `button`, `distance`, and `knob`, or use their currently assigned pin names. For example, after moving the distance sensor to A1, `if A1 < 35` and `if distance < 35` read the same centimeter value. Unconnected inputs read zero. Unassigned digital pins read their output bit. Servo angle appears separately in the monitor; conditions on a servo pin still read the digital bit.

The pin map allows D0–D7 for digital devices and A0–A1 for analog devices. Inputs cannot share a pin with another device. Multiple LED loads may share an output, but the servo needs its own pin. Conflicts block upload. Writing to an input pin is a compile error; use `servo` rather than `write` on a servo pin.

### Example: sensor-operated door

```text
if distance < 35
  servo D5 90
  write D4 HIGH
else
  servo D5 0
  write D4 LOW
end
wait 50
```

Bring the sensor below 35 cm: the servo moves to 90° and the indicator turns on. At exactly 35 cm it closes. The condition is checked every 50 virtual milliseconds.

## Simulation model

- A pure interpreter advances in 50 ms virtual ticks during playback. Paused stepping advances 100 ms. Wait boundaries execute at their exact virtual time, independently of how ticks are grouped.
- Background tab throttling slows playback rather than skipping time. Leaving the lab clears its timer.
- Runtime execution is bounded. A path that loops without waiting stops with an actionable fault. Event history retains the latest 80 output changes.
- The bench models ideal logical connections with power and ground provided. It does not calculate electrical currents, PWM pulses, motor torque, or mechanical collisions. The commanded servo angle updates immediately; its visual movement is a presentation effect.
- The MicroScript interpreter is separate from the Analog and Signal engines. A shared logic controller can evaluate a Signals circuit against the bench inputs using the adapter described below.

## Drive the bench with a Signals module

In **Parts Exchange → Connected projects**, open the enable-gate project in Signals. Publish a module, choose **Use in Robotics**, and click **Attach module** on the bench. The incoming proposal does not replace anything until attached; attaching keeps the current MicroScript source and pin map.

Map each input switch to the button, distance-below-threshold, or dial-at-or-above-threshold signal. Map outputs to separate LEDs or the servo (LOW = 0°, HIGH = 90°); leave unused outputs unmapped. Each driven output needs its own pin. Upload the module and experiment with the real bench inputs. Pause and step use the same virtual-time controls as MicroScript.

The adapter supports combinational circuits with up to 200 expanded primitives. Clocked components are rejected; unknown or floating mapped outputs fault visibly. Unconnected sensors read LOW. Editing a mapping, threshold, or pin stops and resets the uploaded controller until another upload. JSON exports include the circuit snapshot and mappings, and reloads require another upload.

Use **Edit circuit in Signals** to open an independent working copy. Publish and attach a revision when ready. Editing a copy never silently changes the running controller. Switch **Controller** back to MicroScript or detach the module to use the retained source.

See [Parts Exchange](PARTS_EXCHANGE.md) for the complete workflow.

The next substantial milestone is a moving robot arena driven by these controller inputs and outputs. Hardware emulation, full Arduino support, and physical sensor models are separate future work.

## Verify

```bash
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite exercises all four labs at desktop and phone sizes, including analog analysis, digital workspace isolation, CASM injection, traffic-light timing, sensor/servo behavior, draft isolation, rewiring, persistence, and import/export.
