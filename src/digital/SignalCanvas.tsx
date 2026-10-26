import {
  DragEvent, MouseEvent, PointerEvent, WheelEvent,
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  DigitalComponent, DigitalDocument, DigitalEndpoint, DigitalKind, DigitalPoint,
  DigitalSelection, DigitalWire, LogicResult, LogicValue,
  digitalLabel, digitalSnap, isDigitalTerminal, pinAt, pinsOf, blockHeight,
} from './types';
import {
  digitalWirePath, endpointPoint, intentionalJunctions,
} from './network';
import { useDigitalStore } from './useDigitalStore';

type Camera = { x: number; y: number; zoom: number };
type Drag = {
  type: 'component'; id: string; at: DigitalPoint; x: number; y: number; moved: boolean;
} | {
  type: 'tip'; wireId: string; side: 'from' | 'to'; at: DigitalPoint; x: number; y: number;
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
  const source = c.kind === 'input', led = c.kind === 'led', block = c.kind === 'block';
  const logical = led ? result.ledValues[c.id]
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
    ctx.font='bold 9px monospace';
    for (const [ports,side] of [[ins,-1],[outs,1]] as const) {
      for(let i=0;i<ports.length;i++) {
        const y=(i-(ports.length-1)/2)*24;
        ctx.strokeStyle='#85ffe0';ctx.shadowColor='#76f9d4';ctx.shadowBlur=7;
        ctx.beginPath();ctx.moveTo(side*60,y);ctx.lineTo(side*78,y);ctx.stroke();ctx.shadowBlur=0;
        ctx.textAlign=side<0?'left':'right';ctx.fillStyle='#acbce8';
        ctx.fillText(ports[i].replace(/^in/,'I').replace(/^out/,'O'),side*48,y-7);
      }
    }
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
    const local = pin === 'out' ? {x:48,y:0}
      : pin === 'in' ? {x:-48,y:0}
        : pin === 'a' ? {x:-48,y:pinsOf(c).includes('b')?-12:0}
          : {x:-48,y:12};
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
    ctx.fillText(String(c.bit ?? 0), 0, 2); ctx.shadowBlur = 0;
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
  frameTime: number, motion: boolean,
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
  const focusedNet = selected?.type === 'wire' ? result.wireNets[selected.id]
    : selected?.type === 'component'
      ? result.terminalNets[selected.id + ':out'] ??
        result.terminalNets[selected.id + ':in'] : null;

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
    for (const end of [wire.from, wire.to]) {
      if (isDigitalTerminal(end)) continue;
      ctx.save(); ctx.strokeStyle = ink.pink; ctx.shadowColor = ink.pink;
      ctx.shadowBlur = 13; ctx.lineWidth = 2.5;
      ctx.strokeRect(end.x-6, end.y-6, 12, 12); ctx.restore();
    }
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
      ctx.fillText(pin.toUpperCase(), point.x, point.y < c.y ? point.y-13 : point.y+20);
      ctx.restore();
    }
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
        selectedIds, pending, hover, ms / 1000, moving);
      if (moving) raf = window.requestAnimationFrame(draw);
    };
    draw(0);
    return () => window.cancelAnimationFrame(raf);
  }, [doc, view, result, selection, selectedIds, pending, hover, size,
    animate, reducedMotion, junctions]);

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
    if (e.button === 0) {
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
      const trace = findWire(p);
      if (trace) { select({ type: 'wire', id: trace.wire.id }); return; }
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
    } else {
      moveEnd(d.wireId,d.side, { x: d.x+p.x-d.at.x, y: d.y+p.y-d.at.y });
    }
  };
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = dragging.current;
    if (d?.type === 'component' || d?.type === 'tip') dragEnd();
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
    const zoom = Math.max(.35, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.1 : 1/1.1)));
    setView({ zoom, x: screen.x-(screen.x-view.x)*zoom/view.zoom,
      y: screen.y-(screen.y-view.y)*zoom/view.zoom });
  };
  const context = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = world(e), screen = localPoint(e);
    const c = [...doc.components].reverse().find(c => hitPart(c,p));
    const trace = c ? null : findWire(p);
    const choice: DigitalSelection = c ? { type: 'component', id:c.id }
      : trace ? { type:'wire', id:trace.wire.id } : null;
    select(choice);
    const r = wrapper.current!.getBoundingClientRect();
    setMenu({ x: Math.max(8,Math.min(r.width-245,screen.x)),
      y:Math.max(8,Math.min(r.height-300,screen.y)), world:{
        x:digitalSnap(p.x),y:digitalSnap(p.y) },
      selection:choice,wirePoint:trace?.point??null });
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
    if (!['input','and','or','not','xor','nand','nor','xnor','buffer','led'].includes(kind)) return;
    add(kind,world(e));
  };
  const action = (fn: () => void) => () => { fn(); setMenu(null); };
  const menuPart = menu?.selection?.type === 'component'
    ? doc.components.find(c => c.id === menu.selection?.id) : null;
  const wireSelected = menu?.selection?.type === 'wire' ? menu.selection.id : null;
  return (
    <div className="signal-canvas-wrapper" ref={wrapper}>
      <canvas ref={canvas} className="signal-canvas" aria-label="Digital logic schematic editor"
        onPointerDown={down} onPointerMove={movePointer} onPointerUp={up}
        onPointerCancel={up} onWheel={wheel} onContextMenu={context}
        onPointerLeave={() => setHover(null)}
        onDragOver={e=>e.preventDefault()} onDrop={onDrop} />
      <div className="signal-canvas-hint">
        <span className="spark">✦</span> CLICK INPUTS TO TOGGLE <span>·</span> CLICK PINS TO WIRE
        <span>·</span> RIGHT-CLICK TO EDIT
      </div>
      <div className="signal-canvas-controls">
        <button className={animate && !reducedMotion ? 'is-active' : ''}
          aria-pressed={animate && !reducedMotion}
          title={reducedMotion ? 'Motion disabled by system accessibility settings' : 'Toggle signal propagation glow'}
          disabled={reducedMotion} onClick={() => setAnimate(v=>!v)}>
          {animate && !reducedMotion ? '◉ PULSE' : '○ PULSE'}
        </button>
        <button title="Zoom out" onClick={() => setView(v=>({...v,zoom:Math.max(.35,v.zoom/1.2)}))}>−</button>
        <span>{Math.round(view.zoom*100)}%</span>
        <button title="Zoom in" onClick={() => setView(v=>({...v,zoom:Math.min(2.5,v.zoom*1.2)}))}>+</button>
        <button title="Reset view" onClick={() => setView({x:80,y:70,zoom:1})}>⌖</button>
      </div>
      {pending && <div className="signal-wire-tip">WIRE IN PROGRESS · CLICK DESTINATION · ESC ENDS</div>}
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
            {pinsOf(menuPart).map(pin=><div className="signal-port-actions" key={pin}>
              <button onClick={action(()=>startWire({componentId:menuPart.id,pin}))}>
                ⌁ WIRE {pin.toUpperCase()}
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
            <button onClick={action(()=>straighten(wireSelected))}>⌁ STRAIGHTEN ROUTE</button>
            <button className="signal-danger" onClick={action(remove)}>× DELETE WIRE</button>
          </> : <>
            <div className="signal-menu-subtitle">GRID · {menu.world.x}, {menu.world.y}</div>
            <button className="signal-menu-accent"
              onClick={action(()=>startWire(menu.world))}>⌁ START FREE WIRE</button>
            <div className="signal-menu-section">PLACE A COMPONENT</div>
            <div className="signal-menu-grid">
              {(['input','and','or','not','xor','nand','nor','xnor','buffer','led'] as DigitalKind[])
                .map(kind=><button key={kind} onClick={action(()=>add(kind,menu.world))}>
                  + {kind.toUpperCase()}</button>)}
            </div>
          </>}
        </div>
      </>}
    </div>
  );
}
