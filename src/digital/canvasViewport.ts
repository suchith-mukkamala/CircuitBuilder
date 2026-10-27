import type { DigitalDocument } from './types';
import { inputsOf, outputsOf, partHeight, pinAt } from './types';
import { digitalWirePath, digitalBusPath } from './network';

export type CircuitCamera = {x:number;y:number;zoom:number};
export type Viewport = {width:number;height:number};

/**
 * Determine a sensible view for a complete schematic. Existing designs may
 * span more than 1300 logical pixels and include 10-input ALUs or 16-pin RAM.
 * The fit operation includes component bodies, all rotated pins and traces.
 */
export function fitDigitalCircuit(
  doc:DigitalDocument, viewport:Viewport, padding=56,
):CircuitCamera {
  if(viewport.width<=0||viewport.height<=0)return {x:80,y:70,zoom:1};
  if(!doc.components.length&&!doc.wires.length)
    return {x:Math.min(80,viewport.width/4),y:Math.min(70,viewport.height/4),zoom:1};
  const pts:{x:number;y:number}[]=[];
  for(const c of doc.components){
    const width=c.kind==='block'?80:inputsOf(c).length>2||outputsOf(c).length>1?68:50;
    const height=partHeight(c)/2+26;
    // Rotation can exchange the x and y extents; a bounding square makes
    // the fit conservative and never crops long vertical chips.
    const r=Math.max(width,height);
    pts.push({x:c.x-r,y:c.y-r},{x:c.x+r,y:c.y+r});
    for(const pin of [...inputsOf(c),...outputsOf(c)])pts.push(pinAt(c,pin));
  }
  for(const wire of doc.wires)pts.push(...digitalWirePath(doc,wire));
  for(const bus of doc.buses??[])pts.push(...digitalBusPath(doc,bus));
  if(!pts.length)return {x:80,y:70,zoom:1};
  const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
  const minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
  const width=Math.max(80,maxX-minX),height=Math.max(80,maxY-minY);
  const usableW=Math.max(80,viewport.width-padding*2);
  const usableH=Math.max(80,viewport.height-padding*2);
  const zoom=Math.max(.3,Math.min(1.65,usableW/width,usableH/height));
  return {
    zoom,
    x:viewport.width/2-(minX+maxX)/2*zoom,
    y:viewport.height/2-(minY+maxY)/2*zoom,
  };
}
