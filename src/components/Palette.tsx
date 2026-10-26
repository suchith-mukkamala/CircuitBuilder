import { DragEvent } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { ComponentKind, snap } from '../circuit/types';
import {
  switchCircuit, currentSourceCircuit, potentiometerCircuit, starterCircuit, rcCircuit, rlCircuit,
} from '../circuit/sample';

type Entry = { kind: ComponentKind; symbol: string; label: string; detail: string; tone: string };
const essentials: Entry[] = [
  { kind: 'resistor', symbol: '▤', label: 'RESISTOR', detail: '1 kΩ · R', tone: 'amber' },
  { kind: 'voltage_source', symbol: '⊕', label: 'DC VOLTAGE', detail: '5 V · V', tone: 'gold' },
  { kind: 'ground', symbol: '⏚', label: 'GROUND', detail: '0 V reference', tone: 'mint' },
];
const controls: Entry[] = [
  { kind: 'switch', symbol: '╱', label: 'SPST SWITCH', detail: 'Click to toggle', tone: 'pink' },
  { kind: 'current_source', symbol: '↓', label: 'DC CURRENT', detail: '5 mA · I', tone: 'blue' },
  { kind: 'potentiometer', symbol: '◩', label: 'POTENTIOMETER', detail: '1 kΩ · 50%', tone: 'purple' },
];
const reactive: Entry[] = [
  { kind: 'capacitor', symbol: '▥', label: 'CAPACITOR', detail: '100 µF · C', tone: 'pink' },
  { kind: 'inductor', symbol: '∿', label: 'INDUCTOR', detail: '100 mH · L', tone: 'blue' },
];

export function Palette() {
  const addComponent = useCircuitStore(s => s.addComponent);
  const loadDocument = useCircuitStore(s => s.loadDocument);
  const setTransientDuration = useCircuitStore(s => s.setTransientDuration);
  const count = useCircuitStore(s => s.document.components.length);
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, kind: ComponentKind) => {
    event.dataTransfer.setData('application/x-circuit-component', kind);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const renderEntry = (entry: Entry) => (
    <button
      className={'palette-item accent-' + entry.tone} key={entry.kind} draggable
      onDragStart={e => handleDragStart(e, entry.kind)}
      onClick={() => {
        const offset = count % 6;
        addComponent(entry.kind, { x: snap(216 + 72 * offset), y: snap(216 + 48 * offset) });
      }}
      title={'Click or drag onto the canvas: ' + entry.label}
    >
      <span className="palette-icon">{entry.symbol}</span>
      <span className="palette-text"><strong>{entry.label}</strong><small>{entry.detail}</small></span>
      <span className="palette-plus">+</span>
    </button>
  );
  const selectLab = (doc: ReturnType<typeof starterCircuit>, duration?: number) => {
    loadDocument(doc);
    if (duration) setTransientDuration(duration);
  };
  return (
    <aside className="left-panel neon-panel">
      <div className="panel-heading"><span className="heading-cube">▦</span> PARTS LIBRARY
        <span className="tiny-muted">/ 08</span>
      </div>
      <div className="sidebar-section-label">01 / BASIC COMPONENTS</div>
      <div className="palette-list">{essentials.map(renderEntry)}</div>
      <div className="sidebar-section-label sidebar-second">02 / ANALOG CONTROLS</div>
      <div className="palette-list">{controls.map(renderEntry)}</div>
      <div className="sidebar-section-label sidebar-second">03 / ENERGY STORAGE <span className="new-marker">NEW!</span></div>
      <div className="palette-list">{reactive.map(renderEntry)}</div>
      <div className="lab-presets">
        <div className="sidebar-section-label">04 / INSTANT LABS</div>
        <button onClick={() => selectLab(starterCircuit())}><span>◇</span> VOLTAGE DIVIDER</button>
        <button onClick={() => selectLab(switchCircuit())}><span>↯</span> SWITCH CONTROL</button>
        <button onClick={() => selectLab(currentSourceCircuit())}><span>⇣</span> CURRENT SOURCE</button>
        <button onClick={() => selectLab(potentiometerCircuit())}><span>◈</span> POTENTIOMETER</button>
        <button onClick={() => selectLab(rcCircuit(), .5)}><span>▥</span> RC CHARGING (0.5 s)</button>
        <button onClick={() => selectLab(rlCircuit(), .012)}><span>∿</span> RL RESPONSE (12 ms)</button>
      </div>
      <div className="sidebar-bottom">
        <div className="tip-heading">✦ LAB NOTES</div>
        <p>Click a pin then empty space to leave a free wire end.
          Later, drag any matching terminal onto it.</p>
        <p>Right-click anything for quick controls. Open an RC or RL lab to scrub through time.</p>
      </div>
    </aside>
  );
}
