import {
  DragEvent, MouseEvent, PointerEvent, WheelEvent,
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  DigitalComponent, DigitalDocument, DigitalEndpoint, DigitalKind, DigitalPoint,
  DigitalSelection, DigitalWire, LogicResult, LogicValue, BusGroup,
  digitalLabel, digitalSnap, isDigitalTerminal, pinAt, pinsOf, blockHeight,
  isWidePart, partHeight, localPinAt, outputsOf, inputsOf, digitalKinds, busGroups,
} from './types';
import {
  digitalWirePath, digitalBusPath, digitalBusPoint, endpointPoint, intentionalJunctions,
} from './network';
import { useDigitalStore } from './useDigitalStore';
import { paletteCategories,partByKind } from './catalog';
import { fitDigitalCircuit } from './canvasViewport';
import { diagnoseDigitalCircuit, type CircuitIssue } from './diagnostics';

type Camera = { x: number; y: number; zoom: number };
type Drag = {
  type: 'component'; id: string; at: DigitalPoint; x: number; y: number; moved: boolean;
} | {
  type: 'tip'; wireId: string; side: 'from' | 'to'; at: DigitalPoint; x: number; y: number;
} | {
  type: 'bend';kind:'wire'|'bus';id:string;
} | {
  type: 'pan'; x: number; y: number; atX: number; atY: number;
};
type Popup = {
  x: number; y: number; world: DigitalPoint;
  selection: DigitalSelection; wirePoint: DigitalPoint | null;
};
const ink = {
  bg: '#070d22', grid: '#1b284b', major: '#2e416e',
  mint: '#6effcb', gold: '#ffdc87', purple: '#cb9bff', pink: '#ff8be3',
};
const signalColor = (signal: LogicValue) =>
  signal === 1 ? '#68ffcd' : signal === 0 ? '#48678d'
    : signal === 'X' ? '#ff82c8' : '#7a829b';
