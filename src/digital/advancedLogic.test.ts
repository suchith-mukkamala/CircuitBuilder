import { beforeEach, describe, expect, it } from 'vitest';
import {
  DigitalDocument, DigitalKind, LogicBit, LogicValue,
  digitalKinds, gateKinds, inputsOf, outputsOf, pinsOf, pinAt,
  localPinAt, isDigitalDocument,
} from './types';
import { evaluateComponent, generateTruthTable, simulateLogic } from './engine';
import { captureBlock } from './blocks';
import { paletteCategories, searchParts, categoryByKind, allParts } from './catalog';
import { useDigitalStore } from './useDigitalStore';

const makeCircuit = (kind:DigitalKind, bits:LogicBit[], useConstants=false):DigitalDocument => {
  const gate = {id:'gate',kind,x:384,y:240,rotation:0 as const};
  const inputPins=inputsOf(gate),outputPins=outputsOf(gate);
  if (bits.length!==inputPins.length) throw Error('Wrong bit count for '+kind);
  const components:DigitalDocument['components']=[gate];
  const wires:DigitalDocument['wires']=[];
  inputPins.forEach((pin,i)=>{
    const local=localPinAt(gate,pin);
    const id='source'+i;
    components.push({id,kind:useConstants?(bits[i]===1?'high':'low'):'input',
      x:168,y:240+local.y,rotation:0,bit:bits[i]});
    wires.push({id:'wIn'+i,from:{componentId:id,pin:'out'},
      to:{componentId:'gate',pin}});
  });
  outputPins.forEach((pin,i)=>{
    const local=localPinAt(gate,pin);
    const id='led'+i;
    components.push({id,kind:'led',x:672,y:240+local.y,rotation:0});
    wires.push({id:'wOut'+i,from:{componentId:'gate',pin},
      to:{componentId:id,pin:'in'}});
  });
  return {version:1,lab:'signal',name:kind.toUpperCase()+' Demo',components,wires};
};
const outputBits=(doc:DigitalDocument): LogicValue[] => {
  const result=simulateLogic(doc);
  return doc.components.filter(c=>c.kind==='led').map(c=>result.ledValues[c.id]);
};

describe('new component catalog and metadata',()=>{
  it('has unique, searchable metadata for every placeable component',()=>{
    expect(allParts.length).toBe(33);
    expect(new Set(allParts.map(p=>p.kind)).size).toBe(33);
    expect(new Set(gateKinds).size).toBe(19);
    expect(allParts.map(p=>p.kind).sort())
      .toEqual(digitalKinds.filter(k=>k!=='block').sort());
    for(const part of allParts){
      expect(part.name.length).toBeGreaterThan(0);
      expect(categoryByKind[part.kind]).toBeTruthy();
      expect(searchParts(part.kind)).toContain(part);
      expect(searchParts(part.name)).toContain(part);
    }
  });
  it('supports categories and synonym search regardless of case or whitespace',()=>{
    expect(searchParts('MuX').map(p=>p.kind)).toContain('mux2');
    expect(searchParts('2 of 3').map(p=>p.kind)).toContain('majority');
    expect(searchParts('carry').map(p=>p.kind)).toEqual(
      expect.arrayContaining(['halfadder','fulladder']));
    expect(searchParts(' inverter ').map(p=>p.kind)).toEqual(['not']);
    expect(searchParts('3-INPUT').map(p=>p.kind)).toEqual(
      expect.arrayContaining(['and3','or3','xor3']));
    expect(searchParts('adder','arithmetic').map(p=>p.kind))
      .toEqual(['halfadder','fulladder']);
    expect(searchParts('mux','sources')).toEqual([]);
    expect(paletteCategories).toHaveLength(8);
    expect(searchParts('')).toHaveLength(33);
  });
  it('declares exact input/output pads for multiplexers, adders and sources',()=>{
    const pins=(kind:DigitalKind)=>pinsOf({id:'x',kind,x:0,y:0,rotation:0});
    expect(pins('mux2')).toEqual(['a','b','sel','out']);
    expect(pins('demux2')).toEqual(['in','sel','out0','out1']);
    expect(pins('halfadder')).toEqual(['a','b','sum','carry']);
    expect(pins('fulladder')).toEqual(['a','b','cin','sum','carry']);
    expect(pins('majority')).toEqual(['a','b','c','out']);
    expect(pins('high')).toEqual(['out']);
    expect(pins('low')).toEqual(['out']);
    expect(pinAt({id:'g',kind:'mux2',x:400,y:240,rotation:90},'sel'))
      .toEqual({x:376,y:176});
  });
});

