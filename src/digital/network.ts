import {
  DigitalDocument, DigitalEndpoint, DigitalPoint, DigitalTerminal, DigitalWire, DigitalBus,
  isDigitalTerminal, pinAt, pinId, pinsOf, partHeight, busGroups,
} from './types';

class UnionFind {
  private parent = new Map<string, string>();
  add(key: string) { if (!this.parent.has(key)) this.parent.set(key, key); }
  find(key: string): string {
    const p = this.parent.get(key);
    if (p === undefined) throw new Error('Missing signal node: ' + key);
    if (p === key) return p;
    const root = this.find(p);
    this.parent.set(key, root);
    return root;
  }
  union(a: string, b: string) {
    const rootA = this.find(a), rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}
export const coordKey = (p: DigitalPoint) => 'xy:' + p.x + ',' + p.y;
export function endpointPoint(doc: DigitalDocument, endpoint: DigitalEndpoint): DigitalPoint | null {
  if (!isDigitalTerminal(endpoint)) return endpoint;
  const part = doc.components.find(c => c.id === endpoint.componentId);
  return part && pinsOf(part).includes(endpoint.pin) ? pinAt(part, endpoint.pin) : null;
}
/** Cost orthogonal routes by collisions with *other* component bodies. */
export function routeDigitalPoints(
  doc:DigitalDocument, from:DigitalPoint,to:DigitalPoint,
  excluded:string[]=[], waypoints?:DigitalPoint[],
):DigitalPoint[] {
  const compact=(pts:DigitalPoint[])=>{
    const result:DigitalPoint[]=[];
    for(const p of pts){
      const last=result.at(-1);
      if(last?.x!==p.x||last.y!==p.y)result.push(p);
    }
    // Keep routing corners; drop intermediate collinear vertices.
    return result.filter((p,i)=>i===0||i===result.length-1||
      !((result[i-1].x===p.x&&p.x===result[i+1].x)||
        (result[i-1].y===p.y&&p.y===result[i+1].y)));
  };
  const orthogonal=(anchors:DigitalPoint[])=>{
    const pts=[anchors[0]];
    for(const next of anchors.slice(1)){
      const prev=pts.at(-1)!;
      if(next.x!==prev.x&&next.y!==prev.y)pts.push({x:next.x,y:prev.y});
      pts.push(next);
    }
    return compact(pts);
  };
  if(waypoints?.length)return orthogonal([from,...waypoints,to]);
  const hv=compact([from,{x:to.x,y:from.y},to]);
  const vh=compact([from,{x:from.x,y:to.y},to]);
  // A pin already touching the original X-then-Y route is an intentional
  // electrical tap, not a collision to dodge. Rerouting around that component
  // would silently break the existing on-wire connection.
  const onSegment=(p:DigitalPoint,a:DigitalPoint,b:DigitalPoint)=>
    a.y===b.y ? p.y===a.y&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x) :
      p.x===a.x&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);
  const occupied=doc.components.filter(c=>!excluded.includes(c.id)&&
    !pinsOf(c).some(pin=>{
      const p=pinAt(c,pin);
      return hv.slice(1).some((end,i)=>onSegment(p,hv[i],end));
    })).map(c=>{
    const size=Math.max(50,partHeight(c)/2+5);
    return {left:c.x-size,right:c.x+size,top:c.y-size,bottom:c.y+size};
  });
  const cost=(route:DigitalPoint[])=>{
    let collision=0;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i];
      for(const box of occupied){
        if(a.y===b.y&&a.y>box.top&&a.y<box.bottom){
          collision+=Math.max(0,Math.min(Math.max(a.x,b.x),box.right)-
            Math.max(Math.min(a.x,b.x),box.left));
        }
        if(a.x===b.x&&a.x>box.left&&a.x<box.right){
          collision+=Math.max(0,Math.min(Math.max(a.y,b.y),box.bottom)-
            Math.max(Math.min(a.y,b.y),box.top));
        }
      }
    }
    const length=route.slice(1).reduce((sum,p,i)=>sum+
      Math.abs(p.x-route[i].x)+Math.abs(p.y-route[i].y),0);
    return collision*20+length+route.length*5;
  };
  const candidates=[hv,vh];
  // Dog-leg alternatives skirt existing chips, rather than passing through
  // a long row of registers or RAM. Explicit waypoints still win.
  if(occupied.length){
    const upper=Math.min(from.y,to.y,...occupied.map(o=>o.top))-24;
    const lower=Math.max(from.y,to.y,...occupied.map(o=>o.bottom))+24;
    const left=Math.min(from.x,to.x,...occupied.map(o=>o.left))-24;
    const right=Math.max(from.x,to.x,...occupied.map(o=>o.right))+24;
    for(const y of [upper,lower])candidates.push(compact([
      from,{x:from.x,y},{x:to.x,y},to,
    ]));
    for(const x of [left,right])candidates.push(compact([
      from,{x,y:from.y},{x,y:to.y},to,
    ]));
  }
  return candidates.reduce((best,option)=>cost(option)<cost(best)?option:best,hv);
}
export function digitalWirePath(doc: DigitalDocument, wire: DigitalWire): DigitalPoint[] {
  const from=endpointPoint(doc,wire.from),to=endpointPoint(doc,wire.to);
  if(!from||!to)return [];
  const excluded=[wire.from,wire.to].filter(isDigitalTerminal).map(t=>t.componentId);
  return routeDigitalPoints(doc,from,to,excluded,wire.waypoints);
}
export function digitalBusPoint(doc:DigitalDocument,end:DigitalBus['from']):DigitalPoint|null {
  const part=doc.components.find(c=>c.id===end.componentId);
  if(!part||!end.pins.length)return null;
  const points=end.pins.map(pin=>pinAt(part,pin));
  return {x:Math.round(points.reduce((sum,p)=>sum+p.x,0)/points.length),
    y:Math.round(points.reduce((sum,p)=>sum+p.y,0)/points.length)};
}
export function digitalBusPath(doc:DigitalDocument,bus:DigitalBus):DigitalPoint[] {
  const from=digitalBusPoint(doc,bus.from),to=digitalBusPoint(doc,bus.to);
  if(!from||!to)return [];
  return routeDigitalPoints(doc,from,to,[bus.from.componentId,bus.to.componentId],bus.waypoints);
}

