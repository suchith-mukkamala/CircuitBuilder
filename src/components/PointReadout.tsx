import {analogMeasurement,type AnalogTarget} from '../editor/measurements';
import {formatElectrical,type CircuitDocument,type DCResult} from '../circuit/types';
import {useMemo} from 'react';
import {circuitNodes} from '../circuit/connectivity';
export function PointReadout({doc,result,target,reference,onReference,onClose,time}:{
  doc:CircuitDocument;result:DCResult|null;target:AnalogTarget;reference:AnalogTarget|null;
  onReference:(next:AnalogTarget|null)=>void;onClose:()=>void;time?:number;
}){
  const nodes=useMemo(()=>circuitNodes(doc,{allowIncomplete:true}),[doc]);
  const measured=useMemo(()=>analogMeasurement(doc,result,target,nodes),[doc,result,target,nodes]);
  const ref=useMemo(()=>reference?analogMeasurement(doc,result,reference,nodes):null,[doc,result,reference,nodes]);
  if(!measured)return null;
  const difference=measured.voltage!==undefined&&(!reference||ref?.voltage!==undefined)
    ?measured.voltage-(reference?ref!.voltage!:0):undefined;
  return <section className="point-readout" aria-label="Point measurements" onPointerDown={event=>event.stopPropagation()}>
    <header><strong>{measured.label}</strong><button aria-label="Close point measurements" onClick={onClose}>×</button></header>
    <span className="readout-analysis">{time===undefined?'DC ANALYSIS':'TRANSIENT · '+formatElectrical(time,'s')}</span>
    {!result?<p className="readout-stale">No current result. Run DC or RLC after changing the circuit.</p>:
      measured.kind==='branch'?<>
        <dl><div><dt>Voltage A − B</dt><dd>{formatElectrical(measured.reading?.voltage??NaN,'V')}</dd></div>
          <div><dt>{componentIsPot(doc,target)?'Current A → W':'Current A → B'}</dt><dd>{formatElectrical(measured.reading?.current??NaN,'A')}</dd></div>
          <div><dt>Power absorbed</dt><dd>{formatElectrical(measured.reading?.power??NaN,'W')}</dd></div></dl>
        <p>Negative current flows opposite the arrow. Negative power means this component supplies energy.</p>
      </>:<>
        <dl><div><dt>Voltage to {reference?'reference':'ground'}</dt><dd>{formatElectrical(difference??NaN,'V')}</dd></div></dl>
        <p>{reference?'Reference: '+(ref?.label??'removed point'):'Ground is the 0 V reference.'}</p>
      </>}
    {measured.kind==='node'&&<>
      <div className="readout-terminals">{measured.terminals.map(t=>t.label).join(' · ')||'No component terminals'}</div>
      <p>All points on this net share one voltage. A branch current is measured through a component.</p>
      <div className="readout-actions"><button onClick={()=>onReference(target)}>Use as reference</button>
        {reference&&<button onClick={()=>onReference(null)}>Use ground</button>}</div>
    </>}
  </section>;
}
function componentIsPot(doc:CircuitDocument,target:AnalogTarget){return target.kind==='component'&&doc.components.some(c=>c.id===target.id&&c.kind==='potentiometer');}
