import { beforeEach, describe, expect, it } from 'vitest';
import { initialDigitalCircuit, DigitalDocument, isDigitalDocument } from './types';
import { halfAdderDemo } from './samples';
import { captureBlock, placeBlock, applyInputVector, outputVector, inputVector } from './blocks';
import { compileSignals } from './compile';
import { simulateLogic, generateTruthTable } from './engine';
import { useDigitalStore } from './useDigitalStore';

describe('hierarchical reusable logic blocks', () => {
  it('condenses an XOR schematic into a block without altering its electrical output', () => {
    const original = initialDigitalCircuit();
    const expected = simulateLogic(original);
    const { definition, condensed } = captureBlock(original,'MY XOR');
    expect(definition.inputs.map(p=>p.pin)).toEqual(['in0','in1']);
    expect(definition.outputs.map(p=>p.pin)).toEqual(['out0']);
    expect(condensed.components.filter(c=>c.kind==='block')).toHaveLength(1);
    expect(condensed.components).toHaveLength(4);
    expect(isDigitalDocument(condensed)).toBe(true);
    expect(simulateLogic(condensed).ledValues).toMatchObject({[condensed.components[3].id]:expected.ledValues.led1});
    expect(generateTruthTable(condensed).rows.map(r=>r.outputs)).toEqual([[0],[1],[1],[0]]);
    expect(original.components.find(c=>c.kind==='xor')).toBeDefined();
  });

  it('exposes multiple output pins and preserves a half adder truth table', () => {
    const original=halfAdderDemo();
    const {definition,condensed}=captureBlock(original,'HALF ADDER');
    expect(definition.inputs.map(p=>p.label)).toEqual(['A','B']);
    expect(definition.outputs.map(p=>p.label)).toEqual(['SUM','CARRY']);
    expect(generateTruthTable(condensed).rows.map(r=>r.outputs))
      .toEqual([[0,0],[1,0],[1,0],[0,1]]);
    expect(outputVector(condensed,simulateLogic(condensed).ledValues)).toBe('10');
  });

  it('allows the same module to be placed twice with independent inputs', () => {
    const {definition}=captureBlock(initialDigitalCircuit(),'XOR');
    let doc:DigitalDocument={
      version:1,lab:'signal',name:'two XOR modules',blocks:[definition],wires:[],
      components:[
        {id:'a',kind:'input',x:0,y:100,rotation:0,bit:0},
        {id:'b',kind:'input',x:0,y:160,rotation:0,bit:0},
        {id:'c',kind:'input',x:0,y:380,rotation:0,bit:0},
        {id:'d',kind:'input',x:0,y:440,rotation:0,bit:1},
        {id:'out1',kind:'led',x:940,y:120,rotation:0},
        {id:'out2',kind:'led',x:940,y:420,rotation:0},
      ],
    };
    doc=placeBlock(doc,[definition],definition.id,{x:320,y:120});
    doc=placeBlock(doc,[definition],definition.id,{x:650,y:420});
    const [blockA,blockB]=doc.components.filter(c=>c.kind==='block');
    const t=(componentId:string,pin:string)=>({componentId,pin});
    doc.wires=[
      {id:'1',from:t('a','out'),to:t(blockA.id,'in0')},
      {id:'2',from:t('b','out'),to:t(blockA.id,'in1')},
      {id:'3',from:t(blockA.id,'out0'),to:t('out1','in')},
      {id:'4',from:t('c','out'),to:t(blockB.id,'in0')},
      {id:'5',from:t('d','out'),to:t(blockB.id,'in1')},
      {id:'6',from:t(blockB.id,'out0'),to:t('out2','in')},
    ];
    expect(isDigitalDocument(doc)).toBe(true);
    const result=simulateLogic(doc);
    expect(result.ledValues.out1).toBe(0);
    expect(result.ledValues.out2).toBe(1);
    expect(compileSignals(doc).primitives.filter(p=>p.component.kind==='xor')).toHaveLength(2);
    doc=applyInputVector(doc,'1110');
    const updated=simulateLogic(doc);
    expect(updated.ledValues.out1).toBe(0); // 1 xor 1
    expect(updated.ledValues.out2).toBe(1); // 1 xor 0
    doc=applyInputVector(doc,'1000');
    const updated2=simulateLogic(doc);
    expect(updated2.ledValues.out1).toBe(1);
    expect(updated2.ledValues.out2).toBe(0);
  });

  it('supports modules inside larger modules with portable dependency definitions',()=>{
    const first=captureBlock(initialDigitalCircuit(),'XOR');
    const second=captureBlock(first.condensed,'NESTED XOR');
    expect(second.condensed.blocks).toHaveLength(2);
    expect(isDigitalDocument(second.condensed)).toBe(true);
    expect(generateTruthTable(second.condensed).rows.map(r=>r.outputs[0])).toEqual([0,1,1,0]);
    let larger:DigitalDocument={version:1,lab:'signal',name:'large',components:[],wires:[]};
    larger=placeBlock(larger,second.condensed.blocks!,second.definition.id,{x:360,y:240});
    expect(larger.blocks?.map(b=>b.name)).toEqual(['XOR','NESTED XOR']);
    expect(isDigitalDocument(larger)).toBe(true);
  });

  it('detects block recursion and incorrect imported port interfaces',()=>{
    const base=captureBlock(initialDigitalCircuit(),'UNIT');
    const broken:DigitalDocument={...base.condensed,
      components:base.condensed.components.map(c=>c.kind==='block'
        ? {...c,ports:{inputs:['wrong'],outputs:['out0']}} : c)};
    expect(isDigitalDocument(broken)).toBe(false);
    const recursive={...base.definition, circuit:{
      ...base.definition.circuit,
      components:[...base.definition.circuit.components,{
        id:'self',kind:'block' as const,x:840,y:120,rotation:0 as const,
        blockId:base.definition.id,
        ports:{inputs:['in0','in1'],outputs:['out0']},
      }],
    }};
    const doc:DigitalDocument={...base.condensed,blocks:[recursive]};
    expect(isDigitalDocument(doc)).toBe(true);
    expect(()=>simulateLogic(doc)).toThrow(/Recursive block definitions/);
  });

  it('rejects invalid capture requests and incorrect input vector widths',()=>{
    expect(()=>captureBlock({version:1,lab:'signal',name:'empty',components:[],wires:[]},'EMPTY'))
      .toThrow(/INPUT switch/);
    expect(()=>captureBlock(initialDigitalCircuit(),'  ')).toThrow(/name/);
    expect(()=>applyInputVector(initialDigitalCircuit(),'101')).toThrow(/2 bits/);
    expect(()=>applyInputVector(initialDigitalCircuit(),'0X')).toThrow(/binary/);
    expect(inputVector(initialDigitalCircuit())).toBe('01');
  });
});

