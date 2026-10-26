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
  bg: '#080e1c', fine: '#18233c', major: '#29365d',
  wire: '#4bffef', text: '#eaf7ff', yellow: '#ffe17d', green: '#83ffa4',
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
  const accent = c.kind === 'resistor' ? '#ffad79'
    : c.kind === 'switch' ? (c.closed ? '#9cffbd' : '#f8a5ff')
    : c.kind === 'potentiometer' ? '#d9a5ff'
    : c.kind === 'current_source' ? '#88bfff' : '#ffda7d';
  const glow = selected ? 23 : 11;
  ctx.shadowColor = accent;
  ctx.shadowBlur = glow;
  if (selected) {
    ctx.strokeStyle = '#cba7ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(-41, -36, 82, 72);
    ctx.setLineDash([]);
  }

  // All shapes deliberately use pixel-step rectangles and straight edges.
  const resistorBody = (pot: boolean) => {
    ctx.strokeStyle = '#8befff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-26, 0);
    ctx.moveTo(26, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.fillStyle = '#090e21';
    ctx.fillRect(-29, -16, 58, 32);
    ctx.fillStyle = pot ? '#70468d' : '#9a535f';
    ctx.fillRect(-26, -13, 52, 26);
    ctx.fillStyle = '#ffc87c';
    ctx.fillRect(-22, -9, 44, 18);
    for (const [x, col] of [
      [-17, '#ed6dbd'], [-5, '#744ce9'], [7, '#4bffef'], [19, '#f5b569'],
    ] as const) {
      ctx.fillStyle = col; ctx.fillRect(x, -13, 5, 26);
    }
    ctx.strokeStyle = pot ? '#d5a6ff' : '#ffc07f';
    ctx.lineWidth = 3;
    ctx.strokeRect(-27, -14, 54, 28);
  };

  if (c.kind === 'resistor' || c.kind === 'potentiometer') {
    resistorBody(c.kind === 'potentiometer');
    if (c.kind === 'potentiometer') {
      ctx.strokeStyle = '#e2afff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(0, 48);
      ctx.moveTo(-9, 27); ctx.lineTo(0, 17); ctx.lineTo(9, 27); ctx.stroke();
      ctx.fillStyle = '#f9dbff'; ctx.fillRect(-4, 34, 8, 8);
    }
  } else if (c.kind === 'switch') {
    ctx.strokeStyle = '#4bffef'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-24, 0);
    ctx.moveTo(24, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.fillStyle = '#1e3250';
    ctx.fillRect(-31, -10, 14, 20); ctx.fillRect(17, -10, 14, 20);
    ctx.fillStyle = '#ffdc86'; ctx.fillRect(-27, -6, 7, 12); ctx.fillRect(20, -6, 7, 12);
    ctx.strokeStyle = c.closed ? '#8bffb9' : '#f2a7ff';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-22, 0);
    ctx.lineTo(c.closed ? 22 : 15, c.closed ? 0 : -23);
    ctx.stroke();
    ctx.fillStyle = c.closed ? '#80ffa6' : '#f6a4ff';
    ctx.fillRect(-28, -4, 8, 8);
  } else if (c.kind === 'voltage_source' || c.kind === 'current_source') {
    ctx.strokeStyle = '#9aeeff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -22);
    ctx.moveTo(0, 22); ctx.lineTo(0, 48); ctx.stroke();
    // Pixelated octagonal instrument casing, not an anti-aliased circle.
    ctx.fillStyle = '#050c20'; ctx.fillRect(-17, -22, 34, 44);
    ctx.fillRect(-22, -17, 44, 34);
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    ctx.strokeRect(-17, -21, 34, 42);
    ctx.beginPath();
    ctx.moveTo(-22, -15); ctx.lineTo(-22, 15); ctx.moveTo(22, -15); ctx.lineTo(22, 15);
    ctx.stroke();
    ctx.strokeStyle = c.kind === 'current_source' ? '#94cbff' : '#ffe096';
    ctx.lineWidth = 3;
    if (c.kind === 'voltage_source') {
      ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(8, -9);
      ctx.moveTo(0, -16); ctx.lineTo(0, -2);
      ctx.moveTo(-8, 10); ctx.lineTo(8, 10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 11);
      ctx.moveTo(-9, 2); ctx.lineTo(0, 12); ctx.lineTo(9, 2); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = '#81ffb8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -6);
    ctx.moveTo(-22, -6); ctx.lineTo(22, -6);
    ctx.moveTo(-14, 2); ctx.lineTo(14, 2);
    ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.stroke();
  }
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement, doc: CircuitDocument, view: View,
  selection: { type: 'component' | 'wire'; id: string } | null,
  pending: { componentId: string; pin: 'a' | 'b' | 'g' | 'w' } | null,
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
  // Subtle neon stage light behind the central drawing area.
  const wash = ctx.createRadialGradient(width * .55, height * .48, 0, width * .55, height * .48, Math.max(width, height) * .8);
  wash.addColorStop(0, '#141632'); wash.addColorStop(1, 'rgba(8,14,28,0)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
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
    ctx.save();
    ctx.strokeStyle = selectedWire ? '#ff88e8' : colors.wire;
    ctx.shadowColor = selectedWire ? '#ff78e1' : '#2eeadc';
    ctx.shadowBlur = selectedWire ? 24 : (simulation ? 20 : 12);
    ctx.lineWidth = selectedWire ? 5 : 3;
    ctx.lineJoin = 'bevel';
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.lineWidth = 1;
    ctx.strokeStyle = selectedWire ? '#fff0fc' : '#d0fffb';
    ctx.stroke();
    ctx.restore();
    for (const p of [points[0], points[points.length - 1]]) {
      ctx.fillStyle = selectedWire ? '#ffd0f2' : '#b2fff4';
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
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
    if (c.kind === 'resistor' || c.kind === 'potentiometer' || c.kind === 'switch') {
      ctx.fillText(labelFor(c, doc.components), c.x + (vertical ? 58 : 0), c.y + (vertical ? -8 : -37));
      ctx.fillStyle = '#a5d9d1';
      ctx.font = '11px monospace';
      const detail = c.kind === 'switch' ? (c.closed ? '● CLOSED' : '○ OPEN')
        : c.kind === 'potentiometer'
          ? formatElectrical(c.value, 'Ω') + ' / ' + Math.round((c.wiper ?? .5) * 100) + '%'
          : formatElectrical(c.value, 'Ω');
      ctx.fillStyle = c.kind === 'switch' ? (c.closed ? '#82ffb5' : '#e9a1ff') : '#b4d1ff';
      ctx.fillText(detail, c.x + (vertical ? 61 : 0), c.y + (vertical ? 9 : 36));
    } else if (c.kind === 'voltage_source' || c.kind === 'current_source') {
      ctx.textAlign = 'left'; ctx.fillText(labelFor(c, doc.components), c.x + 28, c.y - 9);
      ctx.fillStyle = colors.yellow;
      ctx.fillText(formatElectrical(c.value, c.kind === 'current_source' ? 'A' : 'V'), c.x + 28, c.y + 10);
    } else {
      ctx.fillText('GND', c.x, c.y + 32);
    }
    for (const pin of pinsFor(c)) {
      const p = pinPosition(c, pin);
      const isPending = pending?.componentId === c.id && pending.pin === pin;
      ctx.save();
      ctx.shadowColor = isPending ? '#ff8be9' : '#4bffef';
      ctx.shadowBlur = isPending ? 22 : 14;
      ctx.fillStyle = isPending ? '#ffb5ed' : '#9affee';
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
      ctx.restore();
      if (isPending) {
        ctx.strokeStyle = '#ffd476'; ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 10, p.y - 10, 20, 20);
      }
      if (simulation) {
        const root = simulation.terminalNodes[terminalKey({ componentId: c.id, pin })];
        if (root !== undefined) {
          ctx.fillStyle = '#ffe994'; ctx.shadowColor = '#e9ab47'; ctx.shadowBlur = 7;
          ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
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
  const toggleSwitch = useCircuitStore(s => s.toggleSwitch);

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
  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = worldPoint(e);
    const selectedSwitch = [...doc.components].reverse().find(c => c.kind === 'switch' && hitComponent(c, point));
    if (selectedSwitch) toggleSwitch(selectedSwitch.id);
  };
  const onDrop = (e: DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('application/x-circuit-component') as ComponentKind;
    if (!['resistor', 'voltage_source', 'ground', 'switch', 'current_source', 'potentiometer'].includes(kind)) return;
    add(kind, worldPoint(e));
  };

  return (
    <div className="canvas-wrapper" ref={wrapper}>
      <canvas
        ref={canvas} className="circuit-canvas" aria-label="Interactive circuit editor"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel} onContextMenu={e => e.preventDefault()}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={onDrop}
      />
      <div className="canvas-hint">◈ CLICK PORTS TO WIRE <span>·</span> DOUBLE-CLICK SWITCH TO TOGGLE <span>·</span> SCROLL TO ZOOM</div>
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
