import { ChangeEvent, useEffect, useRef, useState } from 'react';
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

type RightTab = 'inspect' | 'simulate';

export function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileMenu = useRef<HTMLDetailsElement>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>('inspect');
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
  const selectedIds = useCircuitStore(s => s.selectedIds);
  const past = useCircuitStore(s => s.past.length);
  const future = useCircuitStore(s => s.future.length);
  const undo = useCircuitStore(s => s.undo);
  const redo = useCircuitStore(s => s.redo);
  const copy = useCircuitStore(s => s.copySelection);
  const paste = useCircuitStore(s => s.pasteClipboard);
  const duplicate = useCircuitStore(s => s.duplicateSelection);
  const selectAll = useCircuitStore(s => s.selectAll);
  const pendingPin = useCircuitStore(s => s.pendingPin);
  const message = useCircuitStore(s => s.message);
  const simulation = useCircuitStore(s => s.simulation);
  const runDC = useCircuitStore(s => s.simulate);
  const runTransient = useCircuitStore(s => s.simulateTransient);

  const run = (kind: 'dc' | 'transient') => {
    if (kind === 'dc') runDC();
    else runTransient();
    setShowRight(true);
    setRightTab('simulate');
  };
  const closeFileMenu = () => { if (fileMenu.current) fileMenu.current.open = false; };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, [contenteditable="true"]');
      const command = e.ctrlKey || e.metaKey;
      if (command && e.key.toLowerCase() === 's') {
        e.preventDefault(); save(); return;
      }
      if (typing) return;
      const key = e.key.toLowerCase();
      if (command) {
        switch (key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
          case 'y': e.preventDefault(); redo(); return;
          case 'c': e.preventDefault(); copy(); return;
          case 'v': e.preventDefault(); paste(); return;
          case 'd': e.preventDefault(); duplicate(); return;
          case 'a': e.preventDefault(); selectAll(); return;
          default: break;
        }
      }
      if (e.key === 'Escape') cancel();
      if (e.key === 'Delete' || e.key === 'Backspace') remove();
      if (key === 'r' && selection?.type === 'component') rotate(selection.id);
      if (e.code === 'Space' && selection?.type === 'component') {
        const part = useCircuitStore.getState().document.components.find(c => c.id === selection.id);
        if (part?.kind === 'switch') { e.preventDefault(); toggleSwitch(part.id); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, undo, redo, copy, paste, duplicate, selectAll, remove, rotate, toggleSwitch, cancel, save]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { load(JSON.parse(await file.text())); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not import circuit.'); }
    e.currentTarget.value = '';
  };

  return (
    <div className="app-shell polished-shell">
      <header className="topbar polished-topbar">
        <div className="brand">
          <span className="brand-chip"><span className="chip-center">▣</span></span>
          <div className="brand-name">CIRCUIT<span>BUILDER</span><small>V0.4</small></div>
        </div>
        <div className="file-name polished-filename">
          <span className="folder-icon">▰</span>
          <input aria-label="Circuit name" title="Rename circuit" value={circuit.name} maxLength={90}
            onChange={e => rename(e.target.value)} />
        </div>
        <nav className="workbench-tools" aria-label="Editor toolbar">
          <button className={'workbench-tool ' + (showLibrary ? 'active-tool' : '')}
            aria-pressed={showLibrary} title="Toggle component library"
            onClick={() => setShowLibrary(v => !v)}>▦ <span>PARTS</span></button>
          <span className="tool-divider" />
          <button className="workbench-tool" disabled={!past} title="Undo (Ctrl/Cmd+Z)"
            onClick={undo}>↶ <span>UNDO</span></button>
          <button className="workbench-tool" disabled={!future} title="Redo (Ctrl/Cmd+Shift+Z)"
            onClick={redo}>↷ <span>REDO</span></button>
          <button className="workbench-tool" disabled={!selectedIds.length} title="Copy selected parts (Ctrl/Cmd+C)"
            onClick={copy}>▣ <span>COPY</span></button>
          <button className="workbench-tool" title="Paste clipboard (Ctrl/Cmd+V)"
            onClick={paste}>⊞ <span>PASTE</span></button>
          <span className="tool-divider" />
          <button className="workbench-tool primary-run" onClick={() => run('dc')}>▶ <span>DC</span></button>
          <button className="workbench-tool primary-run secondary-run"
            onClick={() => run('transient')}>〰 <span>RLC</span></button>
          <button className={'workbench-tool ' + (showRight ? 'active-tool' : '')}
            aria-pressed={showRight} title="Toggle inspector and instruments"
            onClick={() => setShowRight(v => !v)}>◈ <span>PANEL</span></button>
        </nav>
        <details className="file-dropdown" ref={fileMenu}>
          <summary title="File actions">⋮ <span>FILE</span></summary>
          <div className="file-dropdown-menu">
            <button onClick={() => {
              if (window.confirm('Create an empty circuit? Undo can restore the current one.')) fresh();
              closeFileMenu();
            }}>＋ NEW CIRCUIT</button>
            <button onClick={() => { load(starterCircuit()); closeFileMenu(); }}>◇ LOAD DEMO</button>
            <button onClick={() => { save(); closeFileMenu(); }}>▣ SAVE LOCALLY</button>
            <button onClick={() => { downloadCircuit(); closeFileMenu(); }}>⇩ EXPORT JSON</button>
            <button onClick={() => { fileInput.current?.click(); closeFileMenu(); }}>⇧ IMPORT JSON</button>
          </div>
        </details>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </header>

      <div className={'workspace polished-workspace' +
        (!showLibrary ? ' no-library' : '') +
        (!showRight ? ' no-inspector' : '')}>
        {showLibrary && <Palette />}
        <main className="editor-region">
          <div className="editor-titlebar">
            <div><span className="titlebar-indicator" /> WORKBENCH
              <small> / {circuit.name.toUpperCase()}</small>
            </div>
            <div className="editor-tags"><span>GRID · 12 PX SNAP</span><span>NEON ANALOG</span></div>
          </div>
          <CircuitCanvas />
          <div className="editor-foot">
            <span><i className={simulation ? 'foot-ready' : ''} />
              {pendingPin ? 'WIRING' : simulation ? 'SIMULATION READY' : 'EDITOR READY'}
            </span>
            <span className="editor-foot-message" role="status" title={message}>{message}</span>
            <span className="selected-count">{selectedIds.length ? selectedIds.length + ' SELECTED' : 'CB // 004'}</span>
          </div>
        </main>
        {showRight && <aside className="right-panel compact-right">
          <div className="right-tabs" role="tablist" aria-label="Workbench tools">
            <button role="tab" aria-selected={rightTab === 'inspect'}
              className={rightTab === 'inspect' ? 'active-tab' : ''}
              onClick={() => setRightTab('inspect')}>◈ INSPECT</button>
            <button role="tab" aria-selected={rightTab === 'simulate'}
              className={rightTab === 'simulate' ? 'active-tab' : ''}
              onClick={() => setRightTab('simulate')}>〰 SIMULATE</button>
          </div>
          {rightTab === 'inspect'
            ? <Inspector />
            : <div className="simulation-stack"><SimulationPanel /><TransientPanel /></div>}
          <details className="shortcut-help">
            <summary>⌘ SHORTCUTS & TIPS</summary>
            <div><kbd>SHIFT+CLICK</kbd><span>Multi-select parts</span></div>
            <div><kbd>CTRL/CMD + Z/Y</kbd><span>Undo / Redo</span></div>
            <div><kbd>CTRL/CMD + C/V/D</kbd><span>Copy / Paste / Duplicate</span></div>
            <div><kbd>CTRL/CMD + A</kbd><span>Select all</span></div>
            <div><kbd>R</kbd><span>Rotate part</span></div>
            <div><kbd>DEL</kbd><span>Delete selection</span></div>
            <div><kbd>SHIFT+DRAG</kbd><span>Move free wire tip</span></div>
            <div><kbd>RIGHT CLICK</kbd><span>Edit / route wire</span></div>
          </details>
        </aside>}
      </div>
    </div>
  );
}