function onDigitalPath(path:DigitalPoint[],p:DigitalPoint):boolean {
  return path.some((a,i)=>{
    if (!i) return false;
    const b = path[i - 1];
    return a.x === b.x
      ? p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
      : p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x);
  });
}
export function onDigitalWire(doc:DigitalDocument,wire:DigitalWire,p:DigitalPoint):boolean {
  return onDigitalPath(digitalWirePath(doc,wire),p);
}
export function intentionalJunctions(doc: DigitalDocument): DigitalPoint[] {
  const paths=new Map(doc.wires.map(w=>[w.id,digitalWirePath(doc,w)]));
  const tips = new Map<string, DigitalPoint>();
  for (const wire of doc.wires) {
    for (const end of [wire.from, wire.to]) {
      if (!isDigitalTerminal(end)) tips.set(coordKey(end), end);
    }
  }
  return [...tips.values()].filter(point =>
    doc.wires.filter(wire => onDigitalPath(paths.get(wire.id)??[],point)).length >= 2);
}
export interface SignalNetwork {
  terminals: Record<string, string>;
  wires: Record<string, string>;
  roots: string[];
}

/**
 * A digital wire only joins another at an explicit endpoint or component pad.
 * Mere perpendicular crossings are never electrical connections.
 */
export function buildSignalNetwork(doc: DigitalDocument): SignalNetwork {
  const union = new UnionFind();
  const terms: { terminal: DigitalTerminal; point: DigitalPoint }[] = [];
  const explicit = new Set<string>();
  for (const c of doc.components) {
    for (const pin of pinsOf(c)) {
      const terminal = { componentId: c.id, pin };
      const point = pinAt(c, pin);
      const key = pinId(terminal), pos = coordKey(point);
      union.add(key); union.add(pos); union.union(key, pos);
      terms.push({ terminal, point });
    }
  }
  // A splitter is electrically passive: busN connects to bitN independently.
  for(const c of doc.components.filter(c=>c.kind.startsWith('splitter'))){
    const count=busGroups(c).find(g=>g.direction==='in')?.width??0;
    for(let i=0;i<count;i++)union.union(c.id+':bus'+i,c.id+':bit'+i);
  }
  const paths=new Map(doc.wires.map(w=>[w.id,digitalWirePath(doc,w)]));
  const tips: DigitalPoint[] = [];
  for (const wire of doc.wires) {
    const key = 'wire:' + wire.id;
    union.add(key);
    for (const endpoint of [wire.from, wire.to]) {
      if (isDigitalTerminal(endpoint)) {
        const term = pinId(endpoint);
        union.add(term); union.union(key, term); explicit.add(term);
      } else {
        const point = coordKey(endpoint);
        union.add(point); union.union(key, point);
        tips.push(endpoint);
      }
    }
  }
  // Named one-bit nets connect even when their drawn wires are far apart.
  const namedWires=new Map<string,string>();
  for(const wire of doc.wires){
    if(!wire.label)continue;
    const original=namedWires.get(wire.label);
    if(original)union.union(original,'wire:'+wire.id);
    else namedWires.set(wire.label,'wire:'+wire.id);
  }
  // Each bus is an actual collection of independent bit-level connections.
  const namedBuses=new Map<string,{width:number;pins:string[]}>();
  for(const bus of doc.buses??[]){
    for(let i=0;i<bus.width;i++)union.union(
      bus.from.componentId+':'+bus.from.pins[i],
      bus.to.componentId+':'+bus.to.pins[i]);
    if(!bus.label)continue;
    const existing=namedBuses.get(bus.label);
    const pins=bus.from.pins.map(pin=>bus.from.componentId+':'+pin);
    if(existing?.width===bus.width){
      for(let i=0;i<bus.width;i++)union.union(pins[i],existing.pins[i]);
    }else if(!existing)namedBuses.set(bus.label,{width:bus.width,pins});
  }
  for (const wire of doc.wires) {
    for (const point of tips) {
      if (onDigitalPath(paths.get(wire.id)??[],point)) {
        union.union('wire:' + wire.id, coordKey(point));
      }
    }
  }
  for (const { terminal, point } of terms) {
    if (explicit.has(pinId(terminal))) continue;
    for (const wire of doc.wires) {
      if (onDigitalPath(paths.get(wire.id)??[],point)) union.union(pinId(terminal), 'wire:' + wire.id);
    }
  }
  const terminals: Record<string, string> = {}, wires: Record<string, string> = {};
  for (const { terminal } of terms) terminals[pinId(terminal)] = union.find(pinId(terminal));
  for (const wire of doc.wires) wires[wire.id] = union.find('wire:' + wire.id);
  return {
    terminals, wires,
    roots: [...new Set([...Object.values(terminals), ...Object.values(wires)])].sort(),
  };
}
