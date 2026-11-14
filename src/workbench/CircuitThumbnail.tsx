import {pinPosition,type CircuitComponent,type PinName} from '../circuit/types';
import {pinAt,type DigitalComponent,type DigitalEndpoint} from '../digital/types';
import type {ProjectSnapshot} from './projects';
export function CircuitThumbnail({snapshot}:{snapshot:ProjectSnapshot}){
  const doc=snapshot.document,parts=doc.components;
  const left=Math.min(0,...parts.map(c=>c.x))-90,top=Math.min(0,...parts.map(c=>c.y))-90;
  const width=Math.max(180,...parts.map(c=>c.x))-left+90,height=Math.max(180,...parts.map(c=>c.y))-top+90;
  const point=(endpoint:DigitalEndpoint)=>{
    if(!('componentId' in endpoint))return endpoint;
    const part=parts.find(c=>c.id===endpoint.componentId);if(!part)return null;
    return 'lab' in doc?pinAt(part as DigitalComponent,endpoint.pin):pinPosition(part as CircuitComponent,endpoint.pin as PinName);
  };
  return <svg className="project-thumbnail" viewBox={[left,top,width,height].join(' ')} aria-hidden="true">
    {doc.wires.slice(0,50).map(wire=>{const a=point(wire.from),b=point(wire.to);return a&&b?<path key={wire.id} d={`M${a.x} ${a.y}H${b.x}V${b.y}`} fill="none" stroke="#73b6b2" strokeWidth="10"/>:null;})}
    {parts.slice(0,35).map(part=><rect key={part.id} x={part.x-27} y={part.y-20} width="54" height="40" rx="5" fill="#1f574d" stroke="#b4ecd7" strokeWidth="8"/>)}
  </svg>;
}
