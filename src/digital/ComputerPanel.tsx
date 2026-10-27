import { useEffect, useMemo, useState } from 'react';
import { useDigitalStore } from './useDigitalStore';
import type { DigitalDocument, DigitalComponent, LogicResult } from './types';
import { digitalLabel,defaultRomWords } from './types';
import { counterDemo,cpuCoreDemo,flipFlopDemo,programmableCpuDemo } from './computerSamples';
import {readCpuState} from './cpuCore';

const word = (result:LogicResult,id:string):string => {
  const bits=[3,2,1,0].map(i=>result.terminalValues[id+':q'+i]??'Z');
  if(bits.some(b=>b!==0&&b!==1))return bits.join('');
  return bits.join('')+'  /  0x'+parseInt(bits.join(''),2).toString(16).toUpperCase();
};
export function ComputerPanel({doc,result}:{
  doc:DigitalDocument;result:LogicResult;
}){
  const runtime=useDigitalStore(s=>s.runtime);
  const clock=useDigitalStore(s=>s.clockStep);
  const run=useDigitalStore(s=>s.clockSteps);
  const reset=useDigitalStore(s=>s.resetClock);
  const load=useDigitalStore(s=>s.load);
  const editStack=useDigitalStore(s=>s.editStack);
  const [running,setRunning]=useState(false);
  const [speed,setSpeed]=useState(2);
  useEffect(()=>{
    if(!running)return;
    const id=window.setInterval(()=>useDigitalStore.getState().clockStep(),1000/speed);
    return ()=>window.clearInterval(id);
  },[running,speed]);
  useEffect(()=>{setRunning(false);},[doc.name,editStack.length]);
  const clockCount=doc.components.filter(c=>c.kind==='clock').length;
  const seqCount=doc.components.filter(c=>
    ['dff','tff','register4','counter4','ram16x4','cpu4'].includes(c.kind)).length;
  const stateParts=doc.components.filter(c=>
    ['dff','tff','register4','counter4','ram16x4','cpu4'].includes(c.kind));
  const loadExample=(make:()=>DigitalDocument)=>{
    try{load(make());reset();setRunning(false);}
    catch(error){window.alert(error instanceof Error?error.message:'Unable to load example.');}
  };
  return <section className="signal-computer-panel">
    <div className="signal-panel-heading">▣ COMPUTER CLOCK <span>/ SEQUENTIAL</span></div>
    <p className="signal-scope-intro">
      CLOCK STEP emits one 0 → 1 → 0 pulse. Flip-flops, registers,
      counters and writable RAM update together on its rising edge.
      The graph records one event per step.
    </p>
    <div className="computer-stats">
      <div><small>CYCLES</small><strong>{runtime.cycle}</strong></div>
      <div><small>CLOCKS</small><strong>{clockCount}</strong></div>
      <div><small>STATE PARTS</small><strong>{seqCount}</strong></div>
    </div>
    <div className="computer-clock-row">
      <button className="computer-step" onClick={clock}>↯ STEP CLOCK</button>
      <button onClick={()=>run(8)}>+8</button>
      <button onClick={()=>run(16)}>+16</button>
    </div>
    <div className="computer-clock-row">
      <button className={'computer-run'+(running?' active':'')}
        onClick={()=>setRunning(v=>!v)}>
        {running?'■ PAUSE':'▶ AUTO RUN'}
      </button>
      <label htmlFor="computer-speed">SPEED</label>
      <select id="computer-speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
        {[1,2,4,8].map(fps=><option value={fps} key={fps}>{fps} Hz</option>)}
      </select>
      <button onClick={()=>{setRunning(false);reset();}}>↺ RESET</button>
    </div>
    {!clockCount&&<p className="computer-hint">
      Add a CLOCK SOURCE and connect its OUT to a CLK pin. You can also
      use an INPUT switch for manual rising-edge triggers.
    </p>}
    <div className="computer-readouts">
      <div className="signal-section-label">LIVE STORED STATE</div>
      {!stateParts.length&&<p className="signal-scope-intro">
        Place a D flip-flop, register, counter, or RAM to store state.</p>}
      {stateParts.map(c=><div className="signal-readout" key={c.id}>
        <span>{digitalLabel(c,doc.components)}</span>
        <strong>{['dff','tff'].includes(c.kind)
          ?String(result.terminalValues[c.id+':q']??'Z')
          :c.kind==='ram16x4'?'MEMORY · 16×4':c.kind==='cpu4'?
            'PC '+readCpuState(runtime,'top/'+c.id).pc.toString(16).toUpperCase()+' · ACC '+
            readCpuState(runtime,'top/'+c.id).acc.toString(16).toUpperCase():word(result,c.id)}</strong>
      </div>)}
    </div>
    <div className="computer-demo-picker">
      <div className="signal-section-label">LOAD A COMPUTER EXPERIMENT</div>
      <button disabled={!!editStack.length} onClick={()=>loadExample(flipFlopDemo)}>
        ▣ D FLIP-FLOP
      </button>
      <button disabled={!!editStack.length} onClick={()=>loadExample(counterDemo)}>
        04 CLOCKED COUNTER
      </button>
      <button disabled={!!editStack.length} onClick={()=>loadExample(cpuCoreDemo)}>
        ◈ 4-BIT CPU DATAPATH
      </button>
      <button disabled={!!editStack.length} onClick={()=>loadExample(programmableCpuDemo)}>
        ⌘ PROGRAMMABLE CASM CPU
      </button>
    </div>
    <p className="computer-hint">
      Clock steps are logical events, not nanosecond delays. This computer foundation supports separate bit wires and grouped buses.
      Registers and RAM reset to zero when the simulation resets.
    </p>
  </section>;
}

/** Editable 16×4 ROM program stored as part of the circuit JSON. */
export function RomProgramEditor({part}: {part:DigitalComponent}){
  const save=useDigitalStore(s=>s.setRomWords);
  const initial=useMemo(()=>(part.words??defaultRomWords()).map(n=>n.toString(16).toUpperCase()),
    [part.id,part.words]);
  const [cells,setCells]=useState<string[]>(initial);
  const [error,setError]=useState('');
  useEffect(()=>{setCells(initial);setError('');},[initial]);
  const apply=()=>{
    const numbers=cells.map(c=>parseInt(c,16));
    if(numbers.length!==16||numbers.some(c=>!Number.isInteger(c)||c<0||c>15)){
      setError('Enter one hexadecimal digit (0–F) in each address.');return;
    }
    save(part.id,numbers);setError('');
  };
  return <div className="computer-rom-editor">
    <div className="signal-section-label">ROM PROGRAM · 16 × 4 BITS</div>
    <p>Each address stores a hexadecimal nibble (0–F).
      A0 is the least-significant address bit.</p>
    <div className="computer-rom-grid">
      {cells.map((cell,i)=><label key={i}>
        <span>{i.toString(16).toUpperCase().padStart(2,'0')}</span>
        <input aria-label={'ROM address '+i.toString(16).toUpperCase()}
          value={cell} maxLength={1} spellCheck={false}
          onChange={event=>{
            const value=event.target.value.toUpperCase();
            if(!/^[0-9A-F]?$/.test(value))return;
            setCells(old=>old.map((v,index)=>index===i?value:v));
            setError('');
          }}/>
      </label>)}
    </div>
    <button className="signal-generate" onClick={apply}>✓ SAVE ROM PROGRAM</button>
    {error&&<p className="signal-truth-error" role="alert">{error}</p>}
  </div>;
}
