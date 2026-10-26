import { describe, expect, it } from 'vitest';
import {
  DigitalDocument, DigitalComponent, DigitalKind, isDigitalDocument,
  initialDigitalCircuit,
} from './types';
import { simulateLogic, evaluateGate, generateTruthTable } from './engine';
import { buildSignalNetwork, intentionalJunctions } from './network';
import { andDemo, halfAdderDemo, notDemo } from './samples';

const values: [0 | 1, 0 | 1][] = [[0,0], [0,1], [1,0], [1,1]];
function singleGate(kind: DigitalKind, a: 0|1, b: 0|1): DigitalDocument {
  const doc = initialDigitalCircuit();
  doc.components[0].bit = a;
  doc.components[1].bit = b;
  doc.components[2].kind = kind;
  return doc;
}
describe('digital gate truth functions', () => {
  const binary: Record<string, [number, number, number, number]> = {
    and: [0,0,0,1],
    or: [0,1,1,1],
    xor: [0,1,1,0],
    nand: [1,1,1,0],
    nor: [1,0,0,0],
    xnor: [1,0,0,1],
  };
  for (const [kind, expected] of Object.entries(binary)) {
    it(kind + ' matches all 4 Boolean combinations', () => {
      values.forEach(([a,b],i) => {
        const doc = singleGate(kind as DigitalKind, a,b);
        const result = simulateLogic(doc);
        expect(result.ledValues.led1).toBe(expected[i]);
        expect(result.warnings).toEqual([]);
      });
    });
  }
  it('NOT and BUFFER work as unary gates', () => {
    const doc = notDemo();
    expect(simulateLogic(doc).ledValues.led).toBe(1);
    doc.components[0].bit = 1;
    expect(simulateLogic(doc).ledValues.led).toBe(0);
    doc.components[1].kind = 'buffer';
    expect(simulateLogic(doc).ledValues.led).toBe(1);
  });
  it('handles undefined inputs conservatively with dominating gates', () => {
    expect(evaluateGate('and',0,'Z')).toBe(0);
    expect(evaluateGate('or',1,'Z')).toBe(1);
    expect(evaluateGate('xor',0,'Z')).toBe('X');
    expect(evaluateGate('nand',0,'X')).toBe(1);
    expect(evaluateGate('nor',1,'X')).toBe(0);
    expect(evaluateGate('not','Z')).toBe('X');
    expect(evaluateGate('buffer','X')).toBe('X');
  });
});
describe('signal network and four-state propagation', () => {
  it('uses a wire segment as an electrical net when a terminal is dropped onto it', () => {
    const doc = initialDigitalCircuit();
    // An extra LED placed with its IN terminal on the existing wire
    // from XOR.OUT (432,228) to the original LED.IN (576,228).
    doc.components.push({ id:'led2',kind:'led',x:552,y:228,rotation:0 });
    const solved = simulateLogic(doc);
    expect(solved.ledValues.led1).toBe(1);
    expect(solved.ledValues.led2).toBe(1);
    expect(solved.terminalNets['led2:in']).toBe(solved.terminalNets['led1:in']);
  });
  it('keeps a pure wire crossing disconnected', () => {
    const doc = initialDigitalCircuit();
    const before = simulateLogic(doc);
    doc.wires.push({
      id:'crossing',from:{x:480,y:180},to:{x:480,y:276},
    });
    const after = simulateLogic(doc);
    expect(after.ledValues.led1).toBe(before.ledValues.led1);
    expect(after.wireNets.crossing).not.toBe(after.wireNets.w3);
  });
  it('connects two wires sharing a free tip as an intentional junction', () => {
    const doc = initialDigitalCircuit();
    doc.wires.push(
      { id:'tip1',from:{componentId:'xor1',pin:'out'},to:{x:504,y:228} },
      { id:'tip2',from:{x:504,y:228},to:{componentId:'led1',pin:'in'} },
    );
    expect(intentionalJunctions(doc)).toContainEqual({x:504,y:228});
    const network = buildSignalNetwork(doc);
    expect(network.wires.tip1).toBe(network.wires.tip2);
  });
  it('marks disconnected gate inputs as Z and their output X', () => {
    const doc = andDemo();
    doc.wires = doc.wires.filter(w=>w.id!=='w2');
    const result = simulateLogic(doc);
    expect(result.terminalValues['xor1:b']).toBe('Z');
    expect(result.ledValues.led1).toBe(0); // A=0 dominates AND.
    expect(result.warnings.some(w=>w.includes('B has no driver'))).toBe(true);
  });
  it('flags multiple active output drivers and propagates an unknown', () => {
    const doc = initialDigitalCircuit();
    doc.wires.push({
      id:'short',from:{componentId:'a',pin:'out'},to:{componentId:'b',pin:'out'},
    });
    const result = simulateLogic(doc);
    expect(result.terminalValues['a:out']).toBe('X');
    expect(result.terminalValues['b:out']).toBe('X');
    expect(result.ledValues.led1).toBe('X');
    expect(result.warnings.some(w=>w.includes('multiple active outputs'))).toBe(true);
  });
  it('requires Signal Lab documents and guards against malformed pin references', () => {
    const doc = initialDigitalCircuit();
    expect(isDigitalDocument(doc)).toBe(true);
    expect(isDigitalDocument({version:1,name:'Analog',components:[],wires:[]})).toBe(false);
    doc.wires[0].to = {componentId:'led1',pin:'out'}; // nonexistent pin
    expect(isDigitalDocument(doc)).toBe(false);
  });
  it('preserves separate analog and signal circuit engines and schemas', () => {
    const doc = initialDigitalCircuit();
    expect(doc.lab).toBe('signal');
    expect(doc.version).toBe(1);
    expect(simulateLogic(doc).ledValues.led1).toBe(1);
  });
});
describe('automatic truth tables', () => {
  it('generates the four-row XOR truth table without mutating switch state', () => {
    const doc = initialDigitalCircuit();
    const originalBits = doc.components.filter(c=>c.kind==='input').map(c=>c.bit);
    const table = generateTruthTable(doc);
    expect(table.rows).toHaveLength(4);
    expect(table.rows.map(row=>row.outputs[0])).toEqual([0,1,1,0]);
    expect(doc.components.filter(c=>c.kind==='input').map(c=>c.bit)).toEqual(originalBits);
  });
  it('evaluates a half-adder with SUM and CARRY independently', () => {
    const table = generateTruthTable(halfAdderDemo());
    expect(table.outputs.map(c=>c.name)).toEqual(['SUM','CARRY']);
    expect(table.rows.map(row=>row.outputs)).toEqual([[0,0],[1,0],[1,0],[0,1]]);
  });
  it('rejects tables with no inputs, no LEDs, or more than six switches', () => {
    const empty: DigitalDocument = {version:1,lab:'signal',name:'empty',components:[],wires:[]};
    expect(()=>generateTruthTable(empty)).toThrow(/INPUT/i);
    empty.components.push({id:'sw',kind:'input',x:0,y:0,rotation:0,bit:0});
    expect(()=>generateTruthTable(empty)).toThrow(/LED/i);
    for(let i=0;i<6;i++) empty.components.push({
      id:'sw'+i,kind:'input',x:(i+1)*120,y:0,rotation:0,bit:0,
    });
    empty.components.push({id:'led',kind:'led',x:0,y:96,rotation:0});
    expect(()=>generateTruthTable(empty)).toThrow(/6 input switches/);
  });
});
