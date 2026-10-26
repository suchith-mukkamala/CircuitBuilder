import type {
  DigitalBlock, DigitalComponent, DigitalDocument, DigitalKind, LogicValue,
} from './types';
import { digitalId, digitalSnap, initialDigitalCircuit, isDigitalDocument } from './types';

/**
 * Create a reusable module from a complete combinational schematic.
 * External INPUT switches and LED indicators become named input/output ports.
 * The original schematic is saved as an immutable module definition.
 */
export function captureBlock(doc: DigitalDocument, name: string): {
  definition: DigitalBlock;
  condensed: DigitalDocument;
} {
  if (!isDigitalDocument(doc)) throw new Error('Invalid circuit; cannot create a reusable block.');
  const inputs = doc.components.filter(c => c.kind === 'input');
  const outputs = doc.components.filter(c => c.kind === 'led');
  if (!inputs.length || !outputs.length) {
    throw new Error('A block needs at least one INPUT switch and at least one LED output.');
  }
  if (inputs.length > 12 || outputs.length > 12) {
    throw new Error('A block supports up to 12 external inputs and 12 outputs.');
  }
  if (doc.components.length <= inputs.length + outputs.length) {
    throw new Error('Add at least one gate or reusable block between the inputs and outputs.');
  }
  const title = name.trim().slice(0, 40);
  if (!title) throw new Error('Give your block a name.');
  const blockId = digitalId();
  const definition: DigitalBlock = {
    id: blockId,
    name: title,
    inputs: inputs.map((c, i) => ({
      pin: 'in' + i,
      label: (c.name?.trim() || 'IN ' + (i + 1)).slice(0, 28),
      componentId: c.id,
    })),
    outputs: outputs.map((c, i) => ({
      pin: 'out' + i,
      label: (c.name?.trim() || 'OUT ' + (i + 1)).slice(0, 28),
      componentId: c.id,
    })),
    circuit: {
      version: 1, lab: 'signal', name: title,
      components: doc.components.map(c => ({ ...c, ports: c.ports
        ? { inputs: [...c.ports.inputs], outputs: [...c.ports.outputs] } : undefined })),
      wires: doc.wires.map(w => ({ ...w, from: { ...w.from }, to: { ...w.to },
        waypoints: w.waypoints?.map(p => ({ ...p })) })),
    },
  };
  const instance: DigitalComponent = {
    id: digitalId(), kind: 'block', blockId, name: title,
    x: 420, y: 252, rotation: 0,
    ports: { inputs: definition.inputs.map(p => p.pin),
      outputs: definition.outputs.map(p => p.pin) },
  };
  const spread = (count: number, index: number) => (index - (count - 1) / 2) * 24;
  const sources: DigitalComponent[] = inputs.map((c, i) => ({
    ...c, id: digitalId(), x: digitalSnap(160), y: digitalSnap(instance.y + spread(inputs.length, i)),
  }));
  const sinks: DigitalComponent[] = outputs.map((c, i) => ({
    ...c, id: digitalId(), x: digitalSnap(680), y: digitalSnap(instance.y + spread(outputs.length, i)),
  }));
  const wires = [
    ...sources.map((c, i) => ({
      id: digitalId(), from: { componentId: c.id, pin: 'out' },
      to: { componentId: instance.id, pin: definition.inputs[i].pin },
    })),
    ...sinks.map((c, i) => ({
      id: digitalId(), from: { componentId: instance.id, pin: definition.outputs[i].pin },
      to: { componentId: c.id, pin: 'in' },
    })),
  ];
  const condensed: DigitalDocument = {
    version: 1, lab: 'signal', name: doc.name + ' · BLOCK',
    components: [...sources, instance, ...sinks],
    wires,
    blocks: [...(doc.blocks ?? []), definition],
  };
  if (!isDigitalDocument(condensed)) {
    throw new Error('Could not convert this circuit to a reusable block.');
  }
  return { definition, condensed };
}
export function placeBlock(
  doc: DigitalDocument,
  library: DigitalBlock[],
  blockId: string,
  at: {x:number;y:number},
): DigitalDocument {
  const available = new Map(library.map(def => [def.id, def]));
  for (const def of doc.blocks ?? []) available.set(def.id, def);
  const def = available.get(blockId);
  if (!def) throw new Error('Saved block could not be found.');
  const added: DigitalBlock[] = [...(doc.blocks ?? [])];
  const seen = new Set(added.map(d => d.id));
  const include = (id: string, stack: Set<string>) => {
    if (stack.has(id)) throw new Error('Recursive block dependency detected.');
    if (seen.has(id)) return;
    const next = available.get(id);
    if (!next) throw new Error('Block dependency ' + id + ' is missing.');
    const rest = new Set(stack); rest.add(id);
    for (const part of next.circuit.components.filter(c => c.kind === 'block')) {
      include(part.blockId!, rest);
    }
    added.push(next); seen.add(id);
  };
  include(blockId, new Set());
  const component: DigitalComponent = {
    id: digitalId(), kind: 'block', blockId,
    name: def.name, x: digitalSnap(at.x), y: digitalSnap(at.y), rotation: 0,
    ports: {inputs: def.inputs.map(port => port.pin), outputs: def.outputs.map(port => port.pin)},
  };
  const placed: DigitalDocument = {
    ...doc, components: [...doc.components, component], blocks: added,
  };
  if (!isDigitalDocument(placed)) throw new Error('The chosen block cannot be added to this circuit.');
  return placed;
}
export function outputVector(
  doc: DigitalDocument,
  ledValues: Record<string, LogicValue>,
): string {
  return doc.components.filter(c => c.kind === 'led')
    .map(c => String(ledValues[c.id] ?? 'Z')).join('');
}
export function inputVector(doc: DigitalDocument): string {
  return doc.components.filter(c => c.kind === 'input')
    .map(c => String(c.bit ?? 0)).join('');
}
export function applyInputVector(doc: DigitalDocument, raw: string): DigitalDocument {
  const switches = doc.components.filter(c => c.kind === 'input');
  if (!switches.length) throw new Error('Add at least one INPUT switch first.');
  const bits = raw.replace(/\s+/g, '');
  if (!/^[01]+$/.test(bits)) throw new Error('Enter a binary vector using only 0 and 1.');
  if (bits.length !== switches.length) {
    throw new Error('Expected ' + switches.length + ' bits (one for each INPUT, in listed order).');
  }
  const index = new Map(switches.map((c, i) => [c.id, i]));
  return { ...doc, components: doc.components.map(c => c.kind === 'input'
    ? { ...c, bit: Number(bits[index.get(c.id)!]) as 0 | 1 } : c) };
}


