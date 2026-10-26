import { useEffect, useMemo, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { formatElectrical, labelFor } from '../circuit/types';

function displayTime(seconds: number): string {
  return seconds < .001 ? (seconds * 1e6).toFixed(1) + ' µs'
    : seconds < 1 ? (seconds * 1000).toFixed(2) + ' ms'
      : seconds.toFixed(3) + ' s';
}

export function TransientPanel() {
  const doc = useCircuitStore(s => s.document);
  const selected = useCircuitStore(s => s.selection);
  const transient = useCircuitStore(s => s.transient);
  const timeIndex = useCircuitStore(s => s.timeIndex);
  const duration = useCircuitStore(s => s.transientDuration);
  const steps = useCircuitStore(s => s.transientSteps);
  const run = useCircuitStore(s => s.simulateTransient);
  const setTimeIndex = useCircuitStore(s => s.setTimeIndex);
  const setDuration = useCircuitStore(s => s.setTransientDuration);
  const setSteps = useCircuitStore(s => s.setTransientSteps);
  const [playing, setPlaying] = useState(false);
  const [traceKind, setTraceKind] = useState<'voltage' | 'current'>('voltage');

  const reactive = doc.components.filter(c => c.kind === 'capacitor' || c.kind === 'inductor');
  const selectedComponent = selected?.type === 'component'
    ? doc.components.find(c => c.id === selected.id) : undefined;
  const probe = selectedComponent && selectedComponent.kind !== 'ground'
    ? selectedComponent
    : reactive[0] ?? doc.components.find(c => c.kind !== 'ground');

  const plot = useMemo(() => {
    if (!transient || !probe) return null;
    const readings = transient.frames.map(frame =>
      frame.readings[probe.id]?.[traceKind] ?? 0);
    const min = Math.min(0, ...readings), max = Math.max(0, ...readings);
    const spread = Math.max(1e-12, max - min);
    const width = 276, left = 12, top = 12, height = 74;
    const y = (value: number) => top + height * (max - value) / spread;
    const points = readings.map((v, i) =>
      (i === 0 ? 'M ' : 'L ') +
      (left + i / transient.steps * width).toFixed(2) + ' ' + y(v).toFixed(2)).join(' ');
    return {
      path: points, markerX: left + (timeIndex / transient.steps) * width,
      markerY: y(readings[timeIndex] ?? 0), min, max,
    };
  }, [transient, probe, traceKind, timeIndex]);

  useEffect(() => {
    if (!playing || !transient) return;
    const timer = window.setInterval(() => {
      const state = useCircuitStore.getState();
      if (!state.transient || state.timeIndex >= state.transient.steps) {
        setPlaying(false);
      } else {
        state.setTimeIndex(state.timeIndex + 1);
      }
    }, 42);
    return () => window.clearInterval(timer);
  }, [playing, transient]);
  useEffect(() => { setPlaying(false); }, [transient]);

  const frame = transient?.frames[timeIndex];
  const reading = frame && probe ? frame.readings[probe.id] : null;
  const tick = transient ? transient.duration / transient.steps : 0;

  return (
    <div className="panel transient-panel neon-panel">
      <div className="panel-heading">
        <span className="osc-icon">〰</span> TIME MACHINE
        <span className="tiny-muted">/ TRANSIENT</span>
      </div>
      <div className="panel-content">
        <div className="transient-intro">
          <span className="time-status-dot" />
          BACKWARD-EULER RLC SIMULATOR
        </div>
        <div className="time-setup">
          <label htmlFor="time-duration">TIME WINDOW (ms)</label>
          <input id="time-duration" type="number" min="1" max="30000" step="1"
            value={Number((duration * 1000).toFixed(3))}
            onChange={e => {
              if (e.target.value.trim() && Number(e.target.value) > 0)
                setDuration(Number(e.target.value) / 1000);
            }}
          />
        </div>
        <div className="time-setup">
          <label htmlFor="transient-steps">SAMPLE STEPS</label>
          <select id="transient-steps" value={steps} onChange={e => setSteps(Number(e.target.value))}>
            <option value={60}>60 · FAST</option>
            <option value={120}>120 · BALANCED</option>
            <option value={240}>240 · STANDARD</option>
            <option value={500}>500 · PRECISE</option>
          </select>
        </div>
        <button className="transient-run" onClick={() => {
          setPlaying(false); run();
        }}>▶ RUN TRANSIENT</button>

        {transient ? <>
          <div className="time-current">
            <div><small>TIME POSITION</small><strong>{displayTime(frame?.time ?? 0)}</strong></div>
            <div><small>STEP SIZE</small><strong>{displayTime(tick)}</strong></div>
          </div>
          <div className="time-track">
            <input aria-label="Simulation time" type="range" min="0" max={transient.steps}
              step="1" value={timeIndex}
              onChange={e => {
                setPlaying(false);
                setTimeIndex(Number(e.target.value));
              }} />
            <div className="time-extents"><span>0 s</span><span>{displayTime(transient.duration)}</span></div>
          </div>
          <div className="time-controls">
            <button onClick={() => { setPlaying(false); setTimeIndex(0); }} title="Jump to start">|◀</button>
            <button className={playing ? 'time-playing' : ''} onClick={() => {
              if (!playing && timeIndex === transient.steps) setTimeIndex(0);
              setPlaying(!playing);
            }}>{playing ? 'Ⅱ PAUSE' : '▶ PLAY'}</button>
            <button onClick={() => { setPlaying(false); setTimeIndex(transient.steps); }}
              title="Jump to end">▶|</button>
          </div>
          {probe && reading && <div className="scope">
            <div className="scope-title">
              <span>◉ {labelFor(probe, doc.components)} · {traceKind.toUpperCase()}</span>
              <div className="scope-switch">
                <button className={traceKind === 'voltage' ? 'active' : ''}
                  onClick={() => setTraceKind('voltage')}>V</button>
                <button className={traceKind === 'current' ? 'active' : ''}
                  onClick={() => setTraceKind('current')}>I</button>
              </div>
            </div>
            <svg viewBox="0 0 300 100" role="img"
              aria-label={'Simulation ' + traceKind + ' over time for ' + labelFor(probe, doc.components)}>
              <g stroke="#245370" strokeWidth=".7">
                <path d="M12 12 V86 H288" fill="none" />
                <path d="M12 31 H288 M12 50 H288 M12 69 H288" strokeDasharray="2 5"/>
                <path d="M81 12 V86 M150 12 V86 M219 12 V86" strokeDasharray="2 5"/>
              </g>
              {plot && <>
                <path d={plot.path} stroke={traceKind === 'voltage' ? '#6bffca' : '#ff8add'}
                  strokeWidth="2" fill="none" strokeLinejoin="round" />
                <line x1={plot.markerX} y1="12" x2={plot.markerX} y2="86"
                  stroke="#fff1a2" strokeWidth="1.2" strokeDasharray="4 2" />
                <circle cx={plot.markerX} cy={plot.markerY} r="3.2"
                  fill="#fff8d5" stroke="#ffce7e" />
              </>}
            </svg>
            <div className="scope-reading">
              <span>AT {displayTime(frame?.time ?? 0)}</span>
              <strong>{formatElectrical(reading[traceKind], traceKind === 'voltage' ? 'V' : 'A')}</strong>
            </div>
            <p>Select another part to graph its voltage or current.</p>
          </div>}
        </> : (
          <div className="time-empty">
            <span>⌁</span>
            <p>Add a capacitor or inductor and click RUN TRANSIENT to unlock the timeline.</p>
            <p>Sources are constant DC steps at t = 0; capacitors start at 0 V and inductors at 0 A.</p>
          </div>
        )}
      </div>
    </div>
  );
}
