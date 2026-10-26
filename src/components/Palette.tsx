import { DragEvent } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { ComponentKind, snap } from '../circuit/types';
import {
  switchCircuit, currentSourceCircuit, potentiometerCircuit, starterCircuit,
} from '../circuit/sample';

type Entry = { kind: ComponentKind; symbol: string; label: string; detail: string; tone: string };
const essentials: Entry[] = [
  { kind: 'resistor', symbol: '▤', label: 'RESISTOR', detail: '1 kΩ · R', tone: 'amber' },
  { kind: 'voltage_source', symbol: '⊕', label: 'DC VOLTAGE', detail: '5 V · V', tone: 'gold' },
  { kind: 'ground', symbol: '⏚', label: 'GROUND', detail: '0 V reference', tone: 'mint' },
];
const expanded: Entry[] = [
  { kind: 'switch', symbol: '╱', label: 'SPST SWITCH', detail: 'Click to toggle', tone: 'pink' },
  { kind: 'current_source', symbol: '↓', label: 'DC CURRENT', detail: '5 mA · I', tone: 'blue' },
  { kind: 'potentiometer', symbol: '◩', label: 'POTENTIOMETER', detail: '1 kΩ · 50%', tone: 'purple' },
];

export function Palette() {
  const addComponent = useCircuitStore(s => s.addComponent);
  const loadDocument = useCircuitStore(s => s.loadDocument);
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
      title={'Click to place or drag to canvas: ' + entry.label}
    >
      <span className="palette-icon">{entry.symbol}</span>
      <span className="palette-text"><strong>{entry.label}</strong><small>{entry.detail}</small></span>
      <span className="palette-plus">+</span>
    </button>
  );

  return (
    <aside className="left-panel neon-panel">
      <div className="panel-heading"><span className="heading-cube">▦</span> PARTS LIBRARY
        <span className="tiny-muted">/ 06</span>
      </div>
      <div className="sidebar-section-label">01 / CORE COMPONENTS</div>
      <div className="palette-list">{essentials.map(renderEntry)}</div>
      <div className="sidebar-section-label sidebar-second">02 / NEW IN v0.2 <span className="new-marker">NEW!</span></div>
      <div className="palette-list">{expanded.map(renderEntry)}</div>

      <div className="lab-presets">
        <div className="sidebar-section-label">03 / INSTANT LABS</div>
        <button onClick={() => loadDocument(starterCircuit())}><span>◇</span> VOLTAGE DIVIDER</button>
        <button onClick={() => loadDocument(switchCircuit())}><span>↯</span> SWITCH CONTROL</button>
        <button onClick={() => loadDocument(currentSourceCircuit())}><span>⇣</span> CURRENT SOURCE</button>
        <button onClick={() => loadDocument(potentiometerCircuit())}><span>◈</span> POTENTIOMETER</button>
      </div>
      <div className="sidebar-bottom">
        <div className="tip-heading">✦ FIELD NOTES</div>
        <p>Click glowing terminals to wire. Double-click a switch to flip it.
          Select a pot to adjust its wiper.</p>
      </div>
    </aside>
  );
}
