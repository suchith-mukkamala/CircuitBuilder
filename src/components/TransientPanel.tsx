import {useEffect,useId,useMemo,useRef,useState,type PointerEvent} from 'react';
import {useCircuitStore} from '../state/useCircuitStore';
import {formatElectrical,labelFor,type TransientResult} from '../circuit/types';
import {transientPlot} from '../editor/transientPlot';

function ScopePlot({result,ids,kind,index,range,onIndex}:{result:TransientResult;ids:string[];kind:'voltage'|'current';index:number;range?:{min:number;max:number};onIndex:(index:number)=>void}){
  const plot=useMemo(()=>transientPlot(result,ids,kind,range),[result,ids.join(','),kind,range?.min,range?.max]);
  const clipId='scope-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const choose=(event:PointerEvent<SVGSVGElement>)=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    const matrix=event.currentTarget.getScreenCTM();
    const x=matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()).x:(event.clientX-bounds.left)/bounds.width*360;
    onIndex(Math.round(Math.max(0,Math.min(1,(x-52)/290))*result.steps));
  };
  return <svg className="transient-plot" viewBox="0 0 360 160" role="img" aria-label={'Component '+kind+' versus time; drag to move the time cursor'}
    onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);choose(event);}}
    onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))choose(event);}}
    onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}>
    <defs><clipPath id={clipId}><rect x="52" y="20" width="290" height="105"/></clipPath></defs>
    <g stroke="#34546b" strokeWidth=".7" fill="none"><path d="M52 20V125H342"/>
      <path d="M52 46H342M52 72H342M52 98H342M124 20V125M197 20V125M270 20V125" strokeDasharray="3 4"/></g>
    <g fill="#9eb8cb" fontSize="8" fontFamily="monospace">
      <text x="47" y="24" textAnchor="end">{formatElectrical(plot.max,kind==='voltage'?'V':'A')}</text>
      <text x="47" y="126" textAnchor="end">{formatElectrical(plot.min,kind==='voltage'?'V':'A')}</text>
      <text x="52" y="145">0 s</text><text x="342" y="145" textAnchor="end">{formatElectrical(result.duration,'s')}</text>
    </g>
    <g clipPath={'url(#'+clipId+')'}>
      {plot.series.map((series,i)=><path key={series.id} d={series.path} fill="none" stroke={i?'#e9b7fc':'#80e2c5'} strokeWidth="2"/>)}
      <path d={'M'+plot.x(index)+' 20V125'} stroke="#ffe0a2" strokeDasharray="4 3"/>
      {plot.series.map((series,i)=><circle key={series.id} cx={plot.x(index)} cy={plot.y(series.values[index])} r="3" fill={i?'#e9b7fc':'#80e2c5'}/>)}
    </g>
  </svg>;
}

