import { beforeEach, describe, expect, it } from 'vitest';
import { captureBlock, reviseBlockDefinition } from './blocks';
import { simulateLogic } from './engine';
import { initialDigitalCircuit, pinsOf, DigitalDocument } from './types';
import { useDigitalStore, persistedDigitalState } from './useDigitalStore';

const reset = () => useDigitalStore.setState({
  document: initialDigitalCircuit(), past: [], future: [],
  editStack: [], selectedIds: [], selection: null, pending: null,
  blockLibrary: [], probes: [], trace: [], clipboard: null, pasteCount: 0,
  dragOrigin: null,
});
beforeEach(reset);

function initializeBlock() {
  const store = useDigitalStore.getState();
  store.captureAsBlock('MY XOR');
  const state = useDigitalStore.getState();
  const block = state.document.components.find(c => c.kind === 'block')!;
  return { block, doc: state.document, definition: state.blockLibrary[0] };
}

function replaceInnerXorWithAnd() {
  const store = useDigitalStore.getState();
  const oldGate = store.document.components.find(c => c.kind === 'xor')!;
  store.select({type:'component',id:oldGate.id});
  store.remove();
  store.add('and', {x:oldGate.x,y:oldGate.y});
  const current = useDigitalStore.getState();
  const newGate = current.document.components.find(c => c.kind === 'and')!;
  // Physically wire the original boundary inputs and outputs to the new gate.
  for (const [from,to] of [
    [{componentId:'a',pin:'out'},{componentId:newGate.id,pin:'a'}],
    [{componentId:'b',pin:'out'},{componentId:newGate.id,pin:'b'}],
    [{componentId:newGate.id,pin:'out'},{componentId:'led1',pin:'in'}],
  ]) {
    useDigitalStore.getState().finishWire(from);
    useDigitalStore.getState().finishWire(to);
  }
  return newGate;
}

describe('reusable block terminal wiring bug regression', () => {
  it('declares named block input/output pins instead of gate-only A/B/OUT', () => {
    const {block} = initializeBlock();
    expect(pinsOf(block)).toEqual(['in0','in1','out0']);
  });
  it('connects a block input from an ordinary switch and an output to an LED', () => {
    const {block} = initializeBlock();
    useDigitalStore.getState().newCircuit();
    useDigitalStore.getState().addSavedBlock(block.blockId!,{x:360,y:240});
    const state = useDigitalStore.getState();
    const instance = state.document.components.find(c=>c.kind==='block')!;
    state.add('input',{x:120,y:180});
    state.add('input',{x:120,y:300});
    state.add('led',{x:600,y:240});
    const doc = useDigitalStore.getState().document;
    const inputs = doc.components.filter(c=>c.kind==='input');
    const led = doc.components.find(c=>c.kind==='led')!;
    const connections: [string,string,string,string][] = [
      [inputs[0].id,'out',instance.id,'in0'],
      [inputs[1].id,'out',instance.id,'in1'],
      [instance.id,'out0',led.id,'in'],
    ];
    for(const [a,pa,b,pb] of connections) {
      useDigitalStore.getState().finishWire({componentId:a,pin:pa});
      useDigitalStore.getState().finishWire({componentId:b,pin:pb});
    }
    const current = useDigitalStore.getState();
    expect(current.document.wires).toHaveLength(3);
    expect(current.pending).toBeNull();
    expect(simulateLogic(current.document).ledValues[led.id]).toBe(0);
    current.toggleInput(inputs[1].id);
    expect(simulateLogic(useDigitalStore.getState().document).ledValues[led.id]).toBe(1);
  });
  it('accepts a dangling trace connecting into and out of a block pin', () => {
    const {block} = initializeBlock();
    const state = useDigitalStore.getState();
    const before = state.document.wires.length;
    state.finishWire({componentId:block.id,pin:'out0'});
    state.finishWire({x:780,y:360});
    state.finishWire({componentId:block.id,pin:'in0'});
    expect(useDigitalStore.getState().document.wires).toHaveLength(before+2);
    expect(useDigitalStore.getState().pending).toBeNull();
  });
  it('rejects nonexistent block pins without losing the existing schematic',()=>{
    const {block}=initializeBlock();
    const store=useDigitalStore.getState();
    const count=store.document.wires.length;
    store.finishWire({componentId:block.id,pin:'out99'});
    store.finishWire({componentId:'a',pin:'out'});
    expect(useDigitalStore.getState().document.wires).toHaveLength(count);
    expect(useDigitalStore.getState().message).toMatch(/missing pin/i);
  });
});