function distanceToSegment(p: DigitalPoint, a: DigitalPoint, b: DigitalPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
  return Math.hypot(p.x-a.x-dx*t, p.y-a.y-dy*t);
}
function hitPart(c: DigitalComponent, p: DigitalPoint): boolean {
  // Intentional generous bounding boxes so pixel shapes remain easy to grab.
  if (c.kind === 'block') {
    const rad = -c.rotation * Math.PI / 180;
    const x = (p.x-c.x)*Math.cos(rad)-(p.y-c.y)*Math.sin(rad);
    const y = (p.x-c.x)*Math.sin(rad)+(p.y-c.y)*Math.cos(rad);
    return Math.abs(x) < 66 && Math.abs(y) < blockHeight(c)/2;
  }
  if(isWidePart(c)) {
    const rad=-c.rotation*Math.PI/180;
    const x=(p.x-c.x)*Math.cos(rad)-(p.y-c.y)*Math.sin(rad);
    const y=(p.x-c.x)*Math.sin(rad)+(p.y-c.y)*Math.cos(rad);
    return Math.abs(x)<49&&Math.abs(y)<partHeight(c)/2;
  }
  return Math.abs(c.x - p.x) < 35 && Math.abs(c.y - p.y) < 32;
}
function nearestOnTrace(p: DigitalPoint, path: DigitalPoint[]): {
  point: DigitalPoint; distance: number;
} {
  let nearest = { point: p, distance: Infinity };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const vertical = a.x === b.x;
    const point = vertical
      ? { x: a.x, y: Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), digitalSnap(p.y))) }
      : { x: Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), digitalSnap(p.x))), y: a.y };
    const distance = distanceToSegment(p, a, b);
    if (distance < nearest.distance) nearest = { point, distance };
  }
  return nearest;
}
function drawPixelPart(
  ctx: CanvasRenderingContext2D, c: DigitalComponent,
  doc: DigitalDocument, result: LogicResult, selected: boolean,
) {
  const name = digitalLabel(c, doc.components);
  const source = c.kind === 'input' || c.kind === 'high' || c.kind === 'low';
  const led = c.kind === 'led', block = c.kind === 'block';
  const logical = led ? result.ledValues[c.id]
    : c.kind === 'high' ? 1 : c.kind === 'low' ? 0
      : source ? (c.bit ?? 0) : result.gateValues[c.id];
  const tint = signalColor(logical ?? 'Z');
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.rotate(c.rotation * Math.PI / 180);
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (block) {
    const h=blockHeight(c);
    if (selected) {
      ctx.strokeStyle='#ffc9f5';ctx.setLineDash([5,5]);ctx.lineWidth=2;
      ctx.strokeRect(-67,-h/2-7,134,h+14);ctx.setLineDash([]);
    }
    ctx.shadowColor='#be8bff';ctx.shadowBlur=18;
    ctx.fillStyle='#121437';ctx.fillRect(-60,-h/2,120,h);
    ctx.fillStyle='#362258';ctx.fillRect(-58,-h/2+3,116,h-6);
    ctx.fillStyle='#171a3b';ctx.fillRect(-53,-h/2+8,106,h-16);
    ctx.shadowBlur=0;ctx.strokeStyle='#ca95ff';ctx.lineWidth=3;
    ctx.strokeRect(-60,-h/2,120,h);
    ctx.fillStyle='#c0ffef';ctx.font='bold 20px monospace';ctx.fillText('▣',0,-5);
    ctx.fillStyle='#ecc8fc';ctx.font='bold 10px monospace';
    ctx.fillText(name.length>14?name.slice(0,13)+'…':name,0,17);
    const ins=c.ports?.inputs??[],outs=c.ports?.outputs??[];
    const definition=doc.blocks?.find(def=>def.id===c.blockId);
    ctx.font='bold 9px monospace';
    for (const [ports,side] of [[ins,-1],[outs,1]] as const) {
      for(let i=0;i<ports.length;i++) {
        const y=(i-(ports.length-1)/2)*24;
        ctx.strokeStyle='#85ffe0';ctx.shadowColor='#76f9d4';ctx.shadowBlur=7;
        ctx.beginPath();ctx.moveTo(side*60,y);ctx.lineTo(side*78,y);ctx.stroke();ctx.shadowBlur=0;
        ctx.textAlign=side<0?'left':'right';ctx.fillStyle='#acbce8';
        const port=side<0?definition?.inputs[i]:definition?.outputs[i];
        const caption=(port?.label??ports[i]);
        ctx.fillText(caption.length>9?caption.slice(0,8)+'…':caption,side*48,y-7);
      }
    }
    ctx.restore();return;
  }
  if(isWidePart(c)) {
    const h=partHeight(c),label=partByKind[c.kind as Exclude<DigitalKind,'block'>]?.name??c.kind.toUpperCase();
    if(selected) {
      ctx.strokeStyle='#ffbaf0';ctx.lineWidth=2;ctx.setLineDash([5,4]);
      ctx.strokeRect(-49,-h/2-6,98,h+12);ctx.setLineDash([]);
    }
    ctx.shadowColor='#d28bff';ctx.shadowBlur=15;
    ctx.fillStyle='#100d30';ctx.fillRect(-44,-h/2,88,h);
    ctx.fillStyle='#422758';ctx.fillRect(-41,-h/2+3,82,h-6);
    ctx.fillStyle='#161c3e';ctx.fillRect(-37,-h/2+7,74,h-14);
    ctx.shadowBlur=0;ctx.strokeStyle='#df9eff';ctx.lineWidth=2.5;
    ctx.strokeRect(-44,-h/2,88,h);
    ctx.fillStyle='#f4c7ff';ctx.textAlign='center';ctx.font='bold 11px monospace';
    const short = c.kind==='majority'?'MAJ3':c.kind==='demux2'?'DEMUX':
      c.kind==='halfadder'?'H-ADD':c.kind==='fulladder'?'F-ADD':
      c.kind==='mux2'?'MUX2':c.kind.toUpperCase();
    ctx.shadowColor='#dc85fe';ctx.shadowBlur=8;ctx.fillText(short,0,0);ctx.shadowBlur=0;
    for(const [pins,side] of [[inputsOf(c),-1],[outputsOf(c),1]] as const){
      for(const pin of pins){
        const local=localPinAt(c,pin);
        ctx.strokeStyle='#a5e9ef';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(side*44,local.y);ctx.lineTo(local.x,local.y);ctx.stroke();
        ctx.fillStyle='#a9cdec';ctx.font='bold 8px monospace';
        ctx.textAlign=side===-1?'left':'right';
        ctx.fillText(pin.toUpperCase(),side*38,local.y-8);
      }
    }
    ctx.textAlign='center';ctx.fillStyle='#ffebae';ctx.font='bold 10px monospace';
    ctx.fillText(name,0,-h/2-13);
    ctx.fillStyle=tint;ctx.font='bold 10px monospace';
    ctx.fillText(String(logical??'X'),0,h/2+13);
    ctx.restore();return;
  }
  if (selected) {
    ctx.strokeStyle = '#ffb0ef'; ctx.shadowColor = ink.pink; ctx.shadowBlur = 14;
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(-38, -34, 76, 68);
    ctx.setLineDash([]); ctx.shadowBlur = 0;
  }
  // Pixel-straight pin leads rotate with the sprite, matching actual pin geometry.
  ctx.save();
  ctx.lineWidth = 3; ctx.lineCap = 'square'; ctx.strokeStyle = '#a6e3f5';
  for (const pin of pinsOf(c)) {
    const local = localPinAt(c,pin);
    ctx.beginPath();
    ctx.moveTo(local.x < 0 ? -30 : 30, local.y);
    ctx.lineTo(local.x, local.y); ctx.stroke();
  }
  ctx.restore();
  // The square-stepped enclosure is a small sprite made of crisp pixel blocks.
  ctx.shadowColor = source ? '#62d7ff' : led ? tint : '#a774f5';
  ctx.shadowBlur = led && logical === 1 ? 25 : 11;
  ctx.fillStyle = '#080d25'; ctx.fillRect(-25, -29, 50, 58);
  ctx.fillRect(-30, -24, 60, 48);
  ctx.fillStyle = source ? '#246085' : led ? '#1b4b51' : '#44306f';
  ctx.fillRect(-26, -24, 52, 48);
  ctx.fillRect(-22, -28, 44, 56);
  ctx.fillStyle = '#111733'; ctx.fillRect(-23, -23, 46, 46);
  ctx.strokeStyle = source ? '#6bcfff' : led ? tint : '#d49cff';
  ctx.lineWidth = 2; ctx.strokeRect(-26, -24, 52, 48);
  ctx.fillStyle = '#f7eaff'; ctx.shadowBlur = 0;
  if (source) {
    ctx.font = 'bold 24px monospace'; ctx.fillStyle = tint;
    ctx.shadowColor = tint; ctx.shadowBlur = 12;
    ctx.fillText(String(logical ?? 0), 0, 2); ctx.shadowBlur = 0;
  } else if (led) {
    ctx.fillStyle = logical === 1 ? '#9dffe1' : logical === 0 ? '#2d536b' : '#ff9de7';
    ctx.shadowColor = logical === 1 ? '#44ffc3' : '#ff76cd';
    ctx.shadowBlur = logical === 1 || logical === 'X' ? 21 : 0;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.fillStyle = logical === 1 ? '#e7fff2' : logical === 0 ? '#395a75' : '#ffcbef';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.shadowBlur = 0;
  } else {
    const label = c.kind === 'buffer' ? 'BUF' : c.kind.toUpperCase();
    ctx.fillStyle = '#f4d0ff'; ctx.font = 'bold 12px monospace';
    ctx.shadowColor = '#cf6aff'; ctx.shadowBlur = 7; ctx.fillText(label, 0, 1);
    ctx.shadowBlur = 0;
  }
  ctx.textAlign = 'center'; ctx.font = 'bold 10px monospace';
  ctx.fillStyle = selected ? '#ffe6aa' : '#b5c5ef';
  ctx.fillText(name, 0, -43);
  if (!source && !led) {
    ctx.fillStyle = tint; ctx.font = 'bold 11px monospace';
    ctx.fillText(String(logical ?? 'X'), 0, 44);
  }
  ctx.restore();
}

