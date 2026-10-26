import { ChangeEvent, useEffect, useRef } from 'react';
import { Palette } from './components/Palette';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Inspector, SimulationPanel } from './components/Inspector';
import { TransientPanel } from './components/TransientPanel';
import { starterCircuit } from './circuit/sample';
import { useCircuitStore } from './state/useCircuitStore';

function downloadCircuit() {
  const doc = useCircuitStore.getState().document;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (doc.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'circuit') + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const circuit = useCircuitStore(s => s.document);
  const rename = useCircuitStore(s => s.rename);
  const save = useCircuitStore(s => s.save);
  const load = useCircuitStore(s => s.loadDocument);
  const fresh = useCircuitStore(s => s.newCircuit);
  const remove = useCircuitStore(s => s.removeSelection);
  const cancel = useCircuitStore(s => s.cancelWire);
  const rotate = useCircuitStore(s => s.rotateComponent);
  const toggleSwitch = useCircuitStore(s => s.toggleSwitch);
  const selection = useCircuitStore(s => s.selection);
  const pendingPin = useCircuitStore(s => s.pendingPin);
  const message = useCircuitStore(s => s.message);
  const simulation = useCircuitStore(s => s.simulation);
  const run = useCircuitStore(s => s.simulate);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); save(); return;
      }
      if (typing) return;
      if (e.key === 'Escape') cancel();
      if (e.key === 'Delete' || e.key === 'Backspace') remove();
      if (e.key.toLowerCase() === 'r' && selection?.type === 'component') rotate(selection.id);
      if (e.code === 'Space' && selection?.type === 'component') {
        const part = useCircuitStore.getState().document.components.find(c => c.id === selection.id);
        if (part?.kind === 'switch') { e.preventDefault(); toggleSwitch(part.id); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, remove, rotate, toggleSwitch, cancel, save]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      load(JSON.parse(await file.text()));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import circuit.');
    }
    e.currentTarget.value = '';
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-chip"><span className="chip-center">▣</span></span>
          <div className="brand-name">CIRCUIT<span>BUILDER</span><small>V0.3</small></div>
        </div>
        <div className="topbar-separator" />
        <div className="file-name"><span className="folder-icon">▰</span>
          <input aria-label="Circuit name" title="Rename circuit" value={circuit.name} maxLength={90}
            onChange={e => rename(e.target.value)} />
          <span className="file-ext">.circuit</span>
        </div>
        <nav className="header-actions" aria-label="Circuit actions">
          <button onClick={() => { if (window.confirm('Start an empty circuit? Your current work stays in the exported file only if you exported it.')) fresh(); }} title="New circuit">＋ NEW</button>
          <button onClick={() => load(starterCircuit())} title="Load the example voltage divider">◇ DEMO</button>
          <button onClick={save} title="Save to local browser storage">▣ SAVE</button>
          <button onClick={downloadCircuit} title="Export circuit as JSON">⇩ EXPORT</button>
          <button onClick={() => fileInput.current?.click()} title="Import a circuit JSON file">⇧ IMPORT</button>
        </nav>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
        <div className="topbar-end"><span className="online-dot" /> LOCAL WORKBENCH</div>
      </header>

      <div className="workspace">
        <Palette />
        <main className="editor-region">
          <div className="editor-titlebar">
            <div><span className="titlebar-indicator" /> SCHEMATIC EDITOR <small>/ {circuit.name.toUpperCase()}</small></div>
            <div className="editor-tags"><span>GRID: 24 PX</span><span>NEON / DC</span></div>
          </div>
          <CircuitCanvas />
          <div className="editor-foot">
            <span><i className={simulation ? 'foot-ready' : ''} />{pendingPin ? 'CONNECTING WIRE' : simulation ? 'SIMULATION COMPLETE' : 'EDITOR READY'}</span>
            <span className="editor-foot-message" title={message}>{message}</span>
            <span>CB // 001</span>
          </div>
        </main>
        <aside className="right-panel">
          <Inspector />
          <SimulationPanel />
          <TransientPanel />
          <div className="help-panel">
            <span className="help-title">⌘ SHORTCUTS</span>
            <div><kbd>R</kbd><span>Rotate selected component</span></div>
            <div><kbd>DEL</kbd><span>Delete component / wire</span></div>
            <div><kbd>ESC</kbd><span>Cancel wire</span></div>
            <div><kbd>SPACE</kbd><span>Flip selected switch</span></div>
            <div><kbd>R-CLICK</kbd><span>Quick-edit components and wires</span></div>
            <div><kbd>⌘ / CTRL + S</kbd><span>Save in browser</span></div>
            <button className="help-sim-link" onClick={run}>▶ RE-RUN ANALYSIS</button>
          </div>
        </aside>
      </div>
      <footer className="global-footer">
        <span>✦ BUILT FOR CURIOUS MINDS</span>
        <span>FREE WIRES · TIME SCRUBBER · REAL ANALOG PHYSICS.</span>
        <span>© CIRCUITBUILDER · 2026</span>
      </footer>
    </div>
  );
}