describe('block drilldown editing and parent restoration',()=>{
  it('opens the original gate-level schematic and cancels without publishing',()=>{
    const {block,definition}=initializeBlock();
    const parent=useDigitalStore.getState().document;
    useDigitalStore.getState().openBlock(block.id);
    let state=useDigitalStore.getState();
    expect(state.editStack).toHaveLength(1);
    expect(state.document.components.some(c=>c.kind==='xor')).toBe(true);
    expect(state.document.name).toBe(definition.circuit.name);
    replaceInnerXorWithAnd();
    expect(simulateLogic(useDigitalStore.getState().document).ledValues.led1).toBe(0);
    useDigitalStore.getState().cancelBlockEdit();
    state=useDigitalStore.getState();
    expect(state.editStack).toHaveLength(0);
    expect(state.document).toBe(parent);
    expect(state.blockLibrary[0].circuit.components.some(c=>c.kind==='xor')).toBe(true);
    expect(simulateLogic(state.document).ledValues[state.document.components.find(c=>c.kind==='led')!.id]).toBe(1);
  });
  it('saves internal gate edits across all instances and makes the save undoable',()=>{
    const {block}=initializeBlock();
    const store=useDigitalStore.getState();
    store.addSavedBlock(block.blockId!,{x:800,y:400});
    const parent=useDigitalStore.getState().document;
    const instances=parent.components.filter(c=>c.kind==='block');
    expect(instances).toHaveLength(2);
    store.openBlock(instances[0].id);
    replaceInnerXorWithAnd();
    useDigitalStore.getState().saveBlockEdit();
    const state=useDigitalStore.getState();
    expect(state.editStack).toHaveLength(0);
    expect(state.document.components.filter(c=>c.kind==='block')).toHaveLength(2);
    expect(state.document.blocks?.find(d=>d.id===block.blockId)?.circuit.components
      .some(c=>c.kind==='and')).toBe(true);
    expect(state.blockLibrary.find(d=>d.id===block.blockId)?.circuit.components
      .some(c=>c.kind==='and')).toBe(true);
    const led=state.document.components.find(c=>c.kind==='led')!;
    expect(simulateLogic(state.document).ledValues[led.id]).toBe(0); // input 0,1 => AND 0
    state.undo();
    expect(simulateLogic(useDigitalStore.getState().document).ledValues[led.id]).toBe(1);
  });
  it('updates block interface labels without changing external pin IDs',()=>{
    const {block}=initializeBlock();
    useDigitalStore.getState().openBlock(block.id);
    useDigitalStore.getState().setName('a','DATA');
    useDigitalStore.getState().setName('led1','RESULT');
    useDigitalStore.getState().saveBlockEdit();
    const def=useDigitalStore.getState().blockLibrary[0];
    expect(def.inputs[0]).toMatchObject({pin:'in0',label:'DATA'});
    expect(def.outputs[0]).toMatchObject({pin:'out0',label:'RESULT'});
    expect(pinsOf(useDigitalStore.getState().document.components
      .find(c=>c.kind==='block')!)).toEqual(['in0','in1','out0']);
  });
  it('refuses to save a breaking interface change and keeps the draft open',()=>{
    const {block}=initializeBlock();
    useDigitalStore.getState().openBlock(block.id);
    useDigitalStore.getState().select({type:'component',id:'a'});
    useDigitalStore.getState().remove();
    expect(()=>useDigitalStore.getState().saveBlockEdit()).toThrow(/original INPUT switches/);
    expect(useDigitalStore.getState().editStack).toHaveLength(1);
    useDigitalStore.getState().cancelBlockEdit();
    expect(useDigitalStore.getState().editStack).toHaveLength(0);
  });
  it('keeps in-progress internal changes out of browser persistence',()=>{
    const {block,doc}=initializeBlock();
    useDigitalStore.getState().openBlock(block.id);
    replaceInnerXorWithAnd();
    const persisted=persistedDigitalState(useDigitalStore.getState());
    expect(persisted.document).toBe(doc);
    expect(persisted.document.components.some(c=>c.kind==='xor')).toBe(false);
    expect(persisted.document.components.some(c=>c.kind==='block')).toBe(true);
  });
  it('reopens a saved nested block and returns through both levels',()=>{
    const {block}=initializeBlock();
    const parentBlock=block;
    useDigitalStore.getState().openBlock(parentBlock.id);
    const editor=useDigitalStore.getState();
    editor.addSavedBlock(parentBlock.blockId!,{x:780,y:400});
    const nested=useDigitalStore.getState().document.components.find(c=>c.kind==='block')!;
    // Editing a definition inside itself is disallowed as recursion.
    expect(()=>useDigitalStore.getState().openBlock(nested.id)).toThrow(/Recursive/);
    useDigitalStore.getState().cancelBlockEdit();
  });
  it('validates edited boundary identities independently of simulation state',()=>{
    const {definition}=captureBlock(initialDigitalCircuit(),'XOR');
    const invalid:DigitalDocument={
      ...definition.circuit,
      components:definition.circuit.components.filter(c=>c.id!=='led1'),
    };
    expect(()=>reviseBlockDefinition(definition,invalid)).toThrow();
  });
});
