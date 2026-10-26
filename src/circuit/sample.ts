import type { CircuitDocument, CircuitComponent, Terminal, Wire } from './types';

function component(id: string, kind: CircuitComponent['kind'], x: number, y: number, value: number,
  rotation: CircuitComponent['rotation'] = 0, extra: Partial<CircuitComponent> = {}): CircuitComponent {
  return { id, kind, x, y, value, rotation, ...extra };
}
function pin(componentId: string, name: Terminal['pin']): Terminal {
  return { componentId, pin: name };
}
function wire(id: string, fromId: string, fromPin: Terminal['pin'],
  toId: string, toPin: Terminal['pin']): Wire {
  return { id, from: pin(fromId, fromPin), to: pin(toId, toPin) };
}

/** Keep the original voltage divider as the default document and v0.1 regression fixture. */
export function starterCircuit(): CircuitDocument {
  const components: CircuitComponent[] = [
    component('v1', 'voltage_source', 144, 288, 10),
    component('r1', 'resistor', 336, 168, 1000),
    component('r2', 'resistor', 528, 288, 1000, 90),
    component('g1', 'ground', 336, 432, 0),
  ];
  return {
    version: 1, name: 'Voltage divider', components,
    wires: [
      { ...wire('w1', 'v1', 'a', 'r1', 'a'), waypoints: [{ x: 144, y: 168 }] },
      { ...wire('w2', 'r1', 'b', 'r2', 'a'), waypoints: [{ x: 528, y: 168 }] },
      { ...wire('w3', 'r2', 'b', 'g1', 'g'), waypoints: [{ x: 528, y: 396 }] },
      { ...wire('w4', 'g1', 'g', 'v1', 'b'), waypoints: [{ x: 144, y: 396 }] },
    ],
  };
}

/** Open switch disconnects the load; click or toggle it to supply 10 V. */
export function switchCircuit(): CircuitDocument {
  return {
    version: 1, name: 'Neon switch lab',
    components: [
      component('v1', 'voltage_source', 144, 288, 10),
      component('s1', 'switch', 336, 168, 0, 0, { closed: false }),
      component('r1', 'resistor', 528, 288, 1000, 90),
      component('g1', 'ground', 336, 432, 0),
    ],
    wires: [
      wire('sw1', 'v1', 'a', 's1', 'a'),
      wire('sw2', 's1', 'b', 'r1', 'a'),
      wire('sw3', 'r1', 'b', 'g1', 'g'),
      wire('sw4', 'g1', 'g', 'v1', 'b'),
    ],
  };
}

/** 5 mA current source feeds 1 kΩ resistor -> 5 V. */
export function currentSourceCircuit(): CircuitDocument {
  return {
    version: 1, name: 'Current injection lab',
    components: [
      component('i1', 'current_source', 144, 288, 0.005),
      component('r1', 'resistor', 432, 288, 1000, 90),
      component('g1', 'ground', 288, 456, 0),
    ],
    wires: [
      wire('ci1', 'i1', 'a', 'g1', 'g'),
      wire('ci2', 'i1', 'b', 'r1', 'a'),
      wire('ci3', 'r1', 'b', 'g1', 'g'),
    ],
  };
}

/** Three-terminal 1k potentiometer with 10k load. Wiper around 4.762V at 50%. */
export function potentiometerCircuit(): CircuitDocument {
  return {
    version: 1, name: 'Potentiometer lab',
    components: [
      component('v1', 'voltage_source', 144, 288, 10),
      component('p1', 'potentiometer', 360, 240, 1000, 0, { wiper: 0.5 }),
      component('r1', 'resistor', 552, 360, 10000, 90),
      component('g1', 'ground', 360, 480, 0),
    ],
    wires: [
      wire('p1', 'v1', 'a', 'p1', 'a'),
      wire('p2', 'p1', 'b', 'g1', 'g'),
      wire('p3', 'p1', 'w', 'r1', 'a'),
      wire('p4', 'r1', 'b', 'g1', 'g'),
      wire('p5', 'v1', 'b', 'g1', 'g'),
    ],
  };
}


/** 10 V step into 1 kΩ and 100 µF. Time constant: 100 ms. */
export function rcCircuit(): CircuitDocument {
  const doc = starterCircuit();
  doc.name = 'RC charging lab';
  doc.components = doc.components.map(c => c.id === 'r2'
    ? { ...c, kind: 'capacitor', value: .0001 } : c);
  return doc;
}

/** 10 V step into 1 kΩ and 1 H. Time constant: 1 ms. */
export function rlCircuit(): CircuitDocument {
  const doc = starterCircuit();
  doc.name = 'RL inductor lab';
  doc.components = doc.components.map(c => c.id === 'r2'
    ? { ...c, kind: 'inductor', value: 1 } : c);
  return doc;
}
