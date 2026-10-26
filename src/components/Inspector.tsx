import { useEffect, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { formatElectrical, labelFor, isTerminal, WireEndpoint } from '../circuit/types';
import { parseEngineering } from '../editor/units';

const endpointLabel = (e: WireEndpoint) => isTerminal(e)
  ? e.componentId + ' : ' + e.pin : '(' + e.x + ', ' + e.y + ')';

const symbols = {
  resistor: '▤', ground: '⏚', voltage_source: '⊕',
  switch: '╱', current_source: '↓', potentiometer: '◩',
  capacitor: '▥', inductor: '∿',
};

export function Inspector() {
  const doc = useCircuitStore(s => s.document);
  const selected = useCircuitStore(s => s.selection);
  const selectedIds = useCircuitStore(s => s.selectedIds);
  const copy = useCircuitStore(s => s.copySelection);
  const duplicate = useCircuitStore(s => s.duplicateSelection);
  const straightenWire = useCircuitStore(s => s.straightenWire);
  const beginDrag = useCircuitStore(s => s.beginDrag);
  const endDrag = useCircuitStore(s => s.endDrag);
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
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(c ? String(c.value) : ''); setInvalid(false); }, [c?.id, c?.value]);
  const commit = () => {
    if (!c) return;
    const parsed = parseEngineering(draft, c.kind);
    if (parsed === null) { setInvalid(true); return; }
    setInvalid(false);
    setValue(c.id, parsed);
    setDraft(String(parsed));
  };
  const isSource = c?.kind === 'voltage_source' || c?.kind === 'current_source';
  const isResistive = c?.kind === 'resistor' || c?.kind === 'potentiometer';
  const isReactive = c?.kind === 'capacitor' || c?.kind === 'inductor';
  const hasValue = isSource || isResistive || isReactive;

  return (
    <div className="panel section-inspector neon-panel">
      <div className="panel-heading">◈ COMPONENT LAB <span className="tiny-muted">/ INSPECT</span></div>
      {c ? (
        <div className="panel-content inspector-content">
          {selectedIds.length > 1 && <div className="multi-selection-banner">
            <strong>▣ {selectedIds.length} PARTS SELECTED</strong>
            <span>Drag any selected part to move the group.</span>
            <div><button onClick={copy}>COPY</button><button onClick={duplicate}>DUPLICATE</button>
              <button onClick={remove}>DELETE ALL</button></div>
          </div>}
          <div className="selected-heading">
            <span className={'selected-symbol accent-' + c.kind}>{symbols[c.kind]}</span>
            <div><strong>{labelFor(c, doc.components)}</strong><small>{c.kind.replace('_', ' ').toUpperCase()}</small></div>
          </div>
          {hasValue && <>
            <label className="field-label" htmlFor="component-value">
              {isResistive ? 'RESISTANCE (OHMS)' : c.kind === 'current_source' ? 'CURRENT (AMPS)'
                : c.kind === 'capacitor' ? 'CAPACITANCE (FARADS)'
                : c.kind === 'inductor' ? 'INDUCTANCE (HENRYS)' : 'VOLTAGE (VOLTS)'}
            </label>
            <input
              id="component-value" className="input" type="text" inputMode="decimal"
              aria-invalid={invalid} placeholder="4.7k, 100uF, 10mH"
              value={draft} onChange={e => { setDraft(e.target.value); setInvalid(false); }}
              onBlur={commit} onKeyDown={e => {
                if (e.key === 'Enter') { e.currentTarget.blur(); }
                if (e.key === 'Escape') { setDraft(String(c.value)); setInvalid(false); }
              }}
            />
            {invalid && <div className="value-error">Enter a valid number or SI unit (e.g. 4.7kΩ).</div>}
            <div className="field-note">{isResistive ? 'Try 1kΩ, 4.7k, 2M or 220'
              : c.kind === 'capacitor' ? 'Farads · 0.0001 = 100 µF. Starts uncharged at t = 0.'
              : c.kind === 'inductor' ? 'Henrys · 0.1 = 100 mH. Starts with 0 A at t = 0.'
              : c.kind === 'current_source' ? 'Positive current flows from A to B (0.005 = 5 mA)'
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
                onPointerDown={beginDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
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
            <div className="readout"><span>VOLTAGE A→B</span>
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
          <div className="info-pair"><span>FROM</span><b>{endpointLabel(wire.from)}</b></div>
          <div className="info-pair"><span>TO</span><b>{endpointLabel(wire.to)}</b></div>
          <button className="small-action" onClick={() => straightenWire(wire.id)}>⌁ STRAIGHTEN ROUTE</button>
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
  const analysisMode = useCircuitStore(s => s.analysisMode);
  return (
    <div className={'panel simulation-panel neon-panel ' + (result ? 'simulation-live' : '')}>
      <div className="panel-heading">◉ VOLTAGE ARCADE <span className="tiny-muted">/ DC</span></div>
      <div className="panel-content">
        <div className="status-line"><span className={'status-dot ' + (result ? 'success' : '')}></span>
          {result ? (analysisMode === 'dc' ? '● DC ANALYZED' : '● TRANSIENT ANALYZED') : '○ READY TO COMPUTE'}</div>
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
