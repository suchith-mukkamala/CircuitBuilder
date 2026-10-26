import type { CircuitDocument, CircuitComponent } from './types';

export function starterCircuit(): CircuitDocument {
  const components: CircuitComponent[] = [
    { id: 'v1', kind: 'voltage_source', x: 144, y: 288, rotation: 0, value: 10 },
    { id: 'r1', kind: 'resistor', x: 336, y: 168, rotation: 0, value: 1000 },
    { id: 'r2', kind: 'resistor', x: 528, y: 288, rotation: 90, value: 1000 },
    { id: 'g1', kind: 'ground', x: 336, y: 432, rotation: 0, value: 0 },
  ];
  return {
    version: 1,
    name: 'Voltage divider',
    components,
    wires: [
      { id: 'w1', from: { componentId: 'v1', pin: 'a' }, to: { componentId: 'r1', pin: 'a' }, waypoints: [{ x: 144, y: 168 }] },
      { id: 'w2', from: { componentId: 'r1', pin: 'b' }, to: { componentId: 'r2', pin: 'a' }, waypoints: [{ x: 528, y: 168 }] },
      { id: 'w3', from: { componentId: 'r2', pin: 'b' }, to: { componentId: 'g1', pin: 'g' }, waypoints: [{ x: 528, y: 396 }] },
      { id: 'w4', from: { componentId: 'g1', pin: 'g' }, to: { componentId: 'v1', pin: 'b' }, waypoints: [{ x: 144, y: 396 }] },
    ],
  };
}