describe('input vectors, event recording and probes',()=>{
  beforeEach(()=>useDigitalStore.setState({
    document:initialDigitalCircuit(),blockLibrary:[],selection:null,selectedIds:[],
    pending:null,dragOrigin:null,past:[],future:[],probes:[],trace:[],
  }));
  it('applies a typed vector and preserves undo history',()=>{
    const s=useDigitalStore.getState();
    s.applyVector('11');
    const state=useDigitalStore.getState();
    expect(inputVector(state.document)).toBe('11');
    expect(simulateLogic(state.document).ledValues.led1).toBe(0);
    expect(state.trace.at(-1)?.vector).toBe('11');
    s.undo();
    expect(inputVector(useDigitalStore.getState().document)).toBe('01');
  });
  it('records multiple logic events available to probes',()=>{
    const s=useDigitalStore.getState();
    s.addProbe('wire','w3','XOR OUTPUT');
    s.addProbe('terminal','xor1:out','XOR.OUT');
    s.addProbe('wire','w3','DUPLICATE PROBE');
    expect(useDigitalStore.getState().probes).toHaveLength(2);
    s.applyVector('00');
    s.applyVector('01');
    s.applyVector('11');
    const trace=useDigitalStore.getState().trace;
    expect(trace.map(e=>e.vector)).toEqual(['00','01','11']);
    expect(trace.map(e=>e.wires.w3)).toEqual([0,1,0]);
    expect(trace.map(e=>e.terminals['xor1:out'])).toEqual([0,1,0]);
    s.clearTrace();
    expect(useDigitalStore.getState().trace).toHaveLength(1);
    expect(useDigitalStore.getState().trace[0].wires.w3).toBe(0);
  });
  it('captures modules into a reusable library and restores the old circuit with undo',()=>{
    const s=useDigitalStore.getState();
    s.captureAsBlock('MY XOR');
    expect(useDigitalStore.getState().blockLibrary).toHaveLength(1);
    expect(useDigitalStore.getState().document.components.some(c=>c.kind==='block')).toBe(true);
    s.undo();
    expect(useDigitalStore.getState().document.components.some(c=>c.kind==='xor')).toBe(true);
    const moduleId=useDigitalStore.getState().blockLibrary[0].id;
    s.newCircuit();
    s.addSavedBlock(moduleId,{x:300,y:200});
    expect(useDigitalStore.getState().document.blocks?.length).toBe(1);
  });
});
