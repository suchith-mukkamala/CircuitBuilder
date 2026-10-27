import {useEffect,useMemo,useState} from 'react';
import {useDigitalStore} from './useDigitalStore';
import {assembleCasm,CASM_INSTRUCTIONS,DEFAULT_CASM_SOURCE,
  disassembleCasm,EMPTY_PROGRAM} from './casm';
import {readCpuState} from './cpuCore';
import {simulateLogic} from './engine';
import type {DigitalComponent,LogicValue} from './types';

const hex=(n:number)=>n.toString(16).toUpperCase().padStart(2,'0');
const bits=(n:number,width=4)=>n.toString(2).padStart(width,'0');
const currentByteFromWires=(values:Record<string,LogicValue>,id:string):number|null=>{
  let byte=0;
  for(let i=0;i<8;i++){
    const bit=values[id+':instr'+i];
    if(bit!==0&&bit!==1)return null;
    byte|=bit<<i;
  }
  return byte;
};
const freshSource=(rom:DigitalComponent):string=>
  rom.source??disassembleCasm(rom.program??EMPTY_PROGRAM())
    .map(i=>i.source).join('\n');

export function CasmProgramPanel(){
  const doc=useDigitalStore(s=>s.document);
  const runtime=useDigitalStore(s=>s.runtime);
  const clock=useDigitalStore(s=>s.clockStep);
  const reset=useDigitalStore(s=>s.resetClock);
  const save=useDigitalStore(s=>s.setCasmProgram);
  const roms=doc.components.filter(c=>c.kind==='rom16x8');
  const cpus=doc.components.filter(c=>c.kind==='cpu4');
  const [romId,setRomId]=useState(roms[0]?.id??'');
  const [cpuId,setCpuId]=useState(cpus[0]?.id??'');
  const rom=roms.find(c=>c.id===romId)??roms[0];
  const cpu=cpus.find(c=>c.id===cpuId)??cpus[0];
  const [source,setSource]=useState(rom?freshSource(rom):DEFAULT_CASM_SOURCE);
  const [running,setRunning]=useState(false);
  const [speed,setSpeed]=useState(2);
  const [breakpoints,setBreakpoints]=useState<number[]>([]);
  const [feedback,setFeedback]=useState('');
  // A new document or reloaded program resets the editing baseline.
  useEffect(()=>{
    setSource(rom?freshSource(rom):DEFAULT_CASM_SOURCE);
    setFeedback('');
    setRunning(false);
  },[rom?.id,rom?.source,rom?.program,doc.name]);
  useEffect(()=>{setRunning(false);},[cpu?.id]);
  const assembled=useMemo(()=>assembleCasm(source),[source]);
  const dirty=rom?source!==freshSource(rom):false;
  const pc=cpu?readCpuState(runtime,'top/'+cpu.id):null;
  const result=useMemo(()=>simulateLogic(doc,runtime),[doc,runtime]);
  const fetched=cpu?currentByteFromWires(result.terminalValues,cpu.id):null;
  const ram=cpu?runtime.memories['top/'+cpu.id]??Array(16).fill(0):Array(16).fill(0);
  const current=pc?.pc??0;
  useEffect(()=>{
    if(!running)return;
    const handle=window.setInterval(()=>{
      const state=useDigitalStore.getState();
      const active=cpu?readCpuState(state.runtime,'top/'+cpu.id):null;
      if(!active||active.halt||active.fault||breakpoints.includes(active.pc)){
        setRunning(false);return;
      }
      state.clockStep();
    },1000/speed);
    return ()=>window.clearInterval(handle);
  },[running,speed,cpu?.id,breakpoints]);
  const assembleAndLoad=()=>{
    if(!rom)return;
    if(!assembled.ok){setFeedback('Correct the assembler errors first. ROM was not changed.');return;}
    if(save(rom.id,source)){
      setRunning(false);
      setFeedback('✓ Loaded '+assembled.listing.length+' instructions into '+rom.name+'. Registers reset.');
    }
  };
  const toggleBreakpoint=(address:number)=>{
    setBreakpoints(items=>items.includes(address)?
      items.filter(a=>a!==address):[...items,address]);
  };
  const doStep=()=>{
    setRunning(false);
    if(!cpu){setFeedback('Add a CPU4 component first.');return;}
    clock();
  };
  const noComputer=roms.length===0||cpus.length===0;
  return <section className="casm-workspace" aria-label="Circuit Assembly program editor">
    <div className="signal-panel-heading">⌘ CIRCUIT ASSEMBLY <span>/ CASM v1</span></div>
    <div className="casm-intro">
      Write assembly, assemble to ROM, then execute it through the actual
      instruction bus and clocked CPU circuit.
    </div>
    {noComputer&&<div className="casm-notice" role="status">
      Add a <b>16×8 Program ROM</b> and a <b>4-Bit CASM CPU</b>,
      or open the <b>Programmable CPU</b> sample in Project / Examples.
    </div>}
    <div className="casm-selectors">
      <label>PROGRAM ROM
        <select aria-label="Instruction ROM" disabled={!roms.length}
          value={rom?.id??''} onChange={e=>setRomId(e.target.value)}>
          {!roms.length&&<option value="">No instruction ROM</option>}
          {roms.map(c=><option key={c.id} value={c.id}>{c.name??c.id}</option>)}
        </select>
      </label>
      <label>CPU CORE
        <select aria-label="CPU core" disabled={!cpus.length}
          value={cpu?.id??''} onChange={e=>setCpuId(e.target.value)}>
          {!cpus.length&&<option value="">No programmable CPU</option>}
          {cpus.map(c=><option key={c.id} value={c.id}>{c.name??c.id}</option>)}
        </select>
      </label>
    </div>
    <div className="casm-editor-heading">
      <span>main.casm</span><span>{dirty?'● UNSAVED SOURCE':'✓ ROM SYNCED'}</span>
    </div>
    <textarea className="casm-code" aria-label="CASM assembly source" rows={10}
      spellCheck={false} autoCapitalize="off" autoComplete="off"
      value={source} onChange={e=>{setSource(e.target.value);setFeedback('');}}
      placeholder={'LDI 3\nADD 5\nOUT\nHLT'}/>
    <div className="casm-compile-actions">
      <button disabled={!rom||!assembled.ok} className="casm-primary"
        onClick={assembleAndLoad}>▣ ASSEMBLE & LOAD</button>
      <span className={assembled.ok?'casm-compiled':'casm-invalid'}>
        {assembled.ok?'✓ '+assembled.listing.length+' / 16 INSTRUCTIONS':
          '✖ '+assembled.issues.length+' ERROR(S)'}
      </span>
    </div>
    {!!feedback&&<div className="casm-feedback" role="status">{feedback}</div>}
    {assembled.issues.length>0&&<div className="casm-errors" role="alert">
      {assembled.issues.slice(0,8).map((issue,i)=>
        <p key={i}><b>LINE {issue.line}</b> · {issue.message}</p>)}
    </div>}
    <div className="casm-section-title">▦ INSTRUCTION MEMORY / BYTECODE</div>
    <div className="casm-listing" role="table" aria-label="Compiled instructions">
      <div className="casm-listing-header" role="row">
        <span>●</span><span>PC</span><span>HEX</span><span>ASSEMBLY</span>
      </div>
      {(assembled.ok?assembled.listing:[]).map(row=>
        <button type="button" role="row" key={row.address}
          className={'casm-listing-row'+(pc?.pc===row.address?' is-current':'')+
            (breakpoints.includes(row.address)?' has-breakpoint':'')}
          aria-label={'Toggle breakpoint at address '+row.address}
          title="Toggle breakpoint · stops before executing this address"
          onClick={()=>toggleBreakpoint(row.address)}>
          <span>{breakpoints.includes(row.address)?'●':'○'}</span>
          <span>{row.address.toString(16).toUpperCase()}</span>
          <span>{hex(row.byte)}</span>
          <span>{row.source}</span>
        </button>)}
      {!assembled.ok&&<p className="casm-hint">Fix errors to preview and load new machine code.</p>}
      {assembled.ok&&!assembled.listing.length&&<p className="casm-hint">Write an instruction to see its machine code.</p>}
    </div>
    <div className="casm-section-title">↯ CPU EXECUTION</div>
    <div className="casm-cpu-readouts">
      {[
        ['PC',pc?hex(pc.pc):'—'],
        ['ACC',pc?hex(pc.acc):'—'],
        ['OUT',pc?hex(pc.out):'—'],
        ['CYCLE',String(runtime.cycle)],
      ].map(([name,value])=><div key={name}><small>{name}</small><strong>{value}</strong></div>)}
    </div>
    <div className="casm-flags">
      <span>ZERO <b>{pc?.zero??'—'}</b></span>
      <span>CARRY <b>{pc?.carry??'—'}</b></span>
      <span className={pc?.halt?'is-lit':''}>HALT <b>{pc?.halt??'—'}</b></span>
      <span className={pc?.fault?'is-fault':''}>FAULT <b>{pc?.fault??'—'}</b></span>
    </div>
    <div className="casm-current">
      <span>FETCHED VIA WIRES <strong>{fetched===null?'X / FLOATING':hex(fetched)}</strong></span>
      <span>LAST EXECUTED <strong>{pc?hex(pc.ir):'—'}</strong></span>
      <span>OUTPUT BITS <strong>{pc?bits(pc.out):'----'}</strong></span>
    </div>
    <div className="casm-run-row">
      <button onClick={doStep} disabled={!cpu} className="casm-primary">↯ STEP INSTRUCTION</button>
      <button disabled={!cpu||!!pc?.halt||!!pc?.fault}
        className={running?'casm-running':''} onClick={()=>setRunning(v=>!v)}>
        {running?'■ PAUSE':'▶ RUN'}
      </button>
      <button onClick={()=>{setRunning(false);reset();}}>↺ RESET</button>
    </div>
    <div className="casm-run-row casm-speed">
      <label htmlFor="casm-speed">EXECUTION SPEED</label>
      <select id="casm-speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
        {[1,2,4,8].map(hz=><option key={hz} value={hz}>{hz} instr/s</option>)}
      </select>
    </div>
    {!!pc?.halt&&<p className={'casm-notice'+(pc.fault?' casm-fault':'')}>
      {pc.fault?'CPU FAULT — an instruction wire is undriven or the opcode is invalid. '+
        'Inspect the instruction bus, then RESET.':'CPU HALTED — press RESET to execute again.'}
    </p>}
    <div className="casm-section-title">▦ CPU RAM / 16 × 4</div>
    <div className="casm-ram-grid" aria-label="Current RAM values">
      {ram.map((n,address)=><div key={address} title={'Address '+address}>
        <span>{hex(address)}</span><strong>{(n&15).toString(16).toUpperCase()}</strong>
      </div>)}
    </div>
    <details className="casm-reference">
      <summary>⌘ CASM INSTRUCTION REFERENCE</summary>
      <p>One-byte format: high nibble = opcode, low nibble = number or address.
        Accumulator arithmetic wraps at 4 bits. SUB CARRY indicates a borrow.
        Branches read the previous ZERO flag.</p>
      {CASM_INSTRUCTIONS.map(i=><div key={i.opcode} className="casm-ref-line">
        <strong>{i.opcode.toString(16).toUpperCase()}</strong>
        <span>{i.name}{i.operand?' n':''}</span><small>{i.description}</small>
      </div>)}
    </details>
    <p className="casm-hint">An instruction executes on one rising clock pulse.
      This first CPU uses a fixed internal decoder; constructing a control
      unit gate-by-gate is the next hardware milestone. The circuit's ROM,
      buses and CPU pins are editable. Breakpoints are local to this panel.</p>
  </section>;
}
