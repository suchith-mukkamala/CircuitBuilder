import {digitalLabel,pinsOf,outputsOf,type DigitalDocument,type LogicResult,type LogicValue} from './types';
export type SignalTarget={kind:'pin';componentId:string;pin:string}|{kind:'wire'|'component'|'bus';id:string};
export const logicDescription=(value:LogicValue|undefined)=>value===1?'HIGH · 1':value===0?'LOW · 0':value==='X'?'X · Unknown / conflicting':'Z · Undriven';
export function targetNet(doc:DigitalDocument,result:LogicResult,target:SignalTarget|null){
  if(target?.kind==='pin')return result.terminalNets[target.componentId+':'+target.pin];
  if(target?.kind==='wire')return result.wireNets[target.id];
  if(target?.kind==='component'){
    const part=doc.components.find(c=>c.id===target.id);
    if(part)return result.terminalNets[part.id+':'+(outputsOf(part)[0]??pinsOf(part)[0])];
  }
  return undefined;
}
export function SignalReadout({doc,result,target,onTarget,onProbe,onClose}:{
  doc:DigitalDocument;result:LogicResult;target:SignalTarget;onTarget:(next:SignalTarget)=>void;
  onProbe:(kind:'wire'|'terminal',key:string,label:string)=>void;onClose:()=>void;
}){
  const part=target.kind==='component'?doc.components.find(c=>c.id===target.id):undefined;
  const pinPart=target.kind==='pin'?doc.components.find(c=>c.id===target.componentId):undefined;
  const wire=target.kind==='wire'?doc.wires.find(w=>w.id===target.id):undefined;
  const bus=target.kind==='bus'?doc.buses?.find(b=>b.id===target.id):undefined;
  if(!part&&!pinPart&&!wire&&!bus)return null;
  if(target.kind==='pin'&&!pinsOf(pinPart!).includes(target.pin))return null;
  const net=targetNet(doc,result,target);
  const key=target.kind==='pin'?target.componentId+':'+target.pin:undefined;
  const value=wire?result.wireValues[wire.id]:key?result.terminalValues[key]:undefined;
  const name=part?digitalLabel(part,doc.components):pinPart?digitalLabel(pinPart,doc.components)+' · '+(target.kind==='pin'?target.pin.toUpperCase():''):
    wire?wire.label??'Wire '+wire.id:bus?.label??'BUS';
  const bits=bus?bus.from.pins.map(pin=>result.terminalValues[bus.from.componentId+':'+pin]??'Z'):[];
  const word=bits.every(bit=>bit===0||bit===1)?bits.reduce<number>((sum,bit,i)=>sum+(bit===1?2**i:0),0):null;
  const connected=Object.entries(result.terminalNets).filter(([,id])=>net&&id===net).map(([key])=>key);
  return <section className="point-readout signal-point-readout" aria-label="Signal point states">
    <header><strong>{name}</strong><button aria-label="Close signal point states" onClick={onClose}>×</button></header>
    <span className="readout-analysis">LIVE DIGITAL STATE</span>
    {part?<div className="point-pin-list">{pinsOf(part).map(pin=><button key={pin} onClick={()=>onTarget({kind:'pin',componentId:part.id,pin})}>
      <span>{pin.toUpperCase()}</span><strong>{logicDescription(result.terminalValues[part.id+':'+pin])}</strong></button>)}</div>:
      bus?<><dl><div><dt>Bits [{bus.width-1}:0]</dt><dd>{[...bits].reverse().join('')}</dd></div>
        <div><dt>Unsigned value</dt><dd>{word===null?'Unknown':word+' / 0x'+word.toString(16).toUpperCase()}</dd></div></dl><p>Bit 0 is the least significant bit.</p></>:
      <><strong className={'signal-point-value state-'+value}>{logicDescription(value)}</strong>
        <div className="readout-terminals">{connected.join(' · ')}</div>
        <button className="readout-record" onClick={()=>onProbe(wire?'wire':'terminal',wire?.id??key!,name)}>Record waveform</button></>}
    <p>Digital logic states are simulated here; analog voltages are measured in Lab 01.</p>
  </section>;
}
