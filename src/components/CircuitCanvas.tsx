import { DragEvent, PointerEvent, WheelEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import {
  CircuitComponent, CircuitDocument, ComponentKind, Point, Wire, WireEndpoint,
  pinPosition, pinsFor, snap, formatElectrical, labelFor, terminalKey, isTerminal,
} from '../circuit/types';
import { wirePath, endpointPosition } from '../circuit/geometry';

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

function nearestPointOnTrace(p: Point, path: Point[]): { point: Point; distance: number } {
  let best = { point: p, distance: Infinity };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const vertical = a.x === b.x;
    const point = vertical
      ? { x: a.x, y: Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), Math.round(p.y / 12) * 12)) }
      : { x: Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), Math.round(p.x / 12) * 12)), y: a.y };
    const distance = nearSegment(p, a, b);
    if (distance < best.distance) best = { point, distance };
  }
  return best;
}


function hitComponent(c: CircuitComponent, p: Point): boolean {
  const dx = p.x - c.x, dy = p.y - c.y;
  const radians = -c.rotation * Math.PI / 180;
  const x = dx * Math.cos(radians) - dy * Math.sin(radians);
  const y = dx * Math.sin(radians) + dy * Math.cos(radians);
  return c.kind === 'ground'
    ? Math.abs(x) < 25 && Math.abs(y) < 27
    : c.kind === 'voltage_source' || c.kind === 'current_source'
      ? Math.hypot(x, y) < 27
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
    : c.kind === 'current_source' ? '#88bfff'
    : c.kind === 'capacitor' ? '#ff88da' : c.kind === 'inductor' ? '#83e4ff' : '#ffda7d';
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
  } else if (c.kind === 'capacitor') {
    ctx.strokeStyle = '#66fff3'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-9, 0);
    ctx.moveTo(9, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.shadowColor = '#ff77d9'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffc2ef';
    ctx.fillRect(-12, -27, 6, 54); ctx.fillRect(6, -27, 6, 54);
    ctx.fillStyle = '#fff4ff';
    ctx.fillRect(-12, -27, 6, 5); ctx.fillRect(6, -27, 6, 5);
  } else if (c.kind === 'inductor') {
    ctx.strokeStyle = '#63f4ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-31, 0);
    ctx.moveTo(31, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.shadowBlur = 12; ctx.fillStyle = '#86bdff';
    for (const x of [-28, -14, 0, 14]) {
      ctx.fillRect(x, -16, 12, 6);
      ctx.fillRect(x - 2, -11, 6, 18);
      ctx.fillRect(x + 9, -11, 5, 18);
      ctx.fillRect(x, 3, 12, 6);
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
  pending: WireEndpoint | null,
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
    for (const [index, p] of [points[0], points[points.length - 1]].entries()) {
      const endpoint = index === 0 ? wire.from : wire.to;
      ctx.save();
      if (isTerminal(endpoint)) {
        ctx.fillStyle = selectedWire ? '#ffd0f2' : '#b2fff4';
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else {
        // Free wire ends stay visible even with no connected component.
        ctx.shadowColor = '#ff80dd'; ctx.shadowBlur = 15;
        ctx.strokeStyle = '#ff9eea'; ctx.lineWidth = 2.5;
        ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
        ctx.fillStyle = '#1a1035'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      }
      ctx.restore();
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
    if (c.kind === 'resistor' || c.kind === 'potentiometer' || c.kind === 'switch' ||
        c.kind === 'capacitor' || c.kind === 'inductor') {
      ctx.fillText(labelFor(c, doc.components), c.x + (vertical ? 58 : 0), c.y + (vertical ? -8 : -37));
      ctx.fillStyle = '#a5d9d1';
      ctx.font = '11px monospace';
      const detail = c.kind === 'switch' ? (c.closed ? '● CLOSED' : '○ OPEN')
        : c.kind === 'potentiometer'
          ? formatElectrical(c.value, 'Ω') + ' / ' + Math.round((c.wiper ?? .5) * 100) + '%'
          : formatElectrical(c.value, c.kind === 'capacitor' ? 'F' : c.kind === 'inductor' ? 'H' : 'Ω');
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
      const isPending = pending && isTerminal(pending) && pending.componentId === c.id && pending.pin === pin;
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
    const start = endpointPosition(pending, doc);
    if (start) {
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = colors.yellow; ctx.shadowColor = '#ffa5ed'; ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      ctx.lineTo(hover.x, start.y); ctx.lineTo(hover.x, hover.y);
      ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffc5ed'; ctx.strokeRect(hover.x - 5, hover.y - 5, 10, 10);
    }
  }
  ctx.restore();
}


type Menu = {
  x: number;
  y: number;
  world: Point;
  selection: { type: 'component' | 'wire'; id: string } | null;
  wirePoint: Point | null;
};
const HALF_GRID = 12;
const snapEnd = (p: Point): Point => ({
  x: Math.round(p.x / HALF_GRID) * HALF_GRID,
  y: Math.round(p.y / HALF_GRID) * HALF_GRID,
});

export function CircuitCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const dragging = useRef<Drag | null>(null);
  const [view, setView] = useState<View>({ x: 60, y: 42, zoom: 1 });
  const [hover, setHover] = useState<Point | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState<Menu | null>(null);
  const [quickValue, setQuickValue] = useState('');
  const doc = useCircuitStore(s => s.document);
  const selection = useCircuitStore(s => s.selection);
  const pendingPin = useCircuitStore(s => s.pendingPin);
  const simulation = useCircuitStore(s => s.simulation);
  const select = useCircuitStore(s => s.select);
  const move = useCircuitStore(s => s.moveComponent);
  const connect = useCircuitStore(s => s.startOrFinishWire);
  const beginWire = useCircuitStore(s => s.beginWire);
  const add = useCircuitStore(s => s.addComponent);
  const remove = useCircuitStore(s => s.removeSelection);
  const rotate = useCircuitStore(s => s.rotateComponent);
  const setValue = useCircuitStore(s => s.setComponentValue);
  const toggleSwitch = useCircuitStore(s => s.toggleSwitch);
  const setPotWiper = useCircuitStore(s => s.setPotWiper);
  const simulate = useCircuitStore(s => s.simulate);
  const simulateTransient = useCircuitStore(s => s.simulateTransient);
  const cancelWire = useCircuitStore(s => s.cancelWire);

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
  const findTerminal = (p: Point): WireEndpoint | null => {
    for (const c of [...doc.components].reverse()) {
      for (const pin of pinsFor(c)) {
        const end = pinPosition(c, pin);
        if (Math.hypot(end.x - p.x, end.y - p.y) <= 11 / view.zoom) {
          return { componentId: c.id, pin };
        }
      }
    }
    return null;
  };
  const findWire = (p: Point): { wire: Wire; point: Point; distance: number } | null => {
    let closest: { wire: Wire; point: Point; distance: number } | null = null;
    for (const wire of [...doc.wires].reverse()) {
      const result = nearestPointOnTrace(p, wirePath(wire, doc));
      if (result.distance < 10 / view.zoom && (!closest || result.distance < closest.distance)) {
        closest = { wire, ...result };
      }
    }
    return closest;
  };
  const nearestFreeTip = (p: Point): WireEndpoint | null => {
    for (const w of [...doc.wires].reverse()) {
      for (const endpoint of [w.from, w.to]) {
        if (!isTerminal(endpoint) &&
          Math.hypot(endpoint.x - p.x, endpoint.y - p.y) <= 10 / view.zoom) return endpoint;
      }
    }
    return null;
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || (e.button !== 0 && e.button !== 1)) return;
    e.preventDefault();
    setMenu(null);
    const p = worldPoint(e);
    if (e.button === 0) {
      const terminal = findTerminal(p);
      if (terminal) { connect(terminal); return; }
      const tip = nearestFreeTip(p);
      if (tip) { connect(tip); return; }
      if (pendingPin) {
        // A free endpoint can be left anywhere on the workbench, or exactly
        // on an existing wire to create an electrically connected junction.
        const trace = findWire(p);
        connect(trace ? trace.point : snapEnd(p));
        return;
      }
      for (const c of [...doc.components].reverse()) {
        if (hitComponent(c, p)) {
          select({ type: 'component', id: c.id });
          dragging.current = { type: 'component', id: c.id, x: c.x, y: c.y, at: p };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
      const trace = findWire(p);
      if (trace) { select({ type: 'wire', id: trace.wire.id }); return; }
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
    setHover(snapEnd(p));
    const d = dragging.current;
    if (!d) return;
    if (d.type === 'pan') {
      setView(v => ({
        ...v, x: d.originalX + e.clientX - d.clientX,
        y: d.originalY + e.clientY - d.clientY,
      }));
    } else {
      const newX = snap(d.x + p.x - d.at.x);
      const newY = snap(d.y + p.y - d.at.y);
      const current = useCircuitStore.getState().document.components.find(c => c.id === d.id);
      if (current && (current.x !== newX || current.y !== newY)) move(d.id, { x: newX, y: newY });
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    dragging.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = screenPoint(e);
    const zoom = Math.max(.35, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setView({ zoom, x: p.x - (p.x - view.x) * zoom / view.zoom,
      y: p.y - (p.y - view.y) * zoom / view.zoom });
  };
  const onDoubleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const p = worldPoint(e);
    const switched = [...doc.components].reverse().find(c =>
      c.kind === 'switch' && hitComponent(c, p));
    if (switched) toggleSwitch(switched.id);
  };
  const onDrop = (e: DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('application/x-circuit-component') as ComponentKind;
    const allowed: ComponentKind[] = ['resistor', 'voltage_source', 'ground',
      'switch', 'current_source', 'potentiometer', 'capacitor', 'inductor'];
    if (!allowed.includes(kind)) return;
    add(kind, worldPoint(e));
  };
  const onContextMenu = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const at = worldPoint(e);
    const screen = screenPoint(e);
    let target: Menu['selection'] = null;
    let wirePoint: Point | null = null;
    const hit = [...doc.components].reverse().find(c => hitComponent(c, at));
    if (hit) {
      target = { type: 'component', id: hit.id };
      setQuickValue(String(hit.value));
    } else {
      const trace = findWire(at);
      if (trace) {
        target = { type: 'wire', id: trace.wire.id };
        wirePoint = trace.point;
      }
    }
    select(target);
    const bound = wrapper.current!.getBoundingClientRect();
    setMenu({
      x: Math.max(8, Math.min(bound.width - 244, screen.x)),
      y: Math.max(8, Math.min(bound.height - 370, screen.y)),
      world: snapEnd(at), selection: target, wirePoint,
    });
  };

  const menuPart = menu?.selection?.type === 'component'
    ? doc.components.find(c => c.id === menu.selection?.id) : undefined;
  const commitQuickValue = () => {
    if (!menuPart) return;
    const parsed = Number(quickValue);
    if (quickValue.trim() && Number.isFinite(parsed)) setValue(menuPart.id, parsed);
  };
  const menuAction = (action: () => void) => () => { action(); setMenu(null); };
  const usePin = (pin: 'a' | 'b' | 'w') => {
    if (menuPart) beginWire({ componentId: menuPart.id, pin });
    setMenu(null);
  };

  return (
    <div className="canvas-wrapper" ref={wrapper}>
      <canvas
        ref={canvas} className="circuit-canvas" aria-label="Interactive circuit editor"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick} onWheel={onWheel} onContextMenu={onContextMenu}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={onDrop}
      />
      <div className="canvas-hint">
        ◈ CLICK PIN → EMPTY GRID FOR FREE WIRES <span>·</span>
        RIGHT-CLICK FOR ACTIONS <span>·</span> DRAG PARTS TO CONNECT
      </div>
      <div className="canvas-controls">
        <button title="Zoom out" onClick={() => setView(v => ({ ...v, zoom: Math.max(.35, v.zoom / 1.25) }))}>−</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button title="Zoom in" onClick={() => setView(v => ({ ...v, zoom: Math.min(2.5, v.zoom * 1.25) }))}>+</button>
        <button title="Reset view" onClick={() => setView({ x: 60, y: 42, zoom: 1 })}>⌖</button>
      </div>
      {pendingPin && <div className="wire-tip">CLICK TO PLACE FREE END · ESC FINISHES WIRE</div>}
      {menu && <>
        <div className="context-backdrop" onPointerDown={() => setMenu(null)} />
        <div className="arcade-context" role="menu" aria-label="Circuit context menu"
          style={{ left: menu.x, top: menu.y }}>
          <div className="context-title">
            <span>✦ QUICK ACTIONS</span>
            <button aria-label="Close context menu" onClick={() => setMenu(null)}>×</button>
          </div>
          {menuPart ? <>
            <div className="context-target">{labelFor(menuPart, doc.components)} · {menuPart.kind.replace('_', ' ').toUpperCase()}</div>
            {menuPart.kind !== 'ground' && menuPart.kind !== 'switch' && <>
              <label className="context-field-label" htmlFor="quick-value">
                {menuPart.kind === 'resistor' || menuPart.kind === 'potentiometer' ? 'OHMS'
                  : menuPart.kind === 'capacitor' ? 'FARADS'
                    : menuPart.kind === 'inductor' ? 'HENRYS'
                      : menuPart.kind === 'current_source' ? 'AMPS' : 'VOLTS'}
              </label>
              <div className="context-value-row">
                <input id="quick-value" type="number" step="any" value={quickValue}
                  onChange={e => setQuickValue(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { commitQuickValue(); setMenu(null); }
                  }}
                  onBlur={commitQuickValue}
                />
                <button onClick={menuAction(commitQuickValue)}>SET</button>
              </div>
            </>}
            {menuPart.kind === 'switch' && <button className="context-option highlight"
              onClick={menuAction(() => toggleSwitch(menuPart.id))}>
              ↯ {menuPart.closed ? 'OPEN SWITCH' : 'CLOSE SWITCH'}
            </button>}
            {menuPart.kind === 'potentiometer' && <div className="context-slider">
              <label>WIPER · {Math.round((menuPart.wiper ?? .5) * 100)}%</label>
              <input type="range" min="1" max="99"
                value={Math.round((menuPart.wiper ?? .5) * 100)}
                onChange={e => setPotWiper(menuPart.id, Number(e.target.value) / 100)} />
            </div>}
            {menuPart.kind !== 'ground' && <>
              <button className="context-option" onClick={menuAction(() => rotate(menuPart.id))}>↻ ROTATE 90°</button>
              <button className="context-option" onClick={() => usePin('a')}>⌁ WIRE FROM PIN A</button>
              <button className="context-option" onClick={() => usePin('b')}>⌁ WIRE FROM PIN B</button>
              {menuPart.kind === 'potentiometer' &&
                <button className="context-option" onClick={() => usePin('w')}>⌁ WIRE FROM WIPER</button>}
            </>}
            {menuPart.kind === 'ground' &&
              <button className="context-option" onClick={() => {
                beginWire({ componentId: menuPart.id, pin: 'g' }); setMenu(null);
              }}>⌁ WIRE FROM GROUND</button>}
            <button className="context-option danger" onClick={menuAction(remove)}>× DELETE COMPONENT</button>
          </> : menu.selection?.type === 'wire' ? <>
            <div className="context-target">NEON WIRE · CONNECTION</div>
            <button className="context-option highlight"
              onClick={menuAction(() => beginWire(menu.wirePoint ?? menu.world))}>⌁ START BRANCH HERE</button>
            <button className="context-option danger" onClick={menuAction(remove)}>× DELETE WIRE</button>
          </> : <>
            <div className="context-target">GRID · {Math.round(menu.world.x)}, {Math.round(menu.world.y)}</div>
            <button className="context-option highlight"
              onClick={menuAction(() => beginWire(menu.world))}>⌁ START FREE WIRE HERE</button>
            <div className="context-section-label">PLACE COMPONENT</div>
            <div className="context-parts">
              {([
                ['resistor', '▤ RESISTOR'], ['voltage_source', '⊕ VOLTAGE'],
                ['current_source', '↓ CURRENT'], ['ground', '⏚ GROUND'],
                ['switch', '╱ SWITCH'], ['potentiometer', '◩ POT'],
                ['capacitor', '▥ CAPACITOR'], ['inductor', '∿ INDUCTOR'],
              ] as [ComponentKind, string][]).map(([kind, label]) =>
                <button key={kind} onClick={menuAction(() => add(kind, menu.world))}>{label}</button>
              )}
            </div>
          </>}
          <div className="context-divider" />
          <button className="context-option" onClick={menuAction(simulate)}>▶ RUN DC</button>
          <button className="context-option" onClick={menuAction(simulateTransient)}>▶ RUN TRANSIENT</button>
          {pendingPin &&
            <button className="context-option" onClick={menuAction(cancelWire)}>■ FINISH WIRE</button>}
        </div>
      </>}
    </div>
  );
}
