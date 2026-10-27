import {beforeEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {assembleCasm,DEFAULT_CASM_SOURCE} from './casm';
import {initialCpuState,executeCasm,readCpuState} from './cpuCore';
import {programmableCpuDemo} from './computerSamples';
import {emptyDigitalRuntime,isDigitalDocument,busGroups,inputsOf,outputsOf,
  type DigitalDocument} from './types';
import {simulateLogic} from './engine';
import {stepCircuit} from './computerEngine';
import {useDigitalStore,persistedDigitalState} from './useDigitalStore';
import {CasmProgramPanel} from './CasmProgramPanel';

const docFor=(source:string):DigitalDocument=>{
  const assembled=assembleCasm(source);
  if(!assembled.ok)throw new Error('Test source did not assemble.');
  const doc=programmableCpuDemo();
  return {...doc,components:doc.components.map(c=>c.id==='rom'?
    {...c,source,program:assembled.bytes}:c)};
};
const run=(doc:DigitalDocument,n:number)=>{
  let runtime=emptyDigitalRuntime();
  for(let i=0;i<n;i++)runtime=stepCircuit(doc,runtime);
  return {runtime,cpu:readCpuState(runtime,'top/cpu')};
};

describe('CASM executes through wired ROM and clocked CPU',()=>{
  it('connects a 4-bit program-counter and a real 8-bit instruction bus',()=>{
    const doc=programmableCpuDemo();
    expect(isDigitalDocument(doc)).toBe(true);
    expect(doc.buses?.map(b=>b.width)).toEqual([4,8,4]);
    const rom=doc.components.find(c=>c.id==='rom')!;
    const cpu=doc.components.find(c=>c.id==='cpu')!;
    expect(inputsOf(rom)).toEqual(['a0','a1','a2','a3']);
    expect(outputsOf(rom)).toEqual(Array.from({length:8},(_,i)=>'data'+i));
    expect(busGroups(cpu).map(g=>g.width)).toEqual([8,4,4,4]);
    expect(simulateLogic(doc).warnings).toEqual([]);
    expect(simulateLogic(doc).terminalValues['cpu:instr0']).toBe(1);
    expect(simulateLogic(doc).terminalValues['cpu:instr4']).toBe(1);
  });
  it('runs LDI 3 / ADD 5 / OUT / HLT, and holds state after HLT',()=>{
    const doc=programmableCpuDemo();
    expect([0,1,2,3,4].map(n=>{
      const s=run(doc,n).cpu;return [s.pc,s.acc,s.out,s.halt,s.fault];
    })).toEqual([
      [0,0,0,0,0],[1,3,0,0,0],[2,8,0,0,0],
      [3,8,8,0,0],[3,8,8,1,0],
    ]);
    const state=run(doc,7);
    expect(state.cpu).toEqual(run(doc,4).cpu);
    expect(simulateLogic(doc,state.runtime).ledValues.out3).toBe(1);
    expect(simulateLogic(doc,state.runtime).ledValues.haltLED).toBe(1);
  });
  it('writes and reads RAM, and updates the external port only when OUT runs',()=>{
    const doc=docFor('LDI 4\nSTORE 1\nLDI 0\nLOAD 1\nADD 2\nOUT\nHLT');
    expect(run(doc,2).runtime.memories['top/cpu'][1]).toBe(4);
    expect(run(doc,2).cpu.out).toBe(0);
    expect(run(doc,4).cpu.acc).toBe(4);
    const completed=run(doc,7).cpu;
    expect(completed.acc).toBe(6);
    expect(completed.out).toBe(6);
    expect(completed.halt).toBe(1);
  });
  it('supports zero-conditional jumps and loop labels',()=>{
    const doc=docFor('LDI 0\nJZ DONE\nLDI 9\nOUT\nDONE: LDI 7\nOUT\nHLT');
    expect(run(doc,2).cpu.pc).toBe(4);
    expect(run(doc,5).cpu.out).toBe(7);
    const loop=docFor('LDI 2\nLOOP: SUB 1\nJNZ LOOP\nOUT\nHLT');
    expect(run(loop,8).cpu.out).toBe(0);
    expect(run(loop,8).cpu.halt).toBe(1);
  });
  it('wraps ACC at four bits, sets carry/borrow, and drives ZERO flag',()=>{
    const a=run(docFor('LDI 15\nADD 1\nOUT\nHLT'),2).cpu;
    expect([a.acc,a.carry,a.zero]).toEqual([0,1,1]);
    const b=run(docFor('LDI 0\nSUB 2\nOUT\nHLT'),2).cpu;
    expect([b.acc,b.carry,b.zero]).toEqual([14,1,0]);
  });
  it('executes AND OR XOR and INC; outputs latch the pre-increment value',()=>{
    const doc=docFor('LDI 5\nAND 3\nOR 8\nXOR 2\nOUT\nINC\nHLT');
    expect(run(doc,2).cpu.acc).toBe(1);
    expect(run(doc,3).cpu.acc).toBe(9);
    expect(run(doc,4).cpu.acc).toBe(11);
    expect(run(doc,6).cpu.out).toBe(11);
    expect(run(doc,6).cpu.acc).toBe(12);
  });
  it('faults on invalid wired opcodes and on disconnected instruction buses',()=>{
    const doc=docFor('LDI 2\nHLT');
    const bad={...doc,components:doc.components.map(c=>c.id==='rom'?
      {...c,program:[0xF0,...(c.program??[]).slice(1)]}:c)};
    expect(run(bad,1).cpu).toMatchObject({fault:1,halt:1,pc:0});
    const missing={...doc,buses:doc.buses?.filter(b=>b.id!=='instructionBus')};
    expect(simulateLogic(missing).terminalValues['cpu:instr0']).toBe('Z');
    expect(run(missing,1).cpu).toMatchObject({fault:1,halt:1,acc:0});
  });
  it('performs synchronous RESET and restarts the program',()=>{
    const doc=programmableCpuDemo();
    const halted=run(doc,4);
    expect(halted.cpu.halt).toBe(1);
    const asserted={...doc,components:doc.components.map(c=>
      c.id==='rst'?{...c,bit:1 as const}:c)};
    const reset=stepCircuit(asserted,halted.runtime);
    expect(readCpuState(reset,'top/cpu')).toEqual(initialCpuState());
    expect(readCpuState(stepCircuit(doc,reset),'top/cpu').acc).toBe(3);
  });
  it('keeps independent RAM for separate CPU states',()=>{
    const prev=initialCpuState();
    const loaded=executeCasm(prev,0x15,Array(16).fill(0));
    const written=executeCasm(loaded.state,0x82,loaded.ram);
    const unrelated=executeCasm(prev,0x71,Array(16).fill(0));
    expect(written.ram[2]).toBe(5);
    expect(unrelated.ram[2]).toBe(0);
  });
  it('rejects malformed ROM bytes/source without impacting old imports',()=>{
    const doc=programmableCpuDemo();
    expect(isDigitalDocument({...doc,components:doc.components.map(c=>
      c.id==='rom'?{...c,program:[256]}:c)})).toBe(false);
    expect(isDigitalDocument({...doc,components:doc.components.map(c=>
      c.id==='rom'?{...c,source:'a'.repeat(8193)}:c)})).toBe(false);
    expect(isDigitalDocument({...doc,components:doc.components.map(c=>
      c.id==='rom'?{...c,program:undefined,source:undefined}:c)})).toBe(true);
  });
});

describe('CASM editor and browser project persistence',()=>{
  beforeEach(()=>{
    const doc=programmableCpuDemo();
    useDigitalStore.setState({
      activeWorkspace:'computer',document:doc,computerDocument:doc,
      runtime:emptyDigitalRuntime(),trace:[],past:[],future:[],
      selection:null,selectedIds:[],pending:null,pendingBus:null,
      editStack:[],dragOrigin:null,
    });
  });
  it('assembles source and machine code into a saved, portable ROM',()=>{
    const store=useDigitalStore.getState();
    expect(store.setCasmProgram('rom','LDI 9\nOUT\nHLT')).toBe(true);
    const doc=useDigitalStore.getState().document;
    const rom=doc.components.find(c=>c.id==='rom')!;
    expect(rom.program?.slice(0,3)).toEqual([0x19,0xC0,0xD0]);
    expect(rom.source).toBe('LDI 9\nOUT\nHLT');
    expect(isDigitalDocument(JSON.parse(JSON.stringify(doc)))).toBe(true);
    expect(persistedDigitalState(useDigitalStore.getState()).computerDocument.components
      .find(c=>c.id==='rom')?.source).toBe('LDI 9\nOUT\nHLT');
    expect(run(doc,3).cpu).toMatchObject({out:9,halt:1});
  });
  it('does not overwrite a program when assembly has an error',()=>{
    const before=useDigitalStore.getState().document;
    expect(useDigitalStore.getState().setCasmProgram('rom','JMP MISSING')).toBe(false);
    expect(useDigitalStore.getState().document).toBe(before);
    expect(useDigitalStore.getState().message).toMatch(/Assembler errors/);
  });
  it('resets simulation after program loading and supports Undo',()=>{
    useDigitalStore.getState().clockSteps(3);
    expect(useDigitalStore.getState().runtime.cycle).toBe(3);
    useDigitalStore.getState().setCasmProgram('rom','LDI 9\nOUT\nHLT');
    expect(useDigitalStore.getState().runtime.cycle).toBe(0);
    useDigitalStore.getState().undo();
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='rom')?.source)
      .toBe(DEFAULT_CASM_SOURCE);
  });
  it('renders the CASM source editor, bytecode, breakpoints and register display',()=>{
    const html=renderToStaticMarkup(createElement(CasmProgramPanel));
    expect(html).toContain('CIRCUIT ASSEMBLY');
    expect(html).toContain('ASSEMBLE &amp; LOAD');
    expect(html).toContain('STEP INSTRUCTION');
    expect(html).toContain('CPU RAM');
    expect(html).toContain('main.casm');
  });
});
