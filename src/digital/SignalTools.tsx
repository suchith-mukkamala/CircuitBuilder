import { useEffect, useMemo, useState } from 'react';
import type { DigitalDocument, LogicResult, LogicValue } from './types';
import { digitalLabel, pinsOf } from './types';
import { outputVector, inputVector } from './blocks';
import { useDigitalStore, SignalSample, SignalProbe } from './useDigitalStore';

const TRACE_COLORS = ['#78ffcf', '#ff9beb', '#8abfff', '#ffe39c'];
const logicColor = (v: LogicValue | undefined) =>
  v === 1 ? '#92ffe0' : v === 0 ? '#7295b6' : v === 'X' ? '#ff9cc9' : '#9795b9';
function valueOf(sample: SignalSample, probe: SignalProbe): LogicValue {
  return (probe.kind === 'wire' ? sample.wires[probe.key] : sample.terminals[probe.key]) ?? 'Z';
}
const positionOf = (v: LogicValue, offset: number) =>
  offset + (v === 1 ? 9 : v === 0 ? 37 : v === 'X' ? 22 : 45);

export function SignalScopePanel({doc}: {doc: DigitalDocument}) {
  const probes = useDigitalStore(s => s.probes);
  const trace = useDigitalStore(s => s.trace);
  const remove = useDigitalStore(s => s.removeProbe);
  const add = useDigitalStore(s => s.addProbe);
  const clear = useDigitalStore(s => s.clearTrace);
  const [choice, setChoice] = useState('');
  const [step, setStep] = useState<number|null>(null);
  const last = trace.at(-1)?.step ?? 0;
  const first = trace[0]?.step ?? 0;
  const selected = Math.max(first, Math.min(last, step ?? last));
  const current = trace.find(s => s.step === selected) ?? trace.at(-1);
  const options = useMemo(() => [
    ...doc.components.flatMap(c => pinsOf(c).map(pin => ({
      value: 'terminal|' + c.id + ':' + pin,
      label: digitalLabel(c,doc.components) + '.' + pin.toUpperCase(),
    }))),
    ...doc.wires.map(w => ({value:'wire|'+w.id, label:'WIRE '+w.id.slice(0,7)})),
  ], [doc]);
  // Reset the inspected position when topology edits reset the event history.
  useEffect(() => {if (step !== null && (step < first || step > last)) setStep(null);},
    [step, first, last]);
  const selectProbe = () => {
    if(!choice)return;
    const divider = choice.indexOf('|');
    const kind = choice.slice(0,divider) as SignalProbe['kind'];
    const key = choice.slice(divider+1);
    const opt = options.find(o=>o.value===choice);
    if(opt)add(kind,key,opt.label);
  };
  const viewWidth=296;
  const left=52, right=281;
  const laneHeight=61;
  const chartHeight=42 + probes.length*laneHeight;
  const xFor = (index: number) => left +
    (trace.length===1?0:(index/(trace.length-1))*(right-left));
  const series=probes.map((probe,p)=> {
    const top=28+p*laneHeight;
    const pts=trace.map((s,i)=>({x:xFor(i),y:positionOf(valueOf(s,probe),top)}));
    // Vertical transitions represent the instant an INPUT changed. This is
    // event history, not a physical propagation-delay model.
    let d='';
    for(let i=0;i<pts.length;i++) {
      const curr=pts[i],prev=pts[i-1];
      if(!prev)d+='M '+curr.x.toFixed(2)+' '+curr.y;
      else d+=' H '+curr.x.toFixed(2)+' V '+curr.y;
    }
    if(pts.length)d+=' H '+right;
    return {probe,top,path:d, color:TRACE_COLORS[p%TRACE_COLORS.length]};
  });
  const markerX = trace.length===1?left:
    xFor(Math.max(0, trace.findIndex(sample=>sample.step===selected)));
  return (
    <section className="signal-scope-panel">
      <div className="signal-panel-heading">〰 SIGNAL ANALYZER <span>/ EVENTS</span></div>
      <p className="signal-scope-intro">
        Probe a wire or terminal. Each input change adds an event to the trace.
        HIGH, LOW, X, and Z are recorded; no artificial physical delay is assumed.
      </p>
      <div className="scope-probe-add">
        <label htmlFor="scope-choose">MEASURE A SIGNAL</label>
        <div><select id="scope-choose" value={choice} onChange={e=>setChoice(e.target.value)}>
          <option value="">Choose pin or wire…</option>
          {options.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
        </select><button onClick={selectProbe} disabled={!choice||probes.length>=4}>+ PROBE</button></div>
      </div>
      <div className="scope-probe-list">
        {probes.map((probe,i)=><div key={probe.id} className="scope-probe-line">
          <span className="probe-pip" style={{background:TRACE_COLORS[i%TRACE_COLORS.length]}}/>
          <strong>{probe.label}</strong>
          <span style={{color:logicColor(current?valueOf(current,probe):'Z')}}>
            {current?valueOf(current,probe):'Z'}</span>
          <button aria-label={'Remove probe '+probe.label} onClick={()=>remove(probe.id)}>×</button>
        </div>)}
      </div>
      <div className="scope-position">
        <div><label htmlFor="scope-event">INSPECT EVENT #</label>
          <input id="scope-event" type="number" min={first} max={last} step="1"
            value={selected}
            onChange={e=>setStep(Math.max(first,Math.min(last,Number(e.target.value))))}/>
        </div>
        <div className="scope-advance">
          <button title="Previous event" onClick={()=>setStep(Math.max(first,selected-1))}>◀</button>
          <button title="Latest event" onClick={()=>setStep(last)}>LIVE</button>
          <button title="Next event" onClick={()=>setStep(Math.min(last,selected+1))}>▶</button>
        </div>
      </div>
      <div className="scope-chart" role="region" aria-label="Digital signal change graph">
        <svg viewBox={'0 0 '+viewWidth+' '+Math.max(96,chartHeight)}
          width="100%" role="img"
          aria-label="Waveforms plotted against input-change event number"
          onClick={event=>{
            if(!trace.length)return;
            const rect=event.currentTarget.getBoundingClientRect();
            const x=(event.clientX-rect.left)/rect.width*viewWidth;
            const i=trace.length===1?0:Math.round(
              (Math.max(left,Math.min(right,x))-left)/(right-left)*(trace.length-1));
            setStep(trace[Math.max(0,Math.min(trace.length-1,i))].step);
          }}>
          <rect x="0" y="0" width={viewWidth} height={Math.max(96,chartHeight)}
            fill="#08172e"/>
          {series.map(({probe,top,path,color})=><g key={probe.id}>
            <line x1={left} x2={right} y1={top+9} y2={top+9}
              stroke="#294667" strokeDasharray="3 5"/>
            <line x1={left} x2={right} y1={top+37} y2={top+37}
              stroke="#294667" strokeDasharray="3 5"/>
            <text x="7" y={top+17} fill="#9ccde2" fontSize="10">1</text>
            <text x="7" y={top+42} fill="#9ccde2" fontSize="10">0</text>
            <text x={left+3} y={top-4} fill={color} fontSize="10">
              {probe.label.slice(0,22)}
            </text>
            <path d={path} stroke={color} strokeWidth="2.6" fill="none"
              strokeLinecap="square" strokeLinejoin="miter"/>
          </g>)}
          {!probes.length && <text x="148" y="40" fontSize="10"
            textAnchor="middle" fill="#a2a8cd">ADD A PROBE TO SEE SIGNAL EVENTS</text>}
          <line x1={markerX} x2={markerX} y1="15" y2={Math.max(96,chartHeight)-6}
            stroke="#ffe093" strokeDasharray="4 3" strokeWidth="1.5"/>
          <text x={left} y={Math.max(96,chartHeight)-2} fill="#a7b9d9" fontSize="9">{first}</text>
          <text x={right} y={Math.max(96,chartHeight)-2} fill="#a7b9d9"
            textAnchor="end" fontSize="9">{last} · EVENTS</text>
        </svg>
      </div>
      <div className="scope-sample-info">
        EVENT {selected} · INPUTS <strong>{current?.vector||'—'}</strong>
      </div>
      <div className="scope-action-row">
        <span>{trace.length} recorded events · max 160</span>
        <button onClick={()=>{clear();setStep(null);}}>RESET TRACE</button>
      </div>
    </section>
  );
}

export function SignalVectorPanel({doc, result}:{
  doc:DigitalDocument;result:LogicResult;
}) {
  const apply=useDigitalStore(s=>s.applyVector);
  const trace=useDigitalStore(s=>s.trace);
  const [text,setText] = useState(inputVector(doc));
  const [error,setError] = useState('');
  const inputs=doc.components.filter(c=>c.kind==='input');
  const outputs=doc.components.filter(c=>c.kind==='led');
  const bits=inputVector(doc);
  useEffect(()=>setText(bits),[bits,inputs.length]);
  const run = () => {
    const tokens=text.split(/[\s,;]+/).filter(Boolean);
    if(!tokens.length){setError('Enter at least one binary vector.');return;}
    if(tokens.length>32){setError('Use up to 32 vectors in one sequence.');return;}
    try {
      for(const vector of tokens) {
        if(!/^[01]+$/.test(vector) || vector.length!==inputs.length) {
          throw new Error('Every vector must contain exactly '+inputs.length+' binary digits (0 or 1).');
        }
      }
      for(const vector of tokens)apply(vector);
      setError('');
      setText(tokens[tokens.length-1]);
    } catch(err) {
      setError(err instanceof Error?err.message:'Could not evaluate the inputs.');
    }
  };
  return <section className="signal-vector-panel">
    <div className="signal-panel-heading">▣ INPUT TERMINAL <span>/ TEST</span></div>
    <p className="signal-scope-intro">
      Type a binary vector to set all INPUT switches together. Enter several vectors
      separated by commas to build a signal trace.
    </p>
    <div className="vector-io-list">
      <div className="signal-section-label">INPUT ORDER · LEFT TO RIGHT</div>
      {inputs.map((c,i)=><div className="signal-readout" key={c.id}>
        <span>{i+1}. {digitalLabel(c,doc.components)}</span>
        <strong>{c.bit??0}</strong>
      </div>)}
    </div>
    <label className="vector-label" htmlFor="signal-binary-vector">
      BINARY VECTOR · {inputs.length} BIT{inputs.length===1?'':'S'}
    </label>
    <textarea id="signal-binary-vector" value={text} rows={2}
      spellCheck={false} placeholder={inputs.length?'0'.repeat(inputs.length)+', '+'1'.repeat(inputs.length):'Add inputs first'}
      onChange={e=>{setText(e.target.value);setError('');}}
      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();run();}}}/>
    <button className="signal-vector-run" onClick={run} disabled={!inputs.length}>
      ▶ APPLY & EVALUATE
    </button>
    {error && <p role="alert" className="signal-truth-error">{error}</p>}
    <div className="vector-io-list">
      <div className="signal-section-label">CURRENT OUTPUT VECTOR</div>
      {outputs.length ? outputs.map((c,i)=><div className="signal-readout" key={c.id}>
        <span>{i+1}. {digitalLabel(c,doc.components)}</span>
        <strong style={{color:logicColor(result.ledValues[c.id])}}>
          {result.ledValues[c.id]??'Z'}
        </strong>
      </div>):<p className="signal-scope-intro">Add LED outputs to measure a result.</p>}
      <div className="vector-output">
        <span>IN</span><strong>{bits||'—'}</strong>
        <span>OUT</span><strong>{outputVector(doc,result.ledValues)||'—'}</strong>
      </div>
    </div>
    <div className="vector-footer">{trace.length} event(s) in the waveform recorder.
      Open WAVEFORM to inspect each step.</div>
  </section>;
}
