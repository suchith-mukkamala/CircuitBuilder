import {beforeEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../HomeScreen';
import {ComputerBuilder} from '../ComputerBuilder';
import {cpuCoreDemo,counterDemo} from './computerSamples';
import {initialDigitalCircuit} from './types';
import {useDigitalStore,workspaceTransition,persistedDigitalState} from './useDigitalStore';
import {fitDigitalCircuit} from './canvasViewport';

beforeEach(()=>{
  const initial=initialDigitalCircuit();
  useDigitalStore.setState({
    document:initial,
    activeWorkspace:'signal',
    signalDocument:initial,
    computerDocument:cpuCoreDemo(),
    editStack:[],blockLibrary:[],
    past:[],future:[],selection:null,selectedIds:[],pending:null,
    clipboard:null,pasteCount:0,dragOrigin:null,
    probes:[],trace:[],
  });
  useDigitalStore.getState().resetClock();
});

describe('three independent lab navigation workspaces',()=>{
  it('starts Computer Builder with a functioning starter, not an empty editor',()=>{
    expect(useDigitalStore.getState().switchWorkspace('computer')).toBe(true);
    const state=useDigitalStore.getState();
    expect(state.activeWorkspace).toBe('computer');
    expect(state.document.name).toMatch(/CPU Datapath/);
    expect(state.document.components.some(c=>c.kind==='alu4')).toBe(true);
    expect(state.document.components.some(c=>c.kind==='clock')).toBe(true);
    state.clockStep();
    expect(useDigitalStore.getState().runtime.cycle).toBe(1);
  });
  it('preserves separate Signal Lab and Computer Builder designs through repeated navigation',()=>{
    const store=useDigitalStore.getState();
    store.renameDocument('My Signal Circuit');
    store.add('and3',{x:480,y:330});
    const signalDoc=useDigitalStore.getState().document;
    expect(store.switchWorkspace('computer')).toBe(true);
    const cpu=useDigitalStore.getState().document;
    expect(cpu).not.toBe(signalDoc);
    expect(cpu.name).toMatch(/CPU Datapath/);
    const modified=Array(16).fill(7);
    useDigitalStore.getState().setRomWords('rom',modified);
    useDigitalStore.getState().clockStep();
    expect(useDigitalStore.getState().runtime.cycle).toBe(1);
    const editedCpu=useDigitalStore.getState().document;
    expect(store.switchWorkspace('signal')).toBe(true);
    expect(useDigitalStore.getState().document).toBe(signalDoc);
    expect(useDigitalStore.getState().document.components.some(c=>c.kind==='and3')).toBe(true);
    expect(useDigitalStore.getState().runtime.cycle).toBe(0);
    expect(store.switchWorkspace('computer')).toBe(true);
    const returned=useDigitalStore.getState().document;
    expect(returned).toBe(editedCpu);
    expect(returned.components.find(c=>c.id==='rom')?.words).toEqual(modified);
  });
  it('persists the current active schematic and both saved project slots',()=>{
    useDigitalStore.getState().renameDocument('Signal Draft');
    useDigitalStore.getState().switchWorkspace('computer');
    useDigitalStore.getState().renameDocument('CPU Custom');
    const snapshot=persistedDigitalState(useDigitalStore.getState());
    expect(snapshot.activeWorkspace).toBe('computer');
    expect(snapshot.document.name).toBe('CPU Custom');
    expect(snapshot.computerDocument.name).toBe('CPU Custom');
    expect(snapshot.signalDocument.name).toBe('Signal Draft');
    expect(snapshot).not.toHaveProperty('runtime');
  });
  it('keeps separate undo history and resets the clock on changing workspaces',()=>{
    const state=useDigitalStore.getState();
    state.add('xor3',{x:400,y:300});
    expect(useDigitalStore.getState().past.length).toBeGreaterThan(0);
    state.switchWorkspace('computer');
    expect(useDigitalStore.getState().past).toHaveLength(0);
    useDigitalStore.getState().clockSteps(4);
    expect(useDigitalStore.getState().runtime.cycle).toBe(4);
    state.switchWorkspace('signal');
    expect(useDigitalStore.getState().runtime.cycle).toBe(0);
    expect(useDigitalStore.getState().document.components.some(c=>c.kind==='xor3')).toBe(true);
  });
  it('refuses a workspace change while a custom module has uncommitted internal edits',()=>{
    const state=useDigitalStore.getState();
    state.captureAsBlock('LOGIC CORE');
    const block=useDigitalStore.getState().document.components.find(c=>c.kind==='block')!;
    state.openBlock(block.id);
    expect(useDigitalStore.getState().editStack).toHaveLength(1);
    expect(state.switchWorkspace('computer')).toBe(false);
    expect(()=>workspaceTransition(useDigitalStore.getState(),'computer')).toThrow(/Finish editing/);
    const saved=persistedDigitalState(useDigitalStore.getState());
    expect(saved.document.components.some(c=>c.kind==='block')).toBe(true);
    state.cancelBlockEdit();
    expect(state.switchWorkspace('computer')).toBe(true);
  });
});

describe('first-time user viewport and navigation',()=>{
  it('fits the large CPU example in an editor viewport',()=>{
    const doc=cpuCoreDemo();
    const view=fitDigitalCircuit(doc,{width:850,height:560});
    expect(view.zoom).toBeGreaterThanOrEqual(.3);
    expect(view.zoom).toBeLessThanOrEqual(1.65);
    for(const component of doc.components){
      const x=component.x*view.zoom+view.x;
      const y=component.y*view.zoom+view.y;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(850);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(560);
    }
  });
  it('handles narrow viewports and empty projects without invalid camera values',()=>{
    for(const width of [420,800,1440]){
      const camera=fitDigitalCircuit(counterDemo(),{width,height:520});
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
      expect(camera.zoom).toBeGreaterThan(0);
    }
    expect(fitDigitalCircuit({version:1,lab:'signal',name:'New',components:[],wires:[]},
      {width:0,height:0})).toEqual({x:80,y:70,zoom:1});
  });
  it('home screen has exactly three electronics destinations and the original CPU schematic',()=>{
    const html=renderToStaticMarkup(<HomeScreen onAnalog={()=>{}}
      onSignal={()=>{}} onComputer={()=>{}}/>);
    expect((html.match(/<button\b/g)||[])).toHaveLength(3);
    expect(html).toContain('ANALOG LAB');
    expect(html).toContain('SIGNAL LAB');
    expect(html).toContain('COMPUTER BUILDER');
    expect(html).not.toContain('EVOLUTION LAB');
    expect(html).toContain('PROGRAM');
    expect(html).toContain('ALU');
    expect(html).not.toContain('CLOCK STEP');
  });
  it('Computer Builder is a distinct UI with editing, run, and graph controls',()=>{
    useDigitalStore.getState().switchWorkspace('computer');
    const html=renderToStaticMarkup(<ComputerBuilder/>);
    expect(html).toContain('COMPUTER BUILDER');
    expect(html).toContain('CIRCUIT CANVAS');
    expect(html).toContain('HARDWARE');
    expect(html).toContain('CODE STUDIO');
    expect(html).toContain('Emit one clock edge');
    expect(html).toContain('CIRCUIT CANVAS');
    expect(html).not.toContain('CASM assembly source');
  });
});
