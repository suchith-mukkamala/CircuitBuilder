import { beforeEach, describe, expect, it } from 'vitest';
import { useDigitalStore } from './useDigitalStore';
import { initialDigitalCircuit } from './types';
import { simulateLogic } from './engine';

const reset = () => useDigitalStore.setState({
  document:initialDigitalCircuit(),selection:null,selectedIds:[],pending:null,
  past:[],future:[],dragOrigin:null,clipboard:null,pasteCount:0,message:'ready',
});
beforeEach(reset);
describe('Signal Lab editor operations',()=>{
  it('switch toggling recalculates the live signal and is undoable',()=>{
    expect(simulateLogic(useDigitalStore.getState().document).ledValues.led1).toBe(1);
    useDigitalStore.getState().toggleInput('a');
    expect(simulateLogic(useDigitalStore.getState().document).ledValues.led1).toBe(0);
    useDigitalStore.getState().undo();
    expect(simulateLogic(useDigitalStore.getState().document).ledValues.led1).toBe(1);
    useDigitalStore.getState().redo();
    expect(simulateLogic(useDigitalStore.getState().document).ledValues.led1).toBe(0);
  });
  it('groups component drag gestures into a single history entry',()=>{
    const store=useDigitalStore.getState();
    store.select({type:'component',id:'xor1'});
    store.dragStart();
    store.move('xor1',{x:408,y:228});
    store.move('xor1',{x:432,y:228});
    store.dragEnd();
    expect(useDigitalStore.getState().past).toHaveLength(1);
    useDigitalStore.getState().undo();
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='xor1')?.x).toBe(384);
  });
  it('copies two components and only their internal wires',()=>{
    const s=useDigitalStore.getState();
    s.select({type:'component',id:'a'});
    s.select({type:'component',id:'xor1'},true);
    s.copy();
    expect(useDigitalStore.getState().clipboard?.wires).toHaveLength(1);
    s.paste();
    const result=useDigitalStore.getState();
    expect(result.document.components).toHaveLength(6);
    expect(result.document.wires).toHaveLength(4);
    expect(new Set(result.document.components.map(c=>c.id)).size).toBe(6);
    s.undo();
    expect(useDigitalStore.getState().document.components).toHaveLength(4);
  });
  it('creates and reconnects free-ended wires',()=>{
    const s=useDigitalStore.getState();
    s.finishWire({componentId:'xor1',pin:'out'});
    s.finishWire({x:480,y:264});
    expect(useDigitalStore.getState().pending).toEqual({x:480,y:264});
    s.finishWire({componentId:'led1',pin:'in'});
    expect(useDigitalStore.getState().pending).toBeNull();
    expect(useDigitalStore.getState().document.wires).toHaveLength(5);
  });
  it('isolates documents from Analog Lab and accepts its own exports',()=>{
    const s=useDigitalStore.getState();
    const doc=initialDigitalCircuit();
    s.load(doc);
    expect(useDigitalStore.getState().document.lab).toBe('signal');
    expect(()=>s.load({version:1,name:'analog',components:[],wires:[]})).toThrow(/Signal Lab/);
  });
  it('supports adding all gate kinds and labels',()=>{
    const s=useDigitalStore.getState();
    s.add('nand',{x:740,y:310});
    const state=useDigitalStore.getState();
    const comp=state.document.components.at(-1)!;
    expect(comp.kind).toBe('nand');
    s.setName(comp.id,'CTRL');
    expect(useDigitalStore.getState().document.components.at(-1)?.name).toBe('CTRL');
  });
});