describe('expanded gate truth tables and complete signal wiring',()=>{
  it.each(['and3','or3','xor3','majority'] as const)(
    '%s computes every three-bit input combination', kind=>{
      const expected={
        and3:[0,0,0,0,0,0,0,1],
        or3:[0,1,1,1,1,1,1,1],
        xor3:[0,1,1,0,1,0,0,1],
        majority:[0,0,0,1,0,1,1,1],
      }[kind];
      for(let n=0;n<8;n++){
        const bits:LogicBit[]=[(n>>2&1) as LogicBit,(n>>1&1) as LogicBit,(n&1) as LogicBit];
        const doc=makeCircuit(kind,bits);
        expect(isDigitalDocument(doc)).toBe(true);
        const result=simulateLogic(doc);
        expect(outputBits(doc)).toEqual([expected[n]]);
        expect(result.warnings).toEqual([]);
      }
    });
  it('MUX2 selects A/B with SEL and supports all eight test vectors',()=>{
    const expected=[0,0,0,1,1,0,1,1];
    for(let n=0;n<8;n++){
      const bits:LogicBit[]=[(n>>2&1) as LogicBit,(n>>1&1) as LogicBit,(n&1) as LogicBit];
      const doc=makeCircuit('mux2',bits);
      expect(outputBits(doc)).toEqual([expected[n]]);
    }
    const truth=generateTruthTable(makeCircuit('mux2',[0,0,0]));
    expect(truth.rows.map(r=>r.outputs[0])).toEqual(expected);
  });
  it('DEMUX2 routes IN to exactly one selected output',()=>{
    const expected:[[number,number],[number,number],[number,number],[number,number]]=[
      [0,0],[0,0],[1,0],[0,1],
    ];
    for(let n=0;n<4;n++){
      const bits:LogicBit[]=[(n>>1&1) as LogicBit,(n&1) as LogicBit];
      const doc=makeCircuit('demux2',bits);
      expect(isDigitalDocument(doc)).toBe(true);
      expect(outputBits(doc)).toEqual(expected[n]);
    }
    expect(generateTruthTable(makeCircuit('demux2',[0,0]))
      .rows.map(r=>r.outputs)).toEqual(expected);
  });
  it('half-adder produces independent SUM and CARRY outputs',()=>{
    const expected=[[0,0],[1,0],[1,0],[0,1]];
    for(let n=0;n<4;n++){
      const bits:LogicBit[]=[(n>>1&1) as LogicBit,(n&1) as LogicBit];
      expect(outputBits(makeCircuit('halfadder',bits))).toEqual(expected[n]);
    }
    expect(generateTruthTable(makeCircuit('halfadder',[0,0]))
      .rows.map(r=>r.outputs)).toEqual(expected);
  });
  it('full-adder produces SUM XOR and majority CARRY over 8 inputs',()=>{
    const expected=[[0,0],[1,0],[1,0],[0,1],[1,0],[0,1],[0,1],[1,1]];
    for(let n=0;n<8;n++){
      const bits:LogicBit[]=[(n>>2&1) as LogicBit,(n>>1&1) as LogicBit,(n&1) as LogicBit];
      expect(outputBits(makeCircuit('fulladder',bits))).toEqual(expected[n]);
    }
    expect(generateTruthTable(makeCircuit('fulladder',[0,0,0]))
      .rows.map(r=>r.outputs)).toEqual(expected);
  });
  it('constant HIGH and LOW are real drivers, but not truth-table inputs',()=>{
    const doc=makeCircuit('and',[1,0],true);
    expect(outputBits(doc)).toEqual([0]);
    expect(simulateLogic(doc).warnings).toEqual([]);
    expect(generateTruthTable.bind(null,doc)).toThrow(/INPUT switch/);
    const src=doc.components.find(c=>c.kind==='low')!;
    expect(simulateLogic(doc).terminalValues[src.id+':out']).toBe(0);
  });
  it('new gates can be captured as portable reusable blocks',()=>{
    const doc=makeCircuit('fulladder',[1,0,1]);
    const {definition,condensed}=captureBlock(doc,'FULL ADDER MODULE');
    expect(definition.inputs).toHaveLength(3);
    expect(definition.outputs).toHaveLength(2);
    expect(isDigitalDocument(condensed)).toBe(true);
    expect(outputBits(condensed)).toEqual([0,1]);
    expect(generateTruthTable(condensed).rows.map(r=>r.outputs))
      .toEqual(generateTruthTable(doc).rows.map(r=>r.outputs));
  });
});

