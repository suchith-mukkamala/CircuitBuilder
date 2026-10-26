import { DragEvent, PointerEvent, WheelEvent, useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import {
  CircuitComponent, CircuitDocument, ComponentKind, Point, Wire,
  pinPosition, pinsFor, snap, formatElectrical, labelFor, terminalKey,
} from '../circuit/types';

type View = { x: number; y: number; zoom: number };
type Drag = { type: 'component'; id: string; x: number; y: number; at: Point } |
  { type: 'pan'; clientX: number; clientY: number; originalX: number; originalY: number };

const colors = {
  bg: '#0a2026', fine: '#153841', major: '#24505a',
  wire: '#96e4d8', text: '#e4e6d8', yellow: '#ffca71', green: '#7af5c4',
};

function nearSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fraction = dx * dx + dy * dy === 0 ? 0 :
    Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - fraction * dx, p.y - a.y - fraction * dy);
}

function wirePath(wire: Wire, doc: CircuitDocument): Point[] {
  const a = doc.components.find(c => c.id === wire.from.componentId);
  const b = doc.components.find(c => c.id === wire.to.componentId);
  if (!a || !b) return [];
  const start = pinPosition(a, wire.from.pin), end = pinPosition(b, wire.to.pin);
  const anchors = [start, ...(wire.waypoints?.length ? wire.waypoints : [{ x: end.x, y: start.y }]), end];
  const result = [anchors[0]];
  for (const next of anchors.slice(1)) {
    const last = result[result.length - 1];
    if (last.x !== next.x && last.y !== next.y) result.push({ x: last.x, y: next.y });
    result.push(next);
  }
  return result;
}

function hitComponent(c: CircuitComponent, p: Point): boolean {
  const dx = p.x - c.x, dy = p.y - c.y;
  const radians = -c.rotation * Math.PI / 180;
  const x = dx * Math.cos(radians) - dy * Math.sin(radians);
  const y = dx * Math.sin(radians) + dy * Math.cos(radians);
  return c.kind === 'ground'
    ? Math.abs(x) < 25 && Math.abs(y) < 27
    : c.kind === 'voltage_source'
      ? Math.hypot(x, y) < 26
      : Math.abs(x) < 34 && Math.abs(y) < 20;
}

