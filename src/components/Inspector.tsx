import { useEffect, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { formatElectrical, labelFor } from '../circuit/types';

export function Inspector() {
  const doc = useCircuitStore(s => s.document);
  const selected = useCircuitStore(s => s.selection);
  const simulation = useCircuitStore(s => s.simulation);
  const rotate = useCircuitStore(s => s.rotateComponent);
  const setValue = useCircuitStore(s => s.setComponentValue);
  const remove = useCircuitStore(s => s.removeSelection);
  const c = selected?.type === 'component' ? doc.components.find(item => item.id === selected.id) : undefined;
  const wire = selected?.type === 'wire' ? doc.wires.find(item => item.id === selected.id) : undefined;
  const reading = c ? simulation?.readings[c.id] : undefined;
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(c ? String(c.value) : ''); }, [c?.id, c?.value]);

  return (
    <div className="panel section-inspector">
      <div className="panel-heading">◈ INSPECTOR <span className="tiny-muted">/ PROPERTIES</span></div>
      {c ? (
        <div className="panel-content inspector-content">
          <div className="selected-heading"><span className="selected-symbol">{c.kind === 'resistor' ? '▤' : c.kind === 'ground' ? '⏚' : '⊕'}</span>
            <div><strong>{labelFor(c, doc.components)}</strong><small>{c.kind.replace('_', ' ').toUpperCase()}</small></div>
          </div>
          {c.kind !== 'ground' && <>
            <label className="field-label" htmlFor="component-value">{c.kind === 'resistor' ? 'RESISTANCE (Ω)' : 'VOLTAGE (V)'}</label>
            <input
              id="component-value" className="input" type="number" step="any"
              value={draft} onChange={e => {
                setDraft(e.target.value);
                const num = Number(e.target.value);
                if (e.target.value.trim() && Number.isFinite(num)) setValue(c.id, num);
              }}
            />
            <div className="field-note">{c.kind === 'resistor' ? 'Enter ohms (e.g. 1000 = 1 kΩ)' : 'Pin A is positive relative to pin B'}</div>
          </>}
          <div className="info-pair"><span>POSITION</span><b>{c.x}, {c.y}</b></div>
          <div className="info-pair"><span>ROTATION</span><b>{c.rotation}°</b></div>
          <div className="button-row">
            {c.kind !== 'ground' && <button className="small-action" onClick={() => rotate(c.id)}>↻ ROTATE 90°</button>}
            <button className="small-action danger-action" onClick={remove}>✕ DELETE</button>
          </div>
          {reading && <div className="readings">
            <div className="sidebar-section-label">DC READINGS</div>
            <div className="readout"><span>VOLTAGE A→B</span><strong>{formatElectrical(reading.voltage, 'V')}</strong></div>
            <div className="readout"><span>CURRENT A→B</span><strong>{formatElectrical(reading.current, 'A')}</strong></div>
            <div className="readout"><span>POWER</span><strong>{formatElectrical(reading.power, 'W')}</strong></div>
          </div>}
        </div>
      ) : wire ? (
        <div className="panel-content inspector-content">
          <div className="selected-heading"><span className="selected-symbol">⌁</span><div><strong>WIRE</strong><small>CONNECTION</small></div></div>
          <div className="info-pair"><span>FROM</span><b>{wire.from.componentId} : {wire.from.pin}</b></div>
          <div className="info-pair"><span>TO</span><b>{wire.to.componentId} : {wire.to.pin}</b></div>
          <button className="small-action danger-action" onClick={remove}>✕ DELETE WIRE</button>
        </div>
      ) : (
        <div className="inspector-empty">
          <span className="empty-glyph">⌖</span>
          <strong>NOTHING SELECTED</strong>
          <p>Click a component or a wire to inspect and edit it.</p>
        </div>
      )}
    </div>
  );
}

export function SimulationPanel() {
  const simulate = useCircuitStore(s => s.simulate);
  const result = useCircuitStore(s => s.simulation);
  const document = useCircuitStore(s => s.document);
  const message = useCircuitStore(s => s.message);
  return (
    <div className="panel simulation-panel">
      <div className="panel-heading">◉ DC SIMULATION <span className="tiny-muted">/ MNA</span></div>
      <div className="panel-content">
        <div className="status-line"><span className={'status-dot ' + (result ? 'success' : '')}></span>
          {result ? 'RESULTS READY' : 'AWAITING ANALYSIS'}</div>
        <button className="run-button" onClick={simulate}><span>▶</span> RUN DC ANALYSIS</button>
        <div className={'simulation-message ' + (result ? 'message-success' : '')} role="status">{message}</div>
        <div className="stats-row">
          <div><b>{document.components.length}</b><span>PARTS</span></div>
          <div><b>{document.wires.length}</b><span>WIRES</span></div>
          <div><b>{result?.nodeCount ?? '—'}</b><span>NODES</span></div>
        </div>
        {result && <div className="results-scroll">
          <div className="sidebar-section-label">BRANCH CURRENTS</div>
          {document.components.filter(c => c.kind !== 'ground').map(c => (
            <div className="result-line" key={c.id}>
              <span>{labelFor(c, document.components)}</span>
              <strong>{formatElectrical(result.readings[c.id]?.current ?? 0, 'A')}</strong>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}
