import {beforeEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {CasmProgramPanel} from './CasmProgramPanel';
import {programmableCpuDemo,counterDemo} from './computerSamples';
import {DEFAULT_CASM_SOURCE} from './casm';
import {emptyDigitalRuntime} from './types';
import {stepCircuit} from './computerEngine';
import {readCpuState} from './cpuCore';
import {persistedDigitalState,useDigitalStore} from './useDigitalStore';

beforeEach(()=>{
  const doc=programmableCpuDemo();
  useDigitalStore.setState({
    document:doc,computerDocument:doc,activeWorkspace:'computer',
    casmDrafts:{},
    runtime:emptyDigitalRuntime(),trace:[],
    selection:null,selectedIds:[],past:[],future:[],
    pending:null,pendingBus:null,editStack:[],dragOrigin:null,
  });
});

describe('Code Studio draft/injection separation',()=>{
  it('saves a draft without mutating the circuit or compiled ROM bytes',()=>{
    const store=useDigitalStore.getState();
    const original=store.document;
    const program=original.components.find(c=>c.id==='rom')!;
    store.setCasmDraft('rom','LDI 9\nOUT\nHLT');
    const next=useDigitalStore.getState();
    expect(next.document).toBe(original);
    expect(next.document.components.find(c=>c.id==='rom')).toBe(program);
    expect(next.casmDrafts.rom).toBe('LDI 9\nOUT\nHLT');
    expect(next.past).toHaveLength(0);
    expect(persistedDigitalState(next).casmDrafts.rom).toBe('LDI 9\nOUT\nHLT');
    const state=stepCircuit(original,emptyDigitalRuntime());
    expect(readCpuState(state,'top/cpu').acc).toBe(3); // still original LDI 3
  });
  it('successfully injects machine code into selected ROM, resets CPU, and clears only that draft',()=>{
    const store=useDigitalStore.getState();
    store.setCasmDraft('rom','LDI 9\nOUT\nHLT');
    store.clockSteps(2);
    expect(useDigitalStore.getState().runtime.cycle).toBe(2);
    expect(store.setCasmProgram('rom','LDI 9\nOUT\nHLT')).toBe(true);
    const state=useDigitalStore.getState();
    expect(state.runtime.cycle).toBe(0);
    expect(state.casmDrafts.rom).toBeUndefined();
    expect(state.document.components.find(c=>c.id==='rom')?.program?.slice(0,3))
      .toEqual([0x19,0xC0,0xD0]);
    expect(state.document.components.find(c=>c.id==='rom')?.source)
      .toBe('LDI 9\nOUT\nHLT');
    const after=stepCircuit(state.document,emptyDigitalRuntime());
    expect(readCpuState(after,'top/cpu').acc).toBe(9);
    expect(state.document.components.find(c=>c.id==='cpu')?.kind).toBe('cpu4');
    expect(state.document.buses?.map(b=>b.id))
      .toEqual(['pcBus','instructionBus','outputBus']); // hardware not replaced
  });
  it('does not change injected ROM or lose the draft when assembly fails',()=>{
    const store=useDigitalStore.getState();
    store.setCasmDraft('rom','JMP UNKNOWN');
    const prior=useDigitalStore.getState().document;
    const before=prior.components.find(c=>c.id==='rom')?.program;
    expect(store.setCasmProgram('rom','JMP UNKNOWN')).toBe(false);
    expect(useDigitalStore.getState().document).toBe(prior);
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='rom')?.program)
      .toBe(before);
    expect(useDigitalStore.getState().casmDrafts.rom).toBe('JMP UNKNOWN');
  });
  it('retains drafts when switching to Signal Lab and back',()=>{
    const store=useDigitalStore.getState();
    store.setCasmDraft('rom','INC\nOUT\nHLT');
    expect(store.switchWorkspace('signal')).toBe(true);
    expect(useDigitalStore.getState().casmDrafts.rom).toBe('INC\nOUT\nHLT');
    expect(store.switchWorkspace('computer')).toBe(true);
    expect(useDigitalStore.getState().casmDrafts.rom).toBe('INC\nOUT\nHLT');
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='rom')?.source)
      .toBe(DEFAULT_CASM_SOURCE);
  });
  it('supports separate drafts for distinct ROM instances',()=>{
    const store=useDigitalStore.getState();
    const doc=store.document;
    const rom=doc.components.find(c=>c.id==='rom')!;
    store.load({...doc,components:[...doc.components,{...rom,id:'romB',name:'SECOND ROM',x:1750}]});
    store.setCasmDraft('rom','LDI 1');
    store.setCasmDraft('romB','LDI 2');
    expect(useDigitalStore.getState().casmDrafts)
      .toMatchObject({rom:'LDI 1',romB:'LDI 2'});
    expect(store.setCasmProgram('romB','LDI 2')).toBe(true);
    expect(useDigitalStore.getState().casmDrafts.rom).toBe('LDI 1');
    expect(useDigitalStore.getState().casmDrafts.romB).toBeUndefined();
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='rom')?.source)
      .toBe(DEFAULT_CASM_SOURCE);
  });
  it('clears old drafts only when explicitly replacing/creating a project',()=>{
    const store=useDigitalStore.getState();
    store.setCasmDraft('rom','LDI 8');
    store.load(counterDemo());
    expect(useDigitalStore.getState().casmDrafts).toEqual({});
    store.setCasmDraft('__casm_scratch__','LDI 6');
    expect(useDigitalStore.getState().casmDrafts.__casm_scratch__).toBe('LDI 6');
    store.newCircuit();
    expect(useDigitalStore.getState().casmDrafts).toEqual({});
  });
  it('prevents invalid draft IDs from creating ghost ROM entries',()=>{
    const store=useDigitalStore.getState();
    store.setCasmDraft('missing','LDI 1');
    expect(useDigitalStore.getState().casmDrafts.missing).toBeUndefined();
    store.setCasmDraft('rom','X'.repeat(8193));
    expect(useDigitalStore.getState().casmDrafts.rom).toBeUndefined();
  });
});

