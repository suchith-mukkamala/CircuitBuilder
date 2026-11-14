import {pinPosition,pinsFor,type CircuitDocument,type Point} from '../circuit/types';
export function fitAnalogCircuit(doc:CircuitDocument,size:{width:number;height:number}){
  const points:Point[]=doc.components.flatMap(c=>[{x:c.x-65,y:c.y-65},{x:c.x+65,y:c.y+65},...pinsFor(c).map(pin=>pinPosition(c,pin))]);
  for(const wire of doc.wires)for(const point of [wire.from,wire.to,...wire.waypoints??[]])if('x' in point)points.push(point);
  if(!points.length||!size.width||!size.height)return {x:60,y:42,zoom:1};
  const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x));
  const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
  const zoom=Math.max(.15,Math.min(1.4,(size.width-60)/Math.max(1,right-left),(size.height-125)/Math.max(1,bottom-top)));
  return {zoom,x:size.width/2-(left+right)/2*zoom,y:(size.height+30)/2-(top+bottom)/2*zoom};
}
