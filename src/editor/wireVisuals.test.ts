import { describe, expect, it } from 'vitest';
import { starterCircuit, switchCircuit } from '../circuit/sample';
import { circuitNodes } from '../circuit/connectivity';
import { solveDC } from '../simulation/dc';
import { unbranchedWireCurrents, junctionPoints, voltageTint } from './wireVisuals';

describe('electrically grounded neon wire visuals', () => {
  it('assigns conventional current direction to a two-terminal series net', () => {
    const doc = starterCircuit();
    const nodes = circuitNodes(doc);
    const currents = unbranchedWireCurrents(doc, solveDC(doc), nodes.wireNodes);
    expect(currents.w1).toBeCloseTo(.005, 9); // voltage source + -> resistor A
    expect(currents.w2).toBeCloseTo(.005, 9); // resistor B -> next resistor A
  });
  it('does not animate an open switch as if electricity were flowing', () => {
    const doc = switchCircuit();
    const currents = unbranchedWireCurrents(doc, solveDC(doc), circuitNodes(doc).wireNodes);
    expect(currents.sw1).toBeUndefined();
    expect(currents.sw2).toBeUndefined();
  });
  it('does not assign unmeasurable segment current to a branching junction', () => {
    const doc = starterCircuit();
    doc.wires.push({
      id: 'extra',
      from: { componentId: 'v1', pin: 'b' },
      to: { x: 144, y: 396 },
    });
    const nodes = circuitNodes(doc);
    const currents = unbranchedWireCurrents(doc, solveDC(doc), nodes.wireNodes);
    expect(currents.w4).toBeUndefined();
  });
  it('shows a node dot only at intentional free-end junctions', () => {
    const doc = starterCircuit();
    doc.wires.push({ id: 'junction', from: { x: 456, y: 168 }, to: { x: 456, y: 240 } });
    expect(junctionPoints(doc)).toContainEqual({ x: 456, y: 168 });
    expect(junctionPoints(starterCircuit())).toHaveLength(0);
  });
  it('uses actual voltage polarity for glow tint', () => {
    expect(voltageTint(10)).toBe('#ffcb83');
    expect(voltageTint(-10)).toBe('#9fafff');
    expect(voltageTint(0)).toBe('#5bffcb');
  });
});
