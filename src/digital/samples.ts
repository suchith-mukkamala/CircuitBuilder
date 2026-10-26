import type { DigitalDocument, DigitalKind, DigitalComponent } from './types';
import { initialDigitalCircuit } from './types';

const part = (
  id: string, kind: DigitalKind, x: number, y: number,
  name?: string, bit?: 0 | 1,
): DigitalComponent => ({ id, kind, x, y, rotation: 0, ...(name ? { name } : {}),
  ...(bit === 0 || bit === 1 ? { bit } : {}) });
const term = (componentId: string, pin: 'a'|'b'|'in'|'out') => ({componentId,pin});
export function andDemo(): DigitalDocument {
  const base = initialDigitalCircuit();
  return { ...base, name: 'AND Gate Lab',
    components: base.components.map(c => c.kind === 'xor' ? {...c,kind:'and'} : c) };
}
export function notDemo(): DigitalDocument {
  return {
    version: 1, lab: 'signal', name: 'Digital NOT Lab',
    components: [
      part('a','input',168,228,'A',0),
      part('inv','not',384,228),
      part('led','led',600,228,'NOT A'),
    ],
    wires: [
      { id:'w1', from:term('a','out'),to:term('inv','a') },
      { id:'w2', from:term('inv','out'),to:term('led','in') },
    ],
  };
}
export function halfAdderDemo(): DigitalDocument {
  return {
    version: 1, lab: 'signal', name: 'Half Adder · SUM + CARRY',
    components: [
      part('a','input',132,168,'A',0),
      part('b','input',132,384,'B',1),
      part('xor','xor',396,204),
      part('and','and',396,372),
      part('sum','led',648,204,'SUM'),
      part('carry','led',648,372,'CARRY'),
    ],
    wires: [
      {id:'w1',from:term('a','out'),to:term('xor','a')},
      {id:'w2',from:term('a','out'),to:term('and','a')},
      {id:'w3',from:term('b','out'),to:term('xor','b')},
      {id:'w4',from:term('b','out'),to:term('and','b')},
      {id:'w5',from:term('xor','out'),to:term('sum','in')},
      {id:'w6',from:term('and','out'),to:term('carry','in')},
    ],
  };
}