function drawSignalCanvas(
  canvas: HTMLCanvasElement, doc: DigitalDocument, view: Camera,
  result: LogicResult, selected: DigitalSelection, selectedIds: string[],
  pending: DigitalEndpoint | null, hover: DigitalPoint | null,
  frameTime: number, motion: boolean, pendingBus:BusGroup|null, issues:CircuitIssue[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width, height = rect.height;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(
    width * .6, height * .34, 0, width * .6, height * .34, Math.max(width, height));
  gradient.addColorStop(0, '#201447'); gradient.addColorStop(1, '#080c1c');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.zoom, view.zoom);
  const minX = -view.x / view.zoom, minY = -view.y / view.zoom;
  const maxX = (width-view.x)/view.zoom, maxY = (height-view.y)/view.zoom;
  ctx.lineWidth = 1 / view.zoom;
  for (let x = Math.floor(minX / 24) - 1; x <= Math.ceil(maxX / 24) + 1; x++) {
    ctx.strokeStyle = x%5 === 0 ? ink.major : ink.grid;
    ctx.beginPath(); ctx.moveTo(x*24, minY); ctx.lineTo(x*24, maxY); ctx.stroke();
  }
  for (let y = Math.floor(minY / 24) - 1; y <= Math.ceil(maxY / 24) + 1; y++) {
    ctx.strokeStyle = y%5 === 0 ? ink.major : ink.grid;
    ctx.beginPath(); ctx.moveTo(minX,y*24); ctx.lineTo(maxX,y*24); ctx.stroke();
  }
  const selectedPart = selected?.type==='component'
    ? doc.components.find(c=>c.id===selected.id) : undefined;
  const focusPin=selectedPart&&(outputsOf(selectedPart)[0]??inputsOf(selectedPart)[0]);
  const focusedNet = selected?.type === 'wire' ? result.wireNets[selected.id]
    : selectedPart&&focusPin ? result.terminalNets[selectedPart.id+':'+focusPin] : null;

  for (const wire of doc.wires) {
    const points = digitalWirePath(doc, wire);
    if (points.length < 2) continue;
    const active = result.wireValues[wire.id] ?? 'Z';
    const tint = signalColor(active);
    const isSelected = selected?.type === 'wire' && selected.id === wire.id;
    const highlighted = !!focusedNet && result.wireNets[wire.id] === focusedNet;
    ctx.save();
    ctx.globalAlpha = focusedNet && !highlighted ? .28 : 1;
    ctx.lineWidth = highlighted || isSelected ? 5 : 3;
    ctx.strokeStyle = highlighted ? ink.pink : tint;
    ctx.shadowColor = highlighted ? ink.pink : tint;
    ctx.shadowBlur = active === 1 ? 20 : highlighted ? 16 : 7;
    ctx.lineJoin = 'bevel'; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke(); ctx.shadowBlur = 0;
    if (active === 1) {
      ctx.strokeStyle = '#ddfff8'; ctx.lineWidth = 1.1; ctx.stroke();
    }
    if (motion && active === 1) {
      // Traveling illuminated blocks indicate a propagating logical HIGH.
      // This is a visual propagation cue, not analog charge/current velocity.
      const spans: number[] = [];
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        const len = Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
        spans.push(len); total += len;
      }
      ctx.fillStyle = '#effff9'; ctx.shadowColor = '#91ffdd'; ctx.shadowBlur = 11;
      for (let i = 0; total > 0 && i < Math.min(9, Math.max(1, Math.floor(total / 55))); i++) {
        let position = (i * 65 + frameTime * 60) % total;
        for (let j = 0; j < spans.length; j++) {
          if (position <= spans[j]) {
            const t = spans[j] ? position / spans[j] : 0;
            const x = points[j].x + (points[j+1].x - points[j].x) * t;
            const y = points[j].y + (points[j+1].y - points[j].y) * t;
            ctx.fillRect(x-2, y-2, 5, 5); break;
          }
          position -= spans[j];
        }
      }
    }
    ctx.restore();
    if(wire.label){
      const at=points[Math.floor(points.length/2)];
      ctx.save();ctx.font='bold 11px monospace';ctx.textAlign='center';
      ctx.fillStyle='#d2e6ff';ctx.shadowColor='#142544';ctx.shadowBlur=5;
      ctx.fillText(wire.label,at.x,at.y-14);ctx.restore();
    }
    if(isSelected&&wire.waypoints?.length){
      for(const p of wire.waypoints){ctx.save();ctx.fillStyle='#fff2b4';
        ctx.fillRect(p.x-7,p.y-7,14,14);ctx.restore();}
    }
    for (const end of [wire.from, wire.to]) {
      if (isDigitalTerminal(end)) continue;
      ctx.save(); ctx.strokeStyle = ink.pink; ctx.shadowColor = ink.pink;
      ctx.shadowBlur = 13; ctx.lineWidth = 2.5;
      ctx.strokeRect(end.x-6, end.y-6, 12, 12); ctx.restore();
    }
  }
  for(const bus of doc.buses??[]){
    const path=digitalBusPath(doc,bus);
    if(path.length<2)continue;
    const bits=bus.from.pins.map(pin=>result.terminalValues[bus.from.componentId+':'+pin]??'Z');
    const selectedBus=selected?.type==='bus'&&selected.id===bus.id;
    const tint=bits.some(v=>v==='X')?'#ff9aca':bits.some(v=>v===1)?'#86e9d1':'#789dcb';
    ctx.save();ctx.strokeStyle=selectedBus?'#fff1a6':tint;
    ctx.lineWidth=selectedBus?12:9;ctx.lineJoin='bevel';ctx.shadowColor=tint;ctx.shadowBlur=13;
    ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    for(const point of path.slice(1))ctx.lineTo(point.x,point.y);
    ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='#18283c';ctx.lineWidth=3;ctx.stroke();
    const middle=path[Math.floor(path.length/2)];
    const label=(bus.label?bus.label+' ':'')+'['+(bus.width-1)+':0]';
    ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillStyle='#edfff7';ctx.shadowColor='#070e25';ctx.shadowBlur=8;
    ctx.fillText(label,middle.x,middle.y-16);
    if(selectedBus&&bus.waypoints?.length)for(const p of bus.waypoints){
      ctx.fillStyle='#fff0ac';ctx.fillRect(p.x-7,p.y-7,14,14);
    }
    ctx.restore();
  }
  for (const point of intentionalJunctions(doc)) {
    ctx.save(); ctx.fillStyle = '#f6b5ff'; ctx.shadowColor = '#e38bff'; ctx.shadowBlur = 12;
    ctx.fillRect(point.x-6, point.y-6, 12, 12); ctx.fillStyle = '#fff';
    ctx.fillRect(point.x-2, point.y-2, 4, 4); ctx.restore();
  }
  for (const c of doc.components) {
    drawPixelPart(ctx, c, doc, result,
      selectedIds.includes(c.id) || selected?.type === 'component' && selected.id === c.id);
    for (const pin of pinsOf(c)) {
      const point = pinAt(c, pin);
      const key = c.id + ':' + pin, value = result.terminalValues[key] ?? 'Z';
      const chosen = pending && isDigitalTerminal(pending) &&
        pending.componentId === c.id && pending.pin === pin;
      ctx.save(); ctx.fillStyle = chosen ? ink.gold : signalColor(value);
      ctx.shadowColor = chosen ? ink.gold : signalColor(value); ctx.shadowBlur = 12;
      ctx.fillRect(point.x-5, point.y-5, 10, 10);
      ctx.shadowBlur = 0; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#e8defb';
      if(!isWidePart(c)&&c.kind!=='block')
        ctx.fillText(pin.toUpperCase(), point.x, point.y < c.y ? point.y-13 : point.y+20);
      ctx.restore();
    }
  }
  const marked=new Map<string,CircuitIssue['severity']>();
  for(const issue of issues)if(issue.componentId&&!marked.has(issue.componentId))
    marked.set(issue.componentId,issue.severity);
  for(const c of doc.components){
    const severity=marked.get(c.id);
    if(!severity)continue;
    ctx.save();ctx.shadowColor=severity==='error'?'#ff7caa':'#ffdb9b';
    ctx.shadowBlur=13;ctx.fillStyle=severity==='error'?'#ff86b2':'#ffe09c';
    const offset=partHeight(c)/2+19;
    ctx.fillRect(c.x+23,c.y-offset,19,19);
    ctx.fillStyle='#122035';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText('!',c.x+32.5,c.y-offset+14);ctx.restore();
  }
  if(pendingBus&&hover){
    const start=digitalBusPoint(doc,pendingBus);
    if(start){ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='#a4ffe3';
      ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(start.x,start.y);
      ctx.lineTo(hover.x,start.y);ctx.lineTo(hover.x,hover.y);ctx.stroke();ctx.restore();}
  }
  if (pending && hover) {
    const start = endpointPoint(doc, pending);
    if (start) {
      ctx.save(); ctx.setLineDash([8,7]); ctx.strokeStyle = '#ffe17b';
      ctx.shadowColor = ink.gold; ctx.shadowBlur = 8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(start.x,start.y); ctx.lineTo(hover.x,start.y);
      ctx.lineTo(hover.x,hover.y); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
}

export function SignalCanvas({ result, onProbe }: { result: LogicResult; onProbe?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const dragging = useRef<Drag | null>(null);
  const didFit = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Camera>({ x: 80, y: 70, zoom: 1 });
  const [hover, setHover] = useState<DigitalPoint | null>(null);
  const [menu, setMenu] = useState<Popup | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animate, setAnimate] = useState(true);
  const doc = useDigitalStore(s => s.document);
  const selection = useDigitalStore(s => s.selection);
  const selectedIds = useDigitalStore(s => s.selectedIds);
  const pending = useDigitalStore(s => s.pending);
  const pendingBus=useDigitalStore(s=>s.pendingBus);
  const focusTarget=useDigitalStore(s=>s.focusTarget);
  const issues=useMemo(()=>diagnoseDigitalCircuit(doc),[doc]);
  const startBus=useDigitalStore(s=>s.startBus);
  const finishBus=useDigitalStore(s=>s.finishBus);
  const flipBend=useDigitalStore(s=>s.flipBend);
  const setBend=useDigitalStore(s=>s.setBend);
  const autoRoute=useDigitalStore(s=>s.autoRoute);
  const select = useDigitalStore(s => s.select);
  const move = useDigitalStore(s => s.move);
  const moveEnd = useDigitalStore(s => s.moveEnd);
  const toggleInput = useDigitalStore(s => s.toggleInput);
  const startWire = useDigitalStore(s => s.startWire);
  const finishWire = useDigitalStore(s => s.finishWire);
  const remove = useDigitalStore(s => s.remove);
  const add = useDigitalStore(s => s.add);
  const rotate = useDigitalStore(s => s.rotate);
  const straighten = useDigitalStore(s => s.straighten);
  const copy = useDigitalStore(s => s.copy);
  const duplicate = useDigitalStore(s => s.duplicate);
  const addProbe = useDigitalStore(s => s.addProbe);
  const addSavedBlock = useDigitalStore(s => s.addSavedBlock);
  const openBlock = useDigitalStore(s => s.openBlock);
  const dragStart = useDigitalStore(s => s.dragStart);
  const dragEnd = useDigitalStore(s => s.dragEnd);

  useEffect(() => {
    const element = wrapper.current, cvs = canvas.current;
    if (!element || !cvs) return;
    const resize = () => {
      const r = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.round(r.width * dpr);
      cvs.height = Math.round(r.height * dpr);
      setSize({ width: r.width, height: r.height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element); resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if(size.width>0&&size.height>0&&!didFit.current){
      didFit.current=true;
      setView(fitDigitalCircuit(doc,size));
    }
  },[size.width,size.height,doc]);
  useEffect(()=>{
    if(!focusTarget||!size.width||!size.height)return;
    let point:DigitalPoint|null=null;
    const part=doc.components.find(c=>c.id===focusTarget.id);
    if(part)point={x:part.x,y:part.y};
    const wire=doc.wires.find(w=>w.id===focusTarget.id);
    if(wire)point=digitalWirePath(doc,wire)[0]??null;
    const bus=doc.buses?.find(b=>b.id===focusTarget.id);
    if(bus)point=digitalBusPath(doc,bus)[0]??null;
    if(point)setView(v=>({...v,x:size.width/2-point.x*v.zoom,
      y:size.height/2-point.y*v.zoom}));
  },[focusTarget?.nonce,size.width,size.height]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const junctions = useMemo(() => intentionalJunctions(doc), [doc]);
  useEffect(() => {
    let raf = 0;
    const moving = animate && !reducedMotion &&
      Object.values(result.wireValues).some(v => v === 1);
    const draw = (ms: number) => {
      if (canvas.current) drawSignalCanvas(canvas.current, doc, view, result, selection,
        selectedIds,pending,hover,ms/1000,moving,pendingBus,issues);
      if (moving) raf = window.requestAnimationFrame(draw);
    };
    draw(0);
    return () => window.cancelAnimationFrame(raf);
  }, [doc, view, result, selection, selectedIds, pending, hover, size,
    animate,reducedMotion,junctions,pendingBus,issues]);

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: event.clientX-r.left, y: event.clientY-r.top };
  };
  const world = (event: { clientX: number; clientY: number }) => {
    const p = localPoint(event);
    return { x: (p.x-view.x)/view.zoom, y: (p.y-view.y)/view.zoom };
  };
  const findPin = (p: DigitalPoint): DigitalEndpoint | null => {
    for (const c of [...doc.components].reverse()) {
      for (const pin of pinsOf(c)) {
        const q = pinAt(c, pin);
        if (Math.hypot(q.x-p.x, q.y-p.y) <= 10 / view.zoom) {
          return { componentId: c.id, pin };
        }
      }
    }
    return null;
  };
  const findTip = (p: DigitalPoint) => {
    for (const w of [...doc.wires].reverse()) {
      for (const side of ['from','to'] as const) {
        const endpoint = w[side];
        if (!isDigitalTerminal(endpoint) &&
          Math.hypot(endpoint.x-p.x, endpoint.y-p.y) <= 10/view.zoom) {
          return { wireId: w.id, side, point: endpoint };
        }
      }
    }
    return null;
  };
  const findBus=(p:DigitalPoint)=>{
    let best:{id:string;point:DigitalPoint;distance:number}|null=null;
    for(const b of doc.buses??[]){
      const next=nearestOnTrace(p,digitalBusPath(doc,b));
      if(next.distance<11/view.zoom&&(!best||next.distance<best.distance))
        best={id:b.id,...next};
    }
    return best;
  };
  const findBend=(p:DigitalPoint)=>{
    for(const wire of doc.wires){
      for(const bend of wire.waypoints??[])
        if(Math.hypot(bend.x-p.x,bend.y-p.y)<12/view.zoom)
          return {kind:'wire' as const,id:wire.id};
    }
    for(const bus of doc.buses??[]){
      for(const bend of bus.waypoints??[])
        if(Math.hypot(bend.x-p.x,bend.y-p.y)<12/view.zoom)
          return {kind:'bus' as const,id:bus.id};
    }
    return null;
  };
  const findWire = (p: DigitalPoint) => {
    let best: { wire: DigitalWire; point: DigitalPoint; distance: number } | null = null;
    for (const wire of [...doc.wires].reverse()) {
      const point = nearestOnTrace(p, digitalWirePath(doc,wire));
      if (point.distance < 10/view.zoom && (!best || point.distance < best.distance)) {
        best = { wire, ...point };
      }
    }
    return best;
  };

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault(); setMenu(null);
    const p = world(e);
    if(e.button===0){
      if(pendingBus){
        const target=[...doc.components].reverse().find(c=>hitPart(c,p)||
          pinsOf(c).some(pin=>{const at=pinAt(c,pin);
            return Math.hypot(at.x-p.x,at.y-p.y)<14/view.zoom;}));
        if(target){
          const groups=busGroups(target).filter(g=>g.width===pendingBus.width&&
            g.componentId!==pendingBus.componentId);
          const best=groups.find(g=>g.direction!==pendingBus.direction)??groups[0];
          if(best)finishBus(best);
          return;
        }
      }
      const pin = findPin(p);
      if (pin) { finishWire(pin); return; }
      const tip = findTip(p);
      if (tip) {
        if (e.shiftKey && !pending) {
          select({ type: 'wire', id: tip.wireId });
          dragStart();
          dragging.current = { type: 'tip', wireId: tip.wireId,
            side: tip.side, at: p, x: tip.point.x, y: tip.point.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        } else finishWire(tip.point);
        return;
      }
      if (pending) {
        const trace = findWire(p);
        finishWire(trace ? trace.point : { x: digitalSnap(p.x), y: digitalSnap(p.y) });
        return;
      }
      const c = [...doc.components].reverse().find(c => hitPart(c,p));
      if (c) {
        if (e.shiftKey || e.metaKey) {
          select({ type: 'component', id: c.id }, true); return;
        }
        if (!selectedIds.includes(c.id)) select({ type: 'component', id: c.id });
        dragStart();
        dragging.current = { type: 'component', id: c.id, at: p,
          x: c.x, y: c.y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      const bend=findBend(p);
      if(bend){select({type:bend.kind,id:bend.id});
        dragStart();dragging.current={type:'bend',...bend};
        e.currentTarget.setPointerCapture(e.pointerId);return;}
      const trace=findWire(p);
      if(trace){select({type:'wire',id:trace.wire.id});return;}
      const bus=findBus(p);
      if(bus){select({type:'bus',id:bus.id});return;}
      select(null);
    }
    dragging.current = { type: 'pan', x: e.clientX, y: e.clientY, atX: view.x, atY: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const movePointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = world(e);
    setHover({ x: digitalSnap(p.x), y: digitalSnap(p.y) });
    const d = dragging.current;
    if (!d) return;
    if (d.type === 'pan') {
      setView(v => ({ ...v, x: d.atX + e.clientX-d.x, y: d.atY + e.clientY-d.y }));
    } else if (d.type === 'component') {
      const x = digitalSnap(d.x + p.x-d.at.x), y = digitalSnap(d.y + p.y-d.at.y);
      if (x !== d.x || y !== d.y) d.moved = true;
      move(d.id,{ x,y });
    } else if(d.type==='tip'){
      moveEnd(d.wireId,d.side,{x:d.x+p.x-d.at.x,y:d.y+p.y-d.at.y});
    }else if(d.type==='bend'){
      setBend(d.kind,d.id,p);
    }
  };
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = dragging.current;
    if(d?.type==='component'||d?.type==='tip'||d?.type==='bend')dragEnd();
    if (d?.type === 'component' && !d.moved) {
      const c = useDigitalStore.getState().document.components.find(c => c.id === d.id);
      if (c?.kind === 'input') toggleInput(c.id);
    }
    dragging.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const wheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const screen = localPoint(e);
    const zoom = Math.max(.3, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.1 : 1/1.1)));
    setView({ zoom, x: screen.x-(screen.x-view.x)*zoom/view.zoom,
      y: screen.y-(screen.y-view.y)*zoom/view.zoom });
  };
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = world(e), screen = localPoint(e);
    const c = [...doc.components].reverse().find(c => hitPart(c,p));
    const trace=c?null:findWire(p);
    const bus=c||trace?null:findBus(p);
    const choice:DigitalSelection=c?{type:'component',id:c.id}:
      trace?{type:'wire',id:trace.wire.id}:
        bus?{type:'bus',id:bus.id}:null;
    select(choice);
    const r = wrapper.current!.getBoundingClientRect();
    setMenu({ x: Math.max(8,Math.min(r.width-245,screen.x)),
      y:Math.max(8,Math.min(r.height-300,screen.y)), world:{
        x:digitalSnap(p.x),y:digitalSnap(p.y) },
      selection:choice,wirePoint:trace?.point??null });
  };
  const doubleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (pending) return;
    const p = world(e);
    const instance = [...doc.components].reverse().find(c =>
      c.kind === 'block' && hitPart(c, p));
    if (!instance) return;
    e.preventDefault();
    try { openBlock(instance.id); }
    catch (err) { window.alert(err instanceof Error ? err.message : 'Cannot open block.'); }
  };
  const onDrop = (e: DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData('application/x-signal-block');
    if (blockId) {
      try { addSavedBlock(blockId,world(e)); }
      catch(error) {window.alert(error instanceof Error?error.message:'Unable to place block.');}
      return;
    }
    const kind = e.dataTransfer.getData('application/x-signal-kind') as DigitalKind;
    if (!digitalKinds.includes(kind) || kind==='block') return;
    add(kind,world(e));
  };
  const action = (fn: () => void) => () => { fn(); setMenu(null); };
  const menuPart = menu?.selection?.type === 'component'
    ? doc.components.find(c => c.id === menu.selection?.id) : null;
  const wireSelected=menu?.selection?.type==='wire'?menu.selection.id:null;
  const busSelected=menu?.selection?.type==='bus'?menu.selection.id:null;
  return (
    <div className="signal-canvas-wrapper" ref={wrapper}>
      <canvas ref={canvas} className="signal-canvas" aria-label="Digital logic schematic editor"
        onPointerDown={down} onPointerMove={movePointer} onPointerUp={up}
        onDoubleClick={doubleClick}
        onPointerCancel={up} onWheel={wheel} onContextMenu={context}
        onPointerLeave={() => setHover(null)}
        onDragOver={e=>e.preventDefault()} onDrop={onDrop} />
      <div className="signal-canvas-hint">
        <span className="spark">✦</span> CLICK PINS TO WIRE <span>·</span> DOUBLE-CLICK BLOCK TO EDIT
        <span>·</span> RIGHT-CLICK FOR BUSES & NETS
      </div>
      <div className="signal-canvas-controls">
        <button className={animate && !reducedMotion ? 'is-active' : ''}
          aria-pressed={animate && !reducedMotion}
          title={reducedMotion ? 'Motion disabled by system accessibility settings' : 'Toggle signal propagation glow'}
          disabled={reducedMotion} onClick={() => setAnimate(v=>!v)}>
          {animate && !reducedMotion ? '◉ PULSE' : '○ PULSE'}
        </button>
        <button title="Zoom out" onClick={() => setView(v=>({...v,zoom:Math.max(.3,v.zoom/1.2)}))}>−</button>
        <span>{Math.round(view.zoom*100)}%</span>
        <button title="Zoom in" onClick={() => setView(v=>({...v,zoom:Math.min(2.5,v.zoom*1.2)}))}>+</button>
        <button title="Fit all circuit components into view" onClick={() =>
          setView(fitDigitalCircuit(doc,size))}>⊡ FIT</button>
      </div>
      {pending&&<div className="signal-wire-tip">WIRE · CLICK DESTINATION · ESC CANCELS</div>}
      {pendingBus&&<div className="signal-wire-tip signal-bus-tip">
        {pendingBus.width}-BIT BUS FROM {pendingBus.title} · CLICK TARGET OR RIGHT-CLICK A SPECIFIC GROUP · ESC CANCELS
      </div>}
      {menu && <>
        <div className="signal-menu-backdrop" onPointerDown={() => setMenu(null)} />
        <div className="signal-context-menu" role="menu" aria-label="Digital schematic actions"
          style={{left:menu.x,top:menu.y,maxHeight:Math.max(180,size.height-menu.y-8)}}>
          <div className="signal-menu-heading"><span>✦ QUICK ACTIONS</span>
            <button aria-label="Close menu" onClick={()=>setMenu(null)}>×</button>
          </div>
          {menuPart ? <>
            <div className="signal-menu-subtitle">{digitalLabel(menuPart,doc.components)} · {menuPart.kind.toUpperCase()}</div>
            {menuPart.kind==='input' && <button className="signal-menu-accent"
              onClick={action(()=>toggleInput(menuPart.id))}>↯ TOGGLE TO {menuPart.bit===1?'LOW':'HIGH'}</button>}
            {menuPart.kind==='block' && <button className="signal-menu-accent"
              onClick={action(()=>openBlock(menuPart.id))}>▣ OPEN & EDIT INTERNAL CIRCUIT</button>}
            {busGroups(menuPart).length>0&&<div className="signal-menu-section">▰ MULTI-BIT BUSES</div>}
            {busGroups(menuPart).map(group=><button key={group.direction+group.title}
              className="signal-menu-accent"
              onClick={action(()=>pendingBus?finishBus(group):startBus(group))}>
              {pendingBus?'↳ CONNECT '+group.title:'▰ START '+group.width+'-BIT '+group.title}
            </button>)}
            {pinsOf(menuPart).map(pin=><div className="signal-port-actions" key={pin}>
              <button onClick={action(()=>startWire({componentId:menuPart.id,pin}))}>
                ⌁ {menuPart.kind==='block'
                  ? doc.blocks?.find(d=>d.id===menuPart.blockId)?.[
                      menuPart.ports?.inputs.includes(pin)?'inputs':'outputs']
                      .find(port=>port.pin===pin)?.label??pin.toUpperCase()
                  : pin.toUpperCase()}
              </button>
              <button title={'Plot signal at '+pin} onClick={action(()=>{
                addProbe('terminal',menuPart.id+':'+pin,digitalLabel(menuPart,doc.components)+'.'+pin);
                onProbe?.();
              })}>⌁ PROBE</button>
            </div>)}
            <button onClick={action(()=>rotate(menuPart.id))}>↻ ROTATE 90°</button>
            <button onClick={action(copy)}>▣ COPY</button>
            <button onClick={action(duplicate)}>⊞ DUPLICATE</button>
            <button className="signal-danger" onClick={action(remove)}>× DELETE</button>
          </> : wireSelected ? <>
            <div className="signal-menu-subtitle">SIGNAL WIRE</div>
            <button className="signal-menu-accent"
              onClick={action(()=>startWire(menu.wirePoint??menu.world))}>⌁ BRANCH HERE</button>
            <button onClick={action(()=>{
              addProbe('wire',wireSelected,'WIRE '+wireSelected.slice(0,5));onProbe?.();
            })}>〰 GRAPH THIS WIRE</button>
            <button onClick={action(()=>flipBend('wire',wireSelected))}>↴ FLIP CORNER</button>
            <button onClick={action(()=>setBend('wire',wireSelected,menu.world))}>◈ MOVE BEND HERE</button>
            <button onClick={action(()=>autoRoute('wire',wireSelected))}>⌁ SMART AUTO ROUTE</button>
            <button className="signal-danger" onClick={action(remove)}>× DELETE WIRE</button>
          </> : busSelected ? <>
            <div className="signal-menu-subtitle">▰ MULTI-BIT BUS</div>
            <button onClick={action(()=>flipBend('bus',busSelected))}>↴ FLIP BUS CORNER</button>
            <button onClick={action(()=>setBend('bus',busSelected,menu.world))}>◈ MOVE BEND HERE</button>
            <button onClick={action(()=>autoRoute('bus',busSelected))}>⌁ SMART AUTO ROUTE</button>
            <button className="signal-danger" onClick={action(remove)}>× DELETE BUS</button>
          </> : <>
            <div className="signal-menu-subtitle">GRID · {menu.world.x}, {menu.world.y}</div>
            <button className="signal-menu-accent"
              onClick={action(()=>startWire(menu.world))}>⌁ START FREE WIRE</button>
            <div className="signal-menu-section">PLACE A COMPONENT · OR PRESS / TO SEARCH</div>
            {paletteCategories.map(group=><div key={group.id}>
              <div className="signal-menu-section signal-menu-category">{group.icon} {group.name}</div>
              <div className="signal-menu-grid">
                {group.parts.map(part=><button key={part.kind}
                  title={part.description} onClick={action(()=>add(part.kind,menu.world))}>
                  {part.glyph} {part.name}</button>)}
              </div>
            </div>)}
          </>}
        </div>
      </>}
    </div>
  );
}
