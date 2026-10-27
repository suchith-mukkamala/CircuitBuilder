import {useEffect,useMemo,useRef,useState} from 'react';
import type {ChangeEvent,KeyboardEvent} from 'react';
import {useDigitalStore} from './useDigitalStore';
import {
  assembleCasm,CASM_INSTRUCTIONS,CASM_EXAMPLES,DEFAULT_CASM_SOURCE,
  disassembleCasm,EMPTY_PROGRAM,
} from './casm';
import {readCpuState} from './cpuCore';
import {simulateLogic} from './engine';
import type {DigitalComponent,LogicValue} from './types';

const hex=(n:number)=>n.toString(16).toUpperCase().padStart(2,'0');
const bits=(n:number,width=4)=>n.toString(2).padStart(width,'0');
const scratchKey='__casm_scratch__';
const readByte=(values:Record<string,LogicValue>,id:string):number|null=>{
  let byte=0;
  for(let i=0;i<8;i++){
    const value=values[id+':instr'+i];
    if(value!==0&&value!==1)return null;
    byte|=value<<i;
  }
  return byte;
};
const romSource=(rom:DigitalComponent)=>rom.source??
  disassembleCasm(rom.program??EMPTY_PROGRAM()).map(row=>row.source).join('\n');

const sanitize=(name:string)=>name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')
  .toLowerCase().slice(0,56)||'program';

const cpuRam=(id:string,memories:Record<string,number[]>)=>
  memories['top/'+id]??Array(16).fill(0);