describe('Code Studio page usability',()=>{
  it('renders dedicated editor with a target ROM, two code views, injection, and debugger',()=>{
    const html=renderToStaticMarkup(createElement(CasmProgramPanel));
    expect(html).toContain('Code Studio');
    expect(html).toContain('INJECT INTO CIRCUIT');
    expect(html).toContain('INJECT INTO ROM');
    expect(html).toContain('DRAFT PREVIEW');
    expect(html).toContain('INJECTED ROM');
    expect(html).toContain('LIVE DEBUGGER');
    expect(html).toContain('RAM INSPECTOR');
    expect(html).toContain('ASSEMBLER');
    expect(html).toContain('STEP INSTRUCTION');
    expect(html).not.toContain('CIRCUIT CANVAS');
  });
  it('clearly marks un-injected changes and shows the source in the editor',()=>{
    useDigitalStore.getState().setCasmDraft('rom','LDI 10\nOUT\nHLT');
    const html=renderToStaticMarkup(createElement(CasmProgramPanel));
    expect(html).toContain('DRAFT NOT INJECTED');
    expect(html).toContain('previous ROM program');
    expect(html).toContain('LDI 10');
    expect(html).toContain('Ctrl');
    expect(html).toContain('RESTORE FROM ROM');
  });
  it('supports a blank code scratchpad without requiring a ROM to write source',()=>{
    useDigitalStore.getState().load(counterDemo());
    useDigitalStore.getState().setCasmDraft('__casm_scratch__','LDI 7');
    const html=renderToStaticMarkup(createElement(CasmProgramPanel));
    expect(html).toContain('HARDWARE REQUIRED');
    expect(html).toContain('LDI 7');
    expect(html).toContain('No instruction ROM in circuit');
  });
});