/**
 * Edit a saved module while retaining its stable external pin identifiers.
 * This allows full rewiring and gate replacement without corrupting
 * connections on already-placed instances in larger schematics.
 *
 * Ports are ordered by the original capture; the same boundary switch / LED
 * component IDs must remain. Renaming those components updates port labels.
 */
export function reviseBlockDefinition(
  existing: DigitalBlock, edited: DigitalDocument,
): DigitalBlock {
  if (!isDigitalDocument(edited)) {
    throw new Error('This block has invalid or missing wires, ports, or component definitions.');
  }
  const inputs = edited.components.filter(c => c.kind === 'input');
  const outputs = edited.components.filter(c => c.kind === 'led');
  if (inputs.map(c => c.id).join('|') !== existing.inputs.map(p => p.componentId).join('|') ||
      outputs.map(c => c.id).join('|') !== existing.outputs.map(p => p.componentId).join('|')) {
    throw new Error(
      'Keep the original INPUT switches and LED output components when editing a block. ' +
      'Their pins are used by existing circuits. Internal gates and wires can be freely edited.',
    );
  }
  const nameOf = (c: DigitalComponent, fallback: string) =>
    (c.name?.trim() || fallback).slice(0, 28);
  const { blocks: _catalog, ...circuit } = edited;
  return {
    ...existing,
    inputs: existing.inputs.map((p, i) => ({ ...p, label: nameOf(inputs[i], p.label) })),
    outputs: existing.outputs.map((p, i) => ({ ...p, label: nameOf(outputs[i], p.label) })),
    circuit,
  };
}

/** Replace definitions in a schematic, preserving all other library entries. */
export function updatedBlockCatalog(
  document: DigitalDocument,
  definitions: DigitalBlock[],
): DigitalDocument {
  if (!document.blocks?.length) return document;
  const updated = new Map(definitions.map(def => [def.id, def]));
  return { ...document, blocks: document.blocks.map(def => updated.get(def.id) ?? def) };
}