/** The standalone Code Studio page of Lab 03, not a squeezed canvas sidebar. */
export function CasmProgramPanel({
  active=true,onViewHardware,
}:{
  active?:boolean;
  onViewHardware?:(romId?:string)=>void;
}={}){
  const doc=useDigitalStore(s=>s.document);
  const drafts=useDigitalStore(s=>s.casmDrafts);
  const setDraft=useDigitalStore(s=>s.setCasmDraft);
  const discardDraft=useDigitalStore(s=>s.discardCasmDraft);
  const runtime=useDigitalStore(s=>s.runtime);
  const clock=useDigitalStore(s=>s.clockStep);
  const reset=useDigitalStore(s=>s.resetClock);
  const inject=useDigitalStore(s=>s.setCasmProgram);
  const roms=doc.components.filter(c=>c.kind==='rom16x8');
  const cpus=doc.components.filter(c=>c.kind==='cpu4');
  const [romId,setRomId]=useState(roms[0]?.id??'');
  const [cpuId,setCpuId]=useState(cpus[0]?.id??'');
  const rom=roms.find(c=>c.id===romId)??roms[0];
  const cpu=cpus.find(c=>c.id===cpuId)??cpus[0];
  const selectedKey=rom?.id??scratchKey;
  const source=drafts?.[selectedKey]??(rom?romSource(rom):drafts?.[scratchKey]??DEFAULT_CASM_SOURCE);
  const stored=rom?romSource(rom):'';
  const dirty=rom?source!==stored:true;
  const compiled=useMemo(()=>assembleCasm(source),[source]);
  const [showListing,setShowListing]=useState<'preview'|'rom'>('preview');
  const [feedback,setFeedback]=useState('');
  const [running,setRunning]=useState(false);
  const [speed,setSpeed]=useState(2);
  const [breakpoints,setBreakpoints]=useState<number[]>([]);
  const inputRef=useRef<HTMLInputElement>(null);
  const codeRef=useRef<HTMLTextAreaElement>(null);
  const gutterRef=useRef<HTMLDivElement>(null);
  const cpuState=cpu?readCpuState(runtime,'top/'+cpu.id):null;
  const result=useMemo(()=>simulateLogic(doc,runtime),[doc,runtime]);
  const fetched=cpu?readByte(result.terminalValues,cpu.id):null;
  const ram=cpu?cpuRam(cpu.id,runtime.memories):Array(16).fill(0);
  const romListing=useMemo(()=>{
    if(!rom)return [];
    const bytes=rom.program??EMPTY_PROGRAM();
    const assembled=assembleCasm(stored);
    // Only attribute source lines to bytes when source really matches the ROM.
    return assembled.ok&&assembled.bytes.every((b,i)=>b===bytes[i])
      ?assembled.listing:disassembleCasm(bytes);
  },[rom?.program,stored]);
  const listing=showListing==='rom'?romListing:compiled.ok?compiled.listing:[];
  const instructionCount=compiled.listing.length;
  const editedLines=source.split('\n');

  useEffect(()=>{setRunning(false);setFeedback('');setBreakpoints([]);},
    [rom?.id,cpu?.id]);
  useEffect(()=>{if(!active)setRunning(false);},[active]);
  useEffect(()=>{
    if(!active||!running||!cpu)return;
    const timer=window.setInterval(()=>{
      const state=useDigitalStore.getState();
      const current=readCpuState(state.runtime,'top/'+cpu.id);
      if(current.halt||current.fault||breakpoints.includes(current.pc)){
        setRunning(false);return;
      }
      state.clockStep();
    },1000/speed);
    return ()=>window.clearInterval(timer);
  },[running,active,speed,cpu?.id,breakpoints]);

  const change=(next:string)=>{
    setDraft(selectedKey,next);
    setFeedback('');
    setShowListing('preview');
  };
  const injectToCircuit=()=>{
    setRunning(false);
    if(!rom){setFeedback('No 16×8 ROM found. Add one in Hardware before injecting.');return;}
    if(!compiled.ok){
      setFeedback('Fix the assembler errors below. Existing ROM contents were not changed.');return;
    }
    if(inject(rom.id,source)){
      setShowListing('rom');
      setFeedback('✓ INJECTED '+instructionCount+' instruction'+(instructionCount===1?'':'s')+
        ' into '+(rom.name??rom.id)+'. CPU state reset; hardware connections were preserved.');
    }
  };
  const focusLine=(line:number)=>{
    const textarea=codeRef.current;
    if(!textarea)return;
    const lines=source.split('\n');
    const start=lines.slice(0,line-1).reduce((n,s)=>n+s.length+1,0);
    textarea.focus();textarea.setSelectionRange(start,start+(lines[line-1]?.length??0));
    // Scroll to the target line without changing its contents.
    textarea.scrollTop=Math.max(0,(line-4)*24);
    if(gutterRef.current)gutterRef.current.scrollTop=textarea.scrollTop;
  };
  const keyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{
    if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){
      event.preventDefault();injectToCircuit();return;
    }
    if(event.key==='Tab'){
      event.preventDefault();
      const target=event.currentTarget,start=target.selectionStart,end=target.selectionEnd;
      change(source.slice(0,start)+'    '+source.slice(end));
      requestAnimationFrame(()=>{target.focus();target.setSelectionRange(start+4,start+4);});
    }
  };
  const useExample=(key:string)=>{
    const example=CASM_EXAMPLES.find(item=>item.id===key);
    if(!example)return;
    if(dirty&&source!==example.source&&!window.confirm(
      'Replace the current CASM draft with this example? The injected ROM will not change.'))return;
    change(example.source);
    setFeedback('Example copied into your draft. Inject to update the hardware ROM.');
  };
  const restore=()=>{
    if(!rom)return;
    if(dirty&&!window.confirm('Discard the un-injected draft and restore source from ROM?'))return;
    discardDraft(rom.id);setFeedback('Restored the source currently stored in ROM.');
    setShowListing('rom');
  };
  const download=()=>{
    const blob=new Blob([source],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=sanitize(doc.name)+'.casm';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    URL.revokeObjectURL(url);
    setFeedback('CASM source exported as a separate .casm file.');
  };
  const importFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file)return;
    if(file.size>8192){
      setFeedback('Source file is too large (maximum 8192 bytes).');return;
    }
    if(dirty&&!window.confirm('Replace your current CASM draft with '+file.name+'?'))return;
    try{
      const text=await file.text();
      if(text.length>8192)throw Error('Source exceeds 8192 characters.');
      change(text);setFeedback('Imported '+file.name+' into the draft. ROM is unchanged.');
    }catch(error){
      setFeedback(error instanceof Error?error.message:'Could not open CASM source.');
    }
  };

  return <main className="casm-studio" aria-label="Circuit Assembly Code Studio">
    <div className="casm-studio-intro">
      <div>
        <span className="casm-studio-eyebrow">LAB 03 / COMPUTER BUILDER / SOURCE</span>
        <h1>Code Studio <small>CASM v1</small></h1>
        <p>Write and test your assembly separately. Inject it into a ROM when you're ready.</p>
      </div>
      <div className="casm-studio-intro-actions">
        {onViewHardware&&<button onClick={()=>onViewHardware(rom?.id)}>
          ◈ VIEW TARGET IN HARDWARE
        </button>}
        <span className={'casm-injection-state'+(dirty?' needs-injection':'')}>
          {dirty?'● DRAFT NOT INJECTED':'✓ SOURCE IN ROM'}
        </span>
      </div>
    </div>
    <div className="casm-studio-columns">
      <div className="casm-studio-left">
        <section className="casm-studio-card casm-editor-card">
          <div className="casm-studio-card-title">
            <div><strong>01 / SOURCE EDITOR</strong><span>main.casm · drafts saved locally</span></div>
            <span className="casm-editor-counter">{source.length} / 8192</span>
          </div>
          <div className="casm-studio-selectors">
            <label htmlFor="casm-target-rom">INJECT INTO ROM
              <select id="casm-target-rom" value={rom?.id??''}
                disabled={!roms.length} onChange={event=>{
                  setRomId(event.target.value);setShowListing('rom');
                }}>
                {!roms.length&&<option value="">No instruction ROM in circuit</option>}
                {roms.map(item=><option key={item.id} value={item.id}>
                  {item.name??item.id} ({item.id})
                </option>)}
              </select>
            </label>
            <label htmlFor="casm-example">EXAMPLE
              <select id="casm-example" value="" onChange={event=>useExample(event.target.value)}>
                <option value="">Choose an example...</option>
                {CASM_EXAMPLES.map(example=><option value={example.id} key={example.id}>
                  {example.name}
                </option>)}
              </select>
            </label>
          </div>
          <div className="casm-file-bar">
            <span>⌘ CASM SOURCE</span>
            <div>
              <button onClick={()=>inputRef.current?.click()} title="Open an existing .casm text file">
                ⇧ IMPORT .CASM
              </button>
              <button onClick={download} title="Download the current draft as a .casm text file">
                ⇩ EXPORT .CASM
              </button>
              <button disabled={!rom||!dirty} onClick={restore}>↺ RESTORE FROM ROM</button>
            </div>
          </div>
          <input hidden type="file" ref={inputRef} accept=".casm,.asm,.txt,text/plain"
            onChange={importFile}/>
          <div className="casm-editor-surface">
            <div className="casm-line-gutter" ref={gutterRef} aria-hidden="true">
              {editedLines.map((_,i)=><div key={i} className={compiled.issues.some(e=>e.line===i+1)?
                'has-error':''}>{String(i+1).padStart(2,'0')}</div>)}
            </div>
            <textarea ref={codeRef} className="casm-studio-code" aria-label="CASM assembly source"
              value={source} onChange={event=>change(event.target.value)}
              onKeyDown={keyDown}
              onScroll={event=>{if(gutterRef.current)gutterRef.current.scrollTop=
                event.currentTarget.scrollTop;}}
              rows={17} spellCheck={false} autoCapitalize="off" autoComplete="off"
              placeholder={'START:\n    LDI 3\n    ADD 5\n    OUT\n    HLT'}/>
          </div>
          <div className="casm-build-bar">
            <div className="casm-build-status">
              <span className={compiled.ok?'build-ok':'build-fail'}>
                {compiled.ok?'✓ READY TO INJECT':'✖ ASSEMBLER ERRORS'}
              </span>
              <small>{instructionCount} / 16 instructions</small>
            </div>
            <button className="casm-inject-button" disabled={!rom||!compiled.ok}
              onClick={injectToCircuit}>
              ↯ ASSEMBLE &amp; INJECT INTO CIRCUIT
            </button>
          </div>
          {dirty&&<p className="casm-draft-warning">
            Draft saved locally. Your CPU still executes the <b>previous ROM program</b>
            until you inject this code.
          </p>}
          <div className="casm-build-help">Shortcut: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> +
            <kbd> Enter</kbd> to inject · <kbd>Tab</kbd> to indent.</div>
          {feedback&&<p role="status" className="casm-feedback">{feedback}</p>}
          {!!compiled.issues.length&&<div className="casm-errors" role="alert">
            {compiled.issues.slice(0,12).map((issue,i)=><button type="button"
              onClick={()=>focusLine(issue.line)} key={i}>
              <b>LINE {issue.line}</b> · {issue.message} <span>⌖</span>
            </button>)}
          </div>}
        </section>
        <section className="casm-studio-card casm-bytecode-card">
          <div className="casm-studio-card-title">
            <div><strong>02 / MACHINE CODE</strong><span>Inspect compiled bytes or live ROM</span></div>
          </div>
          <div className="casm-bytecode-tabs" role="tablist" aria-label="Bytecode view">
            <button role="tab" aria-selected={showListing==='preview'}
              className={showListing==='preview'?'is-active':''}
              onClick={()=>setShowListing('preview')}>DRAFT PREVIEW</button>
            <button role="tab" aria-selected={showListing==='rom'}
              className={showListing==='rom'?'is-active':''}
              onClick={()=>setShowListing('rom')}>INJECTED ROM</button>
          </div>
          <div className="casm-listing casm-studio-listing" role="table" aria-label={
            showListing==='rom'?'Machine code currently in ROM':'Draft machine code preview'}>
            <div className="casm-listing-header" role="row">
              <span>●</span><span>PC</span><span>HEX</span><span>ASSEMBLY</span>
            </div>
            {listing.map(row=><button type="button" role="row" key={row.address}
              className={'casm-listing-row'+
                ((showListing==='rom'||!dirty)&&cpuState?.pc===row.address?
                  ' is-current':'')+
                (breakpoints.includes(row.address)?' has-breakpoint':'')}
              title="Toggle a breakpoint before this ROM address executes"
              aria-label={'Toggle breakpoint at address '+row.address}
              onClick={()=>setBreakpoints(items=>items.includes(row.address)?
                items.filter(i=>i!==row.address):[...items,row.address])}>
              <span>{breakpoints.includes(row.address)?'●':'○'}</span>
              <span>{row.address.toString(16).toUpperCase()}</span>
              <span>{hex(row.byte)}</span><span>{row.source}</span>
            </button>)}
            {!listing.length&&<p className="casm-hint">{!compiled.ok&&showListing==='preview'?
              'Fix the assembly errors above to preview compiled bytes.':
              'No instructions in this view yet.'}</p>}
          </div>
          <p className="casm-bytecode-note">{showListing==='rom'?
            'These bytes are physically stored in the selected ROM. Clicking a dot toggles a breakpoint.':
            'Preview only: editing this source does not change the circuit. Use INJECT to program ROM.'}</p>
        </section>
      </div>
      <div className="casm-studio-right">
        <section className="casm-studio-card casm-debug-card">
          <div className="casm-studio-card-title">
            <div><strong>03 / LIVE DEBUGGER</strong><span>Driven by simulated CPU wires</span></div>
            <span className={'casm-debug-indicator'+(running?' is-running':'')}>
              {running?'● RUNNING':'● PAUSED'}
            </span>
          </div>
          <div className="casm-debug-target">
            <label htmlFor="casm-core">CPU CORE</label>
            <select id="casm-core" value={cpu?.id??''} disabled={!cpus.length}
              onChange={event=>setCpuId(event.target.value)}>
              {!cpus.length&&<option value="">No CPU core</option>}
              {cpus.map(item=><option key={item.id} value={item.id}>
                {item.name??item.id} ({item.id})
              </option>)}
            </select>
          </div>
          {!rom||!cpu?<div className="casm-studio-empty">
            <strong>HARDWARE REQUIRED</strong>
            <p>Add a 16×8 Program ROM and a 4-bit CASM CPU in Hardware.
              Then connect PC[3:0] and INSTR[7:0] using buses.</p>
            {onViewHardware&&<button onClick={()=>onViewHardware()}>
              ◈ OPEN HARDWARE
            </button>}
          </div>:null}
          <div className="casm-cpu-readouts casm-studio-readouts">
            {[
              ['PC',cpuState?hex(cpuState.pc):'—'],
              ['ACC',cpuState?hex(cpuState.acc):'—'],
              ['OUT',cpuState?hex(cpuState.out):'—'],
              ['CYCLE',String(runtime.cycle)],
            ].map(([name,value])=><div key={name}>
              <small>{name}</small><strong>{value}</strong>
            </div>)}
          </div>
          <div className="casm-flags">
            <span>ZERO <b>{cpuState?.zero??'—'}</b></span>
            <span>CARRY <b>{cpuState?.carry??'—'}</b></span>
            <span className={cpuState?.halt?'is-lit':''}>HALT <b>{cpuState?.halt??'—'}</b></span>
            <span className={cpuState?.fault?'is-fault':''}>FAULT <b>{cpuState?.fault??'—'}</b></span>
          </div>
          <div className="casm-current">
            <span>FETCHED FROM WIRES <strong>{fetched===null?'X / FLOATING':hex(fetched)}</strong></span>
            <span>LAST EXECUTED <strong>{cpuState?hex(cpuState.ir):'—'}</strong></span>
            <span>OUTPUT BITS <strong>{cpuState?bits(cpuState.out):'----'}</strong></span>
          </div>
          <div className="casm-run-row casm-studio-run">
            <button className="casm-primary" disabled={!cpu}
              onClick={()=>{setRunning(false);if(cpu)clock();}}>↯ STEP INSTRUCTION</button>
            <button disabled={!cpu||!!cpuState?.halt||!!cpuState?.fault}
              className={running?'casm-running':''}
              onClick={()=>setRunning(v=>!v)}>{running?'■ PAUSE':'▶ RUN'}</button>
            <button onClick={()=>{setRunning(false);reset();}}>↺ RESET</button>
          </div>
          <div className="casm-run-row casm-speed">
            <label htmlFor="casm-speed">RUN SPEED</label>
            <select id="casm-speed" value={speed}
              onChange={event=>setSpeed(Number(event.target.value))}>
              {[1,2,4,8].map(v=><option key={v} value={v}>{v} instr/s</option>)}
            </select>
          </div>
          {cpuState?.halt&&<div className={'casm-notice'+(cpuState.fault?' casm-fault':'')}>
            {cpuState.fault?'CPU FAULT: check the instruction bus and opcode, then reset.':
              'CPU HALTED. Reset to run the program again.'}
          </div>}
          <p className="casm-bytecode-note">Breakpoints stop <b>before</b> the selected ROM
            address executes. Single-step ignores breakpoints. When you inject, the CPU resets.</p>
        </section>
        <section className="casm-studio-card casm-memory-card">
          <div className="casm-studio-card-title">
            <div><strong>04 / RAM INSPECTOR</strong><span>16 words × 4 bits</span></div>
          </div>
          <div className="casm-ram-grid">
            {ram.map((word,address)=><div key={address}
              title={'RAM address '+address+' · '+(word&15)+' decimal'}>
              <span>{hex(address)}</span>
              <strong>{(word&15).toString(16).toUpperCase()}</strong>
            </div>)}
          </div>
        </section>
        <details className="casm-reference casm-studio-reference">
          <summary>⌘ ISA REFERENCE / ALL INSTRUCTIONS</summary>
          <p>One-byte instruction: 4-bit opcode + 4-bit immediate/address.
            Arithmetic wraps at 4 bits. SUB CARRY indicates a borrow.</p>
          {CASM_INSTRUCTIONS.map(op=><div key={op.opcode} className="casm-ref-line">
            <strong>{op.opcode.toString(16).toUpperCase()}</strong>
            <span>{op.name}{op.operand?' n':''}</span>
            <small>{op.description}</small>
          </div>)}
        </details>
      </div>
    </div>
    <footer className="casm-studio-footer">CASM v1 / 16 INSTRUCTIONS MAX ·
      The ROM and CPU are editable circuit components. CPU4 uses a fixed internal
      decoder; custom ISA support is a future milestone.</footer>
  </main>;
}