describe('undefined and floating signals on new devices',()=>{
  it('uses controlling bits for three-input AND/OR and MAJORITY',()=>{
    expect(evaluateComponent('and3',{a:0,b:'X',c:'Z'}).out).toBe(0);
    expect(evaluateComponent('or3',{a:'X',b:1,c:'Z'}).out).toBe(1);
    expect(evaluateComponent('majority',{a:1,b:1,c:'Z'}).out).toBe(1);
    expect(evaluateComponent('majority',{a:0,b:0,c:'X'}).out).toBe(0);
    expect(evaluateComponent('majority',{a:0,b:1,c:'X'}).out).toBe('X');
    expect(evaluateComponent('xor3',{a:1,b:'X',c:1}).out).toBe('X');
  });
  it('handles a floating mux select and floating demux data conservatively',()=>{
    expect(evaluateComponent('mux2',{a:1,b:1,sel:'Z'}).out).toBe(1);
    expect(evaluateComponent('mux2',{a:1,b:0,sel:'X'}).out).toBe('X');
    expect(evaluateComponent('mux2',{a:1,b:'X',sel:0}).out).toBe(1);
    expect(evaluateComponent('demux2',{in:0,sel:'Z'})).toEqual({out0:0,out1:0});
    expect(evaluateComponent('demux2',{in:1,sel:'X'})).toEqual({out0:'X',out1:'X'});
    expect(evaluateComponent('demux2',{in:'Z',sel:0})).toEqual({out0:'X',out1:0});
  });
  it('preserves correct SUM/CARRY behavior when only CIN is unknown',()=>{
    expect(evaluateComponent('fulladder',{a:1,b:1,cin:'Z'}))
      .toEqual({sum:'X',carry:1});
    expect(evaluateComponent('fulladder',{a:0,b:0,cin:'X'}))
      .toEqual({sum:'X',carry:0});
  });
  it('warns specifically about unconnected SEL and CIN pins',()=>{
    const doc=makeCircuit('mux2',[1,0,1]);
    doc.wires=doc.wires.filter(w=>w.id!=='wIn2');
    const result=simulateLogic(doc);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/SEL has no driver/)]));
    const full=makeCircuit('fulladder',[1,0,1]);
    full.wires=full.wires.filter(w=>w.id!=='wIn2');
    expect(simulateLogic(full).warnings).toEqual(expect.arrayContaining([expect.stringMatching(/CIN has no driver/)]));
  });
});

describe('editor catalog shortcuts',()=>{
  beforeEach(()=>useDigitalStore.setState({
    document:{version:1,lab:'signal',name:'blank',components:[],wires:[]},
    favoriteKinds:[],recentKinds:[],selectedIds:[],selection:null,editStack:[],
    past:[],future:[],pending:null,dragOrigin:null,probes:[],trace:[],
  }));
  it('remembers favorited kinds and recent placements without duplicates',()=>{
    const s=useDigitalStore.getState();
    s.toggleFavorite('mux2');
    s.toggleFavorite('fulladder');
    expect(useDigitalStore.getState().favoriteKinds).toEqual(['mux2','fulladder']);
    s.toggleFavorite('mux2');
    expect(useDigitalStore.getState().favoriteKinds).toEqual(['fulladder']);
    s.add('mux2',{x:120,y:168});
    s.add('and3',{x:240,y:168});
    s.add('mux2',{x:360,y:168});
    expect(useDigitalStore.getState().recentKinds.slice(0,2)).toEqual(['mux2','and3']);
  });
  it('supports wiring SEL, SUM and CARRY on new components',()=>{
    const s=useDigitalStore.getState();
    s.add('mux2',{x:360,y:192});
    s.add('fulladder',{x:624,y:240});
    const [mux,fa]=useDigitalStore.getState().document.components;
    useDigitalStore.getState().finishWire({componentId:mux.id,pin:'out'});
    useDigitalStore.getState().finishWire({componentId:fa.id,pin:'cin'});
    expect(useDigitalStore.getState().document.wires).toHaveLength(1);
    useDigitalStore.getState().finishWire({componentId:fa.id,pin:'sum'});
    useDigitalStore.getState().finishWire({x:804,y:216});
    expect(useDigitalStore.getState().document.wires).toHaveLength(2);
    expect(useDigitalStore.getState().pending).toEqual({x:804,y:216});
  });
});
