import { DragEvent } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { ComponentKind, snap } from '../circuit/types';

const entries: { kind: ComponentKind; symbol: string; label: string; detail: string }[] = [
  { kind: 'resistor', symbol: '▤', label: 'RESISTOR', detail: '1 kΩ' },
  { kind: 'voltage_source', symbol: '⊕', label: 'DC SOURCE', detail: '5 V' },
  { kind: 'ground', symbol: '⏚', label: 'GROUND', detail: '0 V' },
];

export function Palette() {
  const addComponent = useCircuitStore(s => s.addComponent);
  const count = useCircuitStore(s => s.document.components.length);
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, kind: ComponentKind) => {
    event.dataTransfer.setData('application/x-circuit-component', kind);
    event.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <aside className="left-panel">
      <div className="panel-heading"><span className="heading-cube">▦</span> COMPONENTS <span className="tiny-muted">/ 03</span></div>
      <div className="sidebar-section-label">BASIC ANALOG</div>
      <div className="palette-list">
        {entries.map(entry => (
          <button
            className="palette-item" key={entry.kind} draggable
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
        ))}
      </div>
      <div className="sidebar-section-label sidebar-second">COMING SOON</div>
      <div className="future-item"><span>▥</span> CAPACITOR <em>v0.2</em></div>
      <div className="future-item"><span>∿</span> INDUCTOR <em>v0.2</em></div>
      <div className="future-item"><span>▷</span> DIODE / LED <em>v0.3</em></div>
      <div className="sidebar-bottom">
        <div className="tip-heading">✦ QUICK START</div>
        <p>Click to add components or drag them onto the grid. Connect the small green terminals with wires.</p>
        <p>Use <kbd>R</kbd> to rotate and <kbd>DEL</kbd> to remove selected parts.</p>
      </div>
    </aside>
  );
}