export function TransientPanel(){
  const doc=useCircuitStore(s=>s.document),selected=useCircuitStore(s=>s.selection);
  const transient=useCircuitStore(s=>s.transient),timeIndex=useCircuitStore(s=>s.timeIndex);
  const duration=useCircuitStore(s=>s.transientDuration),steps=useCircuitStore(s=>s.transientSteps);
  const run=useCircuitStore(s=>s.simulateTransient),setTimeIndex=useCircuitStore(s=>s.setTimeIndex);
  const setDuration=useCircuitStore(s=>s.setTransientDuration),setSteps=useCircuitStore(s=>s.setTransientSteps);
  const [playing,setPlaying]=useState(false),[kind,setKind]=useState<'voltage'|'current'>('voltage');
  const [primaryId,setPrimaryId]=useState(''),[compareId,setCompareId]=useState('');
  const [manual,setManual]=useState(false),[min,setMin]=useState('0'),[max,setMax]=useState('10');
  const expanded=useRef<HTMLDialogElement>(null);
  const components=doc.components.filter(c=>c.kind!=='ground');
  const fallback=components.find(c=>c.id===(selected?.type==='component'?selected.id:''))??components.find(c=>c.kind==='capacitor'||c.kind==='inductor')??components[0];
  const primary=components.find(c=>c.id===primaryId)??fallback;
  const compare=components.find(c=>c.id===compareId&&c.id!==primary?.id);
  const ids=[primary?.id,compare?.id].filter((id):id is string=>!!id);
  const validRange=min.trim()!==''&&max.trim()!==''&&Number.isFinite(Number(min))&&Number.isFinite(Number(max))&&Number(max)>Number(min);
  const range=manual&&validRange?{min:Number(min),max:Number(max)}:undefined;
  const frame=transient?.frames[timeIndex];
  const chooseTime=(index:number)=>{setPlaying(false);setTimeIndex(index);};
  useEffect(()=>{
    if(!playing||!transient)return;
    const timer=window.setInterval(()=>{
      const state=useCircuitStore.getState();
      if(!state.transient||state.timeIndex>=state.transient.steps)setPlaying(false);
      else state.setTimeIndex(state.timeIndex+1);
    },42);
    return ()=>window.clearInterval(timer);
  },[playing,transient]);
  useEffect(()=>setPlaying(false),[transient]);
  const readings=<div className="scope-trace-values">{ids.map((id,i)=><div key={id}>
    <span><i style={{background:i?'#e9b7fc':'#80e2c5'}}/>{labelFor(components.find(c=>c.id===id)!,doc.components)} {kind==='voltage'?'A − B':components.find(c=>c.id===id)?.kind==='potentiometer'?'A → W':'A → B'}</span>
    <strong>{formatElectrical(frame?.readings[id]?.[kind]??NaN,kind==='voltage'?'V':'A')}</strong></div>)}</div>;
  return <section className="panel transient-panel neon-panel" aria-label="Transient instrument">
    <div className="panel-heading">〰 TRANSIENT RESPONSE</div>
    <div className="panel-content">
      <div className="time-setup"><label htmlFor="time-duration">TIME WINDOW (ms)</label>
        <input id="time-duration" type="number" min="1" max="30000" value={Number((duration*1000).toFixed(3))}
          onChange={event=>{if(event.target.value.trim()&&Number(event.target.value)>0)setDuration(Number(event.target.value)/1000);}}/></div>
      <div className="time-setup"><label htmlFor="transient-steps">SAMPLE STEPS</label>
        <select id="transient-steps" value={steps} onChange={event=>setSteps(Number(event.target.value))}>
          {[60,120,240,500].map(count=><option key={count} value={count}>{count}</option>)}
        </select></div>
      <button className="transient-run" onClick={()=>{setPlaying(false);run();}}>▶ RUN TRANSIENT</button>
      {transient&&primary?<>
        <div className="scope-selectors">
          <label>Primary trace<select aria-label="Primary trace" value={primaryId} onChange={event=>setPrimaryId(event.target.value)}>
            <option value="">Follow selection</option>{components.map(c=><option key={c.id} value={c.id}>{labelFor(c,doc.components)}</option>)}
          </select></label>
          <label>Compare trace<select aria-label="Compare trace" value={compareId} onChange={event=>setCompareId(event.target.value)}>
            <option value="">None</option>{components.filter(c=>c.id!==primary.id).map(c=><option key={c.id} value={c.id}>{labelFor(c,doc.components)}</option>)}
          </select></label>
        </div>
        <div className="scope-switch scope-kind"><button aria-pressed={kind==='voltage'} onClick={()=>setKind('voltage')}>Voltage (V)</button>
          <button aria-pressed={kind==='current'} onClick={()=>setKind('current')}>Current (A)</button></div>
        <label className="scope-auto"><input type="checkbox" checked={!manual} onChange={event=>setManual(!event.target.checked)}/> Auto-scale vertical axis</label>
        {manual&&<div className="scope-selectors"><label>Y minimum ({kind==='voltage'?'V':'A'})<input aria-label="Y minimum" type="number" value={min} onChange={event=>setMin(event.target.value)}/></label>
          <label>Y maximum ({kind==='voltage'?'V':'A'})<input aria-label="Y maximum" type="number" value={max} onChange={event=>setMax(event.target.value)}/></label></div>}
        {manual&&!validRange&&<p className="value-error">Enter a maximum greater than the minimum. Auto-scale is used until the range is valid.</p>}
        <ScopePlot result={transient} ids={ids} kind={kind} index={timeIndex} range={range} onIndex={chooseTime}/>
        {readings}
        <div className="scope-time-label">Time cursor: <strong>{formatElectrical(frame?.time??0,'s')}</strong></div>
        <input aria-label="Simulation time" type="range" min="0" max={transient.steps} value={timeIndex} onChange={event=>chooseTime(Number(event.target.value))}/>
        <div className="time-controls"><button title="Jump to start" onClick={()=>chooseTime(0)}>|◀</button>
          <button onClick={()=>{if(!playing&&timeIndex===transient.steps)setTimeIndex(0);setPlaying(!playing);}}>{playing?'Ⅱ PAUSE':'▶ PLAY'}</button>
          <button title="Jump to end" onClick={()=>chooseTime(transient.steps)}>▶|</button></div>
        <button className="instrument-expand" onClick={()=>expanded.current?.showModal()}>⤢ Expand graph</button>
        <p className="instrument-note">Voltages are measured across components (A − B). Drag the graph or scrub the time slider; point measurements on the canvas follow the same time.</p>
        <dialog className="scope-expanded-dialog" ref={expanded} aria-label="Expanded transient graph">
          <header><h2>Transient response · {kind}</h2><button aria-label="Close expanded graph" onClick={()=>expanded.current?.close()}>×</button></header>
          <ScopePlot result={transient} ids={ids} kind={kind} index={timeIndex} range={range} onIndex={chooseTime}/>
          {readings}<label>Time cursor: {formatElectrical(frame?.time??0,'s')}<input aria-label="Expanded simulation time" type="range" min="0" max={transient.steps} value={timeIndex} onChange={event=>chooseTime(Number(event.target.value))}/></label>
        </dialog>
      </>:<div className="time-empty"><p>Load the RC charging example from Parts, or connect your own circuit, then run transient analysis.</p>
        <p>Constant sources step on at t = 0. Capacitors start at 0 V and inductors at 0 A.</p></div>}
    </div>
  </section>;
}
