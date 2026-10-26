import { useEffect, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { formatElectrical, labelFor } from '../circuit/types';

const symbols = {
  resistor: '▤', ground: '⏚', voltage_source: '⊕',
  switch: '╱', current_source: '↓', potentiometer: '◩',
};

export function Inspector() {
  const doc = useCircuitStore(s => s.document);
  const selected = useCircuitStore(s => s.selection);
  const simulation = useCircuitStore(s => s.simulation);
  const rotate = useCircuitStore(s => s.rotateComponent);
  const setValue = useCircuitStore(s => s.setComponentValue);
  const setPotWiper = useCircuitStore(s => s.setPotWiper);
  const toggleSwitch = useCircuitStore(s => s.toggleSwitch);
  const remove = useCircuitStore(s => s.removeSelection);
  const c = selected?.type === 'component' ? doc.components.find(item => item.id === selected.id) : undefined;
  const wire = selected?.type === 'wire' ? doc.wires.find(item => item.id === selected.id) : undefined;
  const reading = c ? simulation?.readings[c.id] : undefined;
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(c ? String(c.value) : ''); }, [c?.id, c?.value]);
  const isSource = c?.kind === 'voltage_source' || c?.kind === 'current_source';
  const isResistive = c?.kind === 'resistor' || c?.kind === 'potentiometer';
  const hasValue = isSource || isResistive;

  return (
    <div className="panel section-inspector neon-panel">
      <div className="panel-heading">◈ COMPONENT LAB <span className="tiny-muted">/ INSPECT</span></div>
      {c ? (
        <div className="panel-content inspector-content">
          <div className="selected-heading">
            <span className={'selected-symbol accent-' + c.kind}>{symbols[c.kind]}</span>
            <div><strong>{labelFor(c, doc.components)}</strong><small>{c.kind.replace('_', ' ').toUpperCase()}</small></div>
          </div>
          {hasValue && <>
            <label className="field-label" htmlFor="component-value">
              {isResistive ? 'RESISTANCE (OHMS)' : c.kind === 'current_source' ? 'CURRENT (AMPS)' : 'VOLTAGE (VOLTS)'}
            </label>
            <input
              id="component-value" className="input" type="number" step="any"
              value={draft} onChange={e => {
                setDraft(e.target.value);
                const num = Number(e.target.value);
                if (e.target.value.trim() && Number.isFinite(num)) setValue(c.id, num);
              }}
            />
            <div className="field-note">{isResistive
              ? 'Enter ohms (1000 = 1 kΩ)'
              : c.kind === 'current_source'
                ? 'Positive current flows from A to B (0.005 = 5 mA)'
                : 'Positive voltage is A relative to B'}</div>
          </>}
          {c.kind === 'switch' && (
            <div className="switch-section">
              <div className="field-label">MECHANICAL STATE</div>
              <button aria-pressed={!!c.closed}
                className={'switch-toggle ' + (c.closed ? 'is-closed' : 'is-open')}
                onClick={() => toggleSwitch(c.id)}>
                <span className="switch-led" />
                <strong>{c.closed ? '● CONTACT CLOSED' : '○ CONTACT OPEN'}</strong>
                <span>↯</span>
              </button>
              <div className="field-note">Open: disconnected · Closed: ideal wire. Double-click the switch on the grid, or press Space.</div>
            </div>
          )}
          {c.kind === 'potentiometer' && (
            <div className="wiper-section">
              <div className="wiper-heading">
                <label className="field-label" htmlFor="pot-wiper">WIPER POSITION</label>
                <strong>{Math.round((c.wiper ?? 0.5) * 100)}%</strong>
              </div>
              <input
                id="pot-wiper" aria-label="Potentiometer wiper position"
                type="range" min="1" max="99" step="1"
                value={Math.round((c.wiper ?? 0.5) * 100)}
                onChange={e => setPotWiper(c.id, Number(e.target.value) / 100)}
              />
              <div className="wiper-labels"><span>A</span><span>WIPER</span><span>B</span></div>
              <div className="field-note">Three terminals: A, B and W (wiper). The resistance from A to W is total resistance × wiper fraction.</div>
            </div>
          )}
          <div className="info-pair"><span>POSITION</span><b>{c.x}, {c.y}</b></div>
          <div className="info-pair"><span>ROTATION</span><b>{c.rotation}°</b></div>
          <div className="button-row">
            {c.kind !== 'ground' && <button className="small-action" onClick={() => rotate(c.id)}>↻ ROTATE 90°</button>}
            <button className="small-action danger-action" onClick={remove}>✕ DELETE</button>
          </div>
          {reading && <div className="readings">
            <div className="sidebar-section-label">DC TELEMETRY</div>
            <div className="readout"><span>{c.kind === 'potentiometer' ? 'VOLTAGE A→B' : 'VOLTAGE A→B'}</span>
              <strong>{formatElectrical(reading.voltage, 'V')}</strong></div>
            <div className="readout"><span>{c.kind === 'potentiometer' ? 'CURRENT A→W' : 'CURRENT A→B'}</span>
              <strong>{formatElectrical(reading.current, 'A')}</strong></div>
            <div className="readout"><span>{c.kind === 'potentiometer' ? 'TOTAL POWER' : 'POWER'}</span>
              <strong>{formatElectrical(reading.power, 'W')}</strong></div>
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
          <strong>NO SIGNAL SELECTED</strong>
          <p>Click a neon component or wire to reveal its properties.</p>
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
    <div className={'panel simulation-panel neon-panel ' + (result ? 'simulation-live' : '')}>
      <div className="panel-heading">◉ VOLTAGE ARCADE <span className="tiny-muted">/ MNA</span></div>
      <div className="panel-content">
        <div className="status-line"><span className={'status-dot ' + (result ? 'success' : '')}></span>
          {result ? '● CIRCUIT ANALYZED' : '○ READY TO COMPUTE'}</div>
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
