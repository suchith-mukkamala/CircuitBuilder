import { describe, expect, it } from 'vitest';
import { runTransient } from './transient';
import { solveDC } from './dc';
import { isCircuitDocument, CircuitDocument } from '../circuit/types';

function sourceAndPassive(kind: 'capacitor' | 'inductor'): CircuitDocument {
  return {
    version: 1, name: 'step response',
    components: [
      { id: 'v', kind: 'voltage_source', x: 0, y: 0, rotation: 0, value: 10 },
      { id: 'r', kind: 'resistor', x: 240, y: 0, rotation: 0, value: 1000 },
      { id: 'p', kind, x: 480, y: 0, rotation: 0, value: kind === 'capacitor' ? .0001 : 1 },
      { id: 'g', kind: 'ground', x: 240, y: 240, rotation: 0, value: 0 },
    ],
    wires: kind === 'capacitor' ? [
      { id: '1', from: { componentId: 'v', pin: 'a' }, to: { componentId: 'r', pin: 'a' } },
      { id: '2', from: { componentId: 'r', pin: 'b' }, to: { componentId: 'p', pin: 'a' } },
      { id: '3', from: { componentId: 'p', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
      { id: '4', from: { componentId: 'v', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
    ] : [
      { id: '1', from: { componentId: 'v', pin: 'a' }, to: { componentId: 'r', pin: 'a' } },
      { id: '2', from: { componentId: 'r', pin: 'b' }, to: { componentId: 'p', pin: 'a' } },
      { id: '3', from: { componentId: 'p', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
      { id: '4', from: { componentId: 'v', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
    ],
  };
}

describe('transient capacitor and inductor analysis', () => {
  it('RC capacitor charges from 0 toward 10 V with τ=RC=0.1s', () => {
    const doc = sourceAndPassive('capacitor');
    const r = runTransient(doc, { duration: .5, steps: 500 });
    expect(r.frames).toHaveLength(501);
    expect(r.frames[0].readings.p.voltage).toBeCloseTo(0, 10);
    const atTau = r.frames[100].readings.p.voltage;
    expect(atTau).toBeCloseTo(10 * (1 - Math.exp(-1)), 1);
    expect(r.frames[500].readings.p.voltage).toBeGreaterThan(9.9);
    expect(r.frames[500].readings.r.current).toBeGreaterThan(0);
    expect(solveDC(doc).readings.p.current).toBeCloseTo(0, 10);
  });

  it('RL current rises from zero toward 10 mA with τ=L/R=0.001s', () => {
    const doc = sourceAndPassive('inductor');
    const r = runTransient(doc, { duration: .01, steps: 500 });
    expect(r.frames[0].readings.p.current).toBeCloseTo(0, 10);
    expect(r.frames[50].readings.p.current).toBeCloseTo(.01 * (1 - Math.exp(-1)), 4);
    expect(r.frames[500].readings.p.current).toBeCloseTo(.01 * (1 - Math.exp(-10)), 6);
    expect(solveDC(doc).readings.p.voltage).toBeCloseTo(0, 10);
    expect(solveDC(doc).readings.p.current).toBeCloseTo(.01, 8);
  });

  it('samples in monotonic time and allows frame inspection', () => {
    const data = runTransient(sourceAndPassive('capacitor'), { duration: .25, steps: 25 });
    expect(data.frames[1].time).toBeCloseTo(.01);
    expect(data.frames[25].time).toBeCloseTo(.25);
    expect(data.frames[15].readings.p.voltage).toBeGreaterThan(data.frames[5].readings.p.voltage);
  });

  it('rejects invalid duration or no reactive parts', () => {
    expect(() => runTransient(sourceAndPassive('capacitor'), { duration: -1 })).toThrow(/duration/i);
    const d = sourceAndPassive('inductor');
    d.components = d.components.filter(c => c.id !== 'p');
    d.wires = d.wires.filter(w => !('componentId' in w.from && w.from.componentId === 'p') &&
      !('componentId' in w.to && w.to.componentId === 'p'));
    expect(() => runTransient(d)).toThrow(/capacitor or inductor/i);
  });

  it('accepts free-ended wire coordinates and later connects pin placed at free end', () => {
    const doc = sourceAndPassive('capacitor');
    // Replace one resistor-capacitor connection by two free wire stubs.
    // Each stub ends at one shared coordinate; connectivity must join.
    const changed = doc.wires.find(w => w.id === '2')!;
    changed.to = { x: 384, y: -48 };
    doc.wires.push({
      id: 'spur', from: { x: 384, y: -48 }, to: { componentId: 'p', pin: 'a' },
    });
    expect(isCircuitDocument(doc)).toBe(true);
    expect(solveDC(doc).readings.r.current).toBeCloseTo(0, 10);
    expect(runTransient(doc, { duration: .2, steps: 100 }).frames[100].readings.p.voltage).toBeGreaterThan(8);
  });

  it('rejects malformed endpoint while importing', () => {
    const doc = sourceAndPassive('capacitor');
    doc.wires[0].to = { x: Infinity, y: 5 };
    expect(isCircuitDocument(doc)).toBe(false);
  });
});