function drawComponent(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean): void {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rotation * Math.PI / 180);
  ctx.lineWidth = 3;
  ctx.lineCap = 'square';
  if (selected) {
    ctx.fillStyle = '#284d57';
    ctx.fillRect(-39, -28, 78, 56);
  }
  if (c.kind === 'resistor') {
    ctx.strokeStyle = '#e5d9b7';
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-28, 0);
    ctx.moveTo(28, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.fillStyle = '#efc58b'; ctx.fillRect(-28, -13, 56, 26);
    ctx.fillStyle = '#aa7958'; ctx.fillRect(-28, -13, 5, 26); ctx.fillRect(23, -13, 5, 26);
    for (const [x, col] of [[-17, '#a7494b'], [-6, '#d68b42'], [5, '#a7494b'], [17, '#bb833b']] as const) {
      ctx.fillStyle = col; ctx.fillRect(x, -13, 5, 26);
    }
    ctx.strokeStyle = '#f9deb7'; ctx.lineWidth = 1; ctx.strokeRect(-28, -13, 56, 26);
  } else if (c.kind === 'voltage_source') {
    ctx.strokeStyle = '#e5d9b7';
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -20);
    ctx.moveTo(0, 20); ctx.lineTo(0, 48); ctx.stroke();
    ctx.fillStyle = '#163440'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd28a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#f0e5cf'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(6, -9); ctx.moveTo(0, -15); ctx.lineTo(0, -3);
    ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.stroke();
  } else {
    ctx.strokeStyle = '#e5d9b7'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -6);
    ctx.moveTo(-22, -6); ctx.lineTo(22, -6);
    ctx.moveTo(-15, 1); ctx.lineTo(15, 1);
    ctx.moveTo(-7, 8); ctx.lineTo(7, 8); ctx.stroke();
  }
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement, doc: CircuitDocument, view: View,
  selection: { type: 'component' | 'wire'; id: string } | null,
  pending: { componentId: string; pin: 'a' | 'b' | 'g' } | null,
  hover: Point | null, simulation: ReturnType<typeof useCircuitStore.getState>['simulation'],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bounds = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = bounds.width, height = bounds.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  const minX = -view.x / view.zoom, minY = -view.y / view.zoom;
  const maxX = (width - view.x) / view.zoom, maxY = (height - view.y) / view.zoom;
  const minGridX = Math.floor(minX / 24) - 1, maxGridX = Math.ceil(maxX / 24) + 1;
  const minGridY = Math.floor(minY / 24) - 1, maxGridY = Math.ceil(maxY / 24) + 1;
  ctx.lineWidth = 1 / view.zoom;
  for (let x = minGridX; x <= maxGridX; x++) {
    ctx.strokeStyle = x % 5 === 0 ? colors.major : colors.fine;
    ctx.beginPath(); ctx.moveTo(x * 24, minY); ctx.lineTo(x * 24, maxY); ctx.stroke();
  }
  for (let y = minGridY; y <= maxGridY; y++) {
    ctx.strokeStyle = y % 5 === 0 ? colors.major : colors.fine;
    ctx.beginPath(); ctx.moveTo(minX, y * 24); ctx.lineTo(maxX, y * 24); ctx.stroke();
  }

  for (const wire of doc.wires) {
    const points = wirePath(wire, doc);
    if (points.length < 2) continue;
    const selectedWire = selection?.type === 'wire' && selection.id === wire.id;
    ctx.strokeStyle = selectedWire ? colors.yellow : colors.wire;
    ctx.lineWidth = selectedWire ? 5 : 3;
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    for (const p of [points[0], points[points.length - 1]]) {
      ctx.fillStyle = selectedWire ? colors.yellow : '#5ac2bc';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
  }

  for (const c of doc.components) {
    const isSelected = selection?.type === 'component' && selection.id === c.id;
    drawComponent(ctx, c, isSelected);
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected ? colors.yellow : colors.text;
    ctx.textAlign = 'center';
    const vertical = c.rotation % 180 !== 0;
    if (c.kind === 'resistor') {
      ctx.fillText(labelFor(c, doc.components), c.x + (vertical ? 58 : 0), c.y + (vertical ? -8 : -37));
      ctx.fillStyle = '#a5d9d1';
      ctx.font = '11px monospace';
      ctx.fillText(formatElectrical(c.value, 'Ω'), c.x + (vertical ? 58 : 0), c.y + (vertical ? 9 : 36));
    } else if (c.kind === 'voltage_source') {
      ctx.textAlign = 'left'; ctx.fillText(labelFor(c, doc.components), c.x + 28, c.y - 9);
      ctx.fillStyle = colors.yellow; ctx.fillText(formatElectrical(c.value, 'V'), c.x + 28, c.y + 10);
    } else {
      ctx.fillText('GND', c.x, c.y + 32);
    }
    for (const pin of pinsFor(c)) {
      const p = pinPosition(c, pin);
      const isPending = pending?.componentId === c.id && pending.pin === pin;
      ctx.fillStyle = isPending ? '#ffd476' : '#9cf3c4';
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      if (isPending) {
        ctx.strokeStyle = '#ffd476'; ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 10, p.y - 10, 20, 20);
      }
      if (simulation) {
        const root = simulation.terminalNodes[terminalKey({ componentId: c.id, pin })];
        if (root !== undefined) {
          ctx.fillStyle = '#9fd4ff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
          ctx.fillText(formatElectrical(simulation.nodeVoltages[root], 'V'), p.x, p.y - 16);
        }
      }
    }
  }

  if (pending && hover) {
    const c = doc.components.find(part => part.id === pending.componentId);
    if (c) {
      const start = pinPosition(c, pending.pin);
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = colors.yellow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      ctx.lineTo(hover.x, start.y); ctx.lineTo(hover.x, hover.y);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

export function CircuitCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const dragging = useRef<Drag | null>(null);
  const [view, setView] = useState<View>({ x: 60, y: 42, zoom: 1 });
  const [hover, setHover] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const doc = useCircuitStore(s => s.document);
  const selection = useCircuitStore(s => s.selection);
  const pendingPin = useCircuitStore(s => s.pendingPin);
  const simulation = useCircuitStore(s => s.simulation);
  const select = useCircuitStore(s => s.select);
  const move = useCircuitStore(s => s.moveComponent);
  const connect = useCircuitStore(s => s.startOrFinishWire);
  const add = useCircuitStore(s => s.addComponent);

  useEffect(() => {
    const el = wrapper.current, cvs = canvas.current;
    if (!el || !cvs) return;
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.round(width * dpr);
      cvs.height = Math.round(height * dpr);
      setSize({ width, height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el); resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (canvas.current) drawCanvas(canvas.current, doc, view, selection, pendingPin, hover, simulation);
  }, [doc, view, selection, pendingPin, hover, simulation, size]);

  const screenPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const worldPoint = (e: { clientX: number; clientY: number }) => {
    const p = screenPoint(e);
    return { x: (p.x - view.x) / view.zoom, y: (p.y - view.y) / view.zoom };
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    const p = worldPoint(e);
    if (e.button === 0) {
      for (const c of [...doc.components].reverse()) {
        for (const pin of pinsFor(c)) {
          const end = pinPosition(c, pin);
          if (Math.hypot(end.x - p.x, end.y - p.y) <= 11 / view.zoom) {
            connect({ componentId: c.id, pin }); return;
          }
        }
      }
      for (const c of [...doc.components].reverse()) {
        if (hitComponent(c, p)) {
          select({ type: 'component', id: c.id });
          dragging.current = { type: 'component', id: c.id, x: c.x, y: c.y, at: p };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
      for (const w of [...doc.wires].reverse()) {
        const points = wirePath(w, doc);
        if (points.some((point, i) => i > 0 && nearSegment(p, points[i - 1], point) < 8 / view.zoom)) {
          select({ type: 'wire', id: w.id }); return;
        }
      }
      select(null);
    }
    dragging.current = {
      type: 'pan', clientX: e.clientX, clientY: e.clientY,
      originalX: view.x, originalY: view.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = worldPoint(e);
    setHover(p);
    const d = dragging.current;
    if (!d) return;
    if (d.type === 'pan') {
      setView(v => ({ ...v, x: d.originalX + e.clientX - d.clientX, y: d.originalY + e.clientY - d.clientY }));
    } else {
      const newX = snap(d.x + p.x - d.at.x);
      const newY = snap(d.y + p.y - d.at.y);
      const current = useCircuitStore.getState().document.components.find(c => c.id === d.id);
      if (current && (current.x !== newX || current.y !== newY)) move(d.id, { x: newX, y: newY });
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    dragging.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = screenPoint(e);
    const nextZoom = Math.max(0.35, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setView({ zoom: nextZoom, x: p.x - (p.x - view.x) * nextZoom / view.zoom,
      y: p.y - (p.y - view.y) * nextZoom / view.zoom });
  };
  const onDrop = (e: DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('application/x-circuit-component') as ComponentKind;
    if (!['resistor', 'voltage_source', 'ground'].includes(kind)) return;
    add(kind, worldPoint(e));
  };

  return (
    <div className="canvas-wrapper" ref={wrapper}>
      <canvas
        ref={canvas} className="circuit-canvas" aria-label="Interactive circuit editor"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}
        onWheel={onWheel} onContextMenu={e => e.preventDefault()}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={onDrop}
      />
      <div className="canvas-hint">● CLICK PORTS TO WIRE <span>·</span> DRAG TO MOVE <span>·</span> SCROLL TO ZOOM</div>
      <div className="canvas-controls">
        <button title="Zoom out" onClick={() => setView(v => ({ ...v, zoom: Math.max(.35, v.zoom / 1.25) }))}>−</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button title="Zoom in" onClick={() => setView(v => ({ ...v, zoom: Math.min(2.5, v.zoom * 1.25) }))}>+</button>
        <button title="Reset view" onClick={() => setView({ x: 60, y: 42, zoom: 1 })}>⌖</button>
      </div>
      {pendingPin && <div className="wire-tip">SELECT DESTINATION PIN · ESC TO CANCEL</div>}
    </div>
  );
}
