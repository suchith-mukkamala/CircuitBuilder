import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from './useCircuitStore';
import { starterCircuit, rcCircuit } from '../circuit/sample';

function reset() {
  useCircuitStore.setState({
    document: starterCircuit(),
    past: [], future: [], dragSnapshot: null,
    selectedIds: [], selection: null, pendingPin: null,
    clipboard: null, pasteCount: 0, simulation: null, transient: null,
    transientSteps: 240, transientDuration: 1, timeIndex: 0,
  });
}
beforeEach(reset);

describe('workbench history', () => {
  it('undoes and redoes component addition without losing circuit identity', () => {
    const before = useCircuitStore.getState().document.components.length;
    useCircuitStore.getState().addComponent('capacitor', { x: 672, y: 96 });
    expect(useCircuitStore.getState().document.components).toHaveLength(before + 1);
    expect(useCircuitStore.getState().past).toHaveLength(1);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().document.components).toHaveLength(before);
    useCircuitStore.getState().redo();
    expect(useCircuitStore.getState().document.components).toHaveLength(before + 1);
  });

  it('treats a pointer drag as a single undoable operation', () => {
    const origin = useCircuitStore.getState().document.components.find(c => c.id === 'r1')!;
    useCircuitStore.getState().select({ type: 'component', id: 'r1' });
    useCircuitStore.getState().beginDrag();
    useCircuitStore.getState().moveComponent('r1', { x: origin.x + 12, y: origin.y });
    useCircuitStore.getState().moveComponent('r1', { x: origin.x + 24, y: origin.y });
    useCircuitStore.getState().moveComponent('r1', { x: origin.x + 36, y: origin.y });
    useCircuitStore.getState().endDrag();
    expect(useCircuitStore.getState().past).toHaveLength(1);
    expect(useCircuitStore.getState().document.components.find(c => c.id === 'r1')?.x)
      .toBe(origin.x + 36);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().document.components.find(c => c.id === 'r1')?.x)
      .toBe(origin.x);
  });

  it('does not add history if a drag did not move', () => {
    useCircuitStore.getState().beginDrag();
    useCircuitStore.getState().endDrag();
    expect(useCircuitStore.getState().past).toHaveLength(0);
  });

  it('invalidates the redo stack after new edits', () => {
    useCircuitStore.getState().addComponent('resistor', { x: 600, y: 200 });
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().future).toHaveLength(1);
    useCircuitStore.getState().addComponent('ground', { x: 700, y: 300 });
    expect(useCircuitStore.getState().future).toHaveLength(0);
  });

  it('rolls back switch toggles, property edits and wire cleanup', () => {
    useCircuitStore.getState().setComponentValue('r1', 4700);
    expect(useCircuitStore.getState().document.components.find(c => c.id === 'r1')?.value).toBe(4700);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().document.components.find(c => c.id === 'r1')?.value).toBe(1000);
    useCircuitStore.getState().straightenWire('w1');
    expect(useCircuitStore.getState().document.wires.find(w => w.id === 'w1')?.waypoints).toEqual([]);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().document.wires.find(w => w.id === 'w1')?.waypoints).toEqual([{ x: 144, y: 168 }]);
  });
});

describe('multi-selection and clipboard', () => {
  it('supports additive selection and moves the whole group', () => {
    const store = useCircuitStore.getState();
    store.select({ type: 'component', id: 'r1' });
    store.select({ type: 'component', id: 'r2' }, true);
    expect(useCircuitStore.getState().selectedIds).toEqual(['r1', 'r2']);
    store.beginDrag();
    store.moveComponent('r1', { x: 384, y: 168 });
    store.endDrag();
    const doc = useCircuitStore.getState().document;
    expect(doc.components.find(c => c.id === 'r1')?.x).toBe(384);
    expect(doc.components.find(c => c.id === 'r2')?.x).toBe(576);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().document.components.find(c => c.id === 'r2')?.x).toBe(528);
  });

  it('copies selected parts and only their internal wires with new stable IDs', () => {
    const store = useCircuitStore.getState();
    store.select({ type: 'component', id: 'v1' });
    store.select({ type: 'component', id: 'r1' }, true);
    store.copySelection();
    expect(useCircuitStore.getState().clipboard?.components).toHaveLength(2);
    expect(useCircuitStore.getState().clipboard?.wires.map(w => w.id)).toEqual(['w1']);
    store.pasteClipboard();
    const state = useCircuitStore.getState();
    expect(state.selectedIds).toHaveLength(2);
    expect(state.document.components).toHaveLength(6);
    const pastedWire = state.document.wires.find(w => w.id !== 'w1' && w.id !== 'w2' &&
      w.id !== 'w3' && w.id !== 'w4');
    expect(pastedWire).toBeDefined();
    expect(pastedWire && 'componentId' in pastedWire.from &&
      state.selectedIds.includes(pastedWire.from.componentId)).toBe(true);
    expect(pastedWire && 'componentId' in pastedWire.to &&
      state.selectedIds.includes(pastedWire.to.componentId)).toBe(true);
    expect(pastedWire?.waypoints?.[0]).toEqual({ x: 192, y: 216 });
    store.undo();
    expect(useCircuitStore.getState().document.components).toHaveLength(4);
  });

  it('supports duplication and deleting an entire selection', () => {
    const store = useCircuitStore.getState();
    store.select({ type: 'component', id: 'r1' });
    store.select({ type: 'component', id: 'r2' }, true);
    store.duplicateSelection();
    expect(useCircuitStore.getState().document.components).toHaveLength(6);
    store.removeSelection();
    expect(useCircuitStore.getState().document.components).toHaveLength(4);
    store.undo();
    expect(useCircuitStore.getState().document.components).toHaveLength(6);
  });

  it('supports moving loose wire ends and undoing the move', () => {
    const store = useCircuitStore.getState();
    store.startOrFinishWire({ componentId: 'v1', pin: 'a' });
    store.startOrFinishWire({ x: 720, y: 240 });
    const wire = useCircuitStore.getState().document.wires.at(-1)!;
    store.cancelWire();
    store.beginDrag();
    store.moveFreeEnd(wire.id, 'to', { x: 768, y: 240 });
    store.endDrag();
    const moved = useCircuitStore.getState().document.wires.find(w => w.id === wire.id)!;
    expect(moved.to).toEqual({ x: 768, y: 240 });
    store.undo();
    const restored = useCircuitStore.getState().document.wires.find(w => w.id === wire.id)!;
    expect(restored.to).toEqual({ x: 720, y: 240 });
  });
});

describe('transient controls', () => {
  it('respects editable fixed time-step resolution', () => {
    useCircuitStore.getState().loadDocument(rcCircuit());
    useCircuitStore.getState().setTransientSteps(120);
    useCircuitStore.getState().simulateTransient();
    const result = useCircuitStore.getState().transient;
    expect(result?.steps).toBe(120);
    expect(result?.frames).toHaveLength(121);
    useCircuitStore.getState().setTimeIndex(75);
    expect(useCircuitStore.getState().simulation?.readings.r2.voltage)
      .toBeCloseTo(result?.frames[75].readings.r2.voltage ?? NaN);
  });
});
