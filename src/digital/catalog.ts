import type { DigitalKind } from './types';

export type PartCategory = 'sources'|'basic'|'multi'|'routing'|'arithmetic'|'outputs';
export type PartInfo = {
  kind: Exclude<DigitalKind,'block'>;
  glyph: string;
  name: string;
  description: string;
  keywords: string;
};
export type CategoryInfo = {
  id: PartCategory;
  name: string;
  icon: string;
  description: string;
  parts: PartInfo[];
};
export const paletteCategories: CategoryInfo[] = [
  {id:'sources',name:'INPUTS & SOURCES',icon:'▣',description:'Drive your digital circuits',
    parts:[
      {kind:'input',glyph:'▣',name:'INPUT SWITCH',description:'Click to toggle 0 / 1',keywords:'toggle bit digital variable switch'},
      {kind:'high',glyph:'↥',name:'LOGIC HIGH',description:'Constant HIGH (1)',keywords:'constant 1 one vcc power true on'},
      {kind:'low',glyph:'↧',name:'LOGIC LOW',description:'Constant LOW (0)',keywords:'constant 0 zero gnd ground false off'},
    ]},
  {id:'basic',name:'BASIC LOGIC GATES',icon:'◇',description:'Classic Boolean logic',
    parts:[
      {kind:'and',glyph:'∧',name:'AND',description:'1 when both inputs are 1',keywords:'boolean conjunction'},
      {kind:'or',glyph:'∨',name:'OR',description:'1 when either input is 1',keywords:'boolean disjunction'},
      {kind:'not',glyph:'¬',name:'NOT',description:'Invert input A',keywords:'inverter negation'},
      {kind:'xor',glyph:'⊕',name:'XOR',description:'1 when inputs differ',keywords:'exclusive or odd parity'},
      {kind:'nand',glyph:'⊼',name:'NAND',description:'Inverted AND',keywords:'universal gate'},
      {kind:'nor',glyph:'⊽',name:'NOR',description:'Inverted OR',keywords:'universal gate'},
      {kind:'xnor',glyph:'⊙',name:'XNOR',description:'1 when inputs match',keywords:'equivalence equality'},
      {kind:'buffer',glyph:'▷',name:'BUFFER',description:'Pass a digital input',keywords:'repeater signal driver'},
    ]},
  {id:'multi',name:'MULTI-INPUT GATES',icon:'▥',description:'Work with three input signals',
    parts:[
      {kind:'and3',glyph:'∧³',name:'3-INPUT AND',description:'AND of A, B and C',keywords:'and3 triple 3 bit'},
      {kind:'or3',glyph:'∨³',name:'3-INPUT OR',description:'OR of A, B and C',keywords:'or3 triple 3 bit'},
      {kind:'xor3',glyph:'⊕³',name:'3-INPUT XOR',description:'Odd parity of A, B and C',keywords:'xor3 parity triple odd'},
      {kind:'majority',glyph:'⅔',name:'MAJORITY',description:'1 when 2 of 3 are HIGH',keywords:'voter voting three inputs 2 of 3'},
    ]},
  {id:'routing',name:'DATA ROUTING',icon:'⇄',description:'Select and distribute digital signals',
    parts:[
      {kind:'mux2',glyph:'⋈',name:'2:1 MULTIPLEXER',description:'SEL picks A or B',keywords:'mux mux2 selector data switch multiplexer choose'},
      {kind:'demux2',glyph:'⋉',name:'1:2 DEMULTIPLEXER',description:'SEL routes IN to OUT0/OUT1',keywords:'demux demux2 decoder split route distribute'},
    ]},
  {id:'arithmetic',name:'BINARY ARITHMETIC',icon:'⊞',description:'Add numbers from individual bits',
    parts:[
      {kind:'halfadder',glyph:'Σ',name:'HALF ADDER',description:'A + B → SUM, CARRY',keywords:'half-adder arithmetic addition sum carry'},
      {kind:'fulladder',glyph:'Σ+',name:'FULL ADDER',description:'A + B + CIN → SUM, CARRY',keywords:'full-adder arithmetic ripple carry in cin'},
    ]},
  {id:'outputs',name:'OUTPUT & DISPLAY',icon:'◉',description:'Visualize logic states',
    parts:[
      {kind:'led',glyph:'◉',name:'NEON LED',description:'Live 0 / 1 output indicator',keywords:'indicator monitor lamp light bulb display result'},
    ]},
];
export const allParts = paletteCategories.flatMap(group => group.parts);
export const partByKind = Object.fromEntries(allParts.map(part=>[part.kind,part])) as
  Record<Exclude<DigitalKind,'block'>,PartInfo>;
export const categoryByKind = Object.fromEntries(paletteCategories.flatMap(group =>
  group.parts.map(part=>[part.kind,group.id]))) as Record<Exclude<DigitalKind,'block'>,PartCategory>;

export function matchPart(part:PartInfo, query:string):boolean {
  const q = query.toLowerCase().trim().replace(/\s+/g,' ');
  if(!q)return true;
  const haystack = (part.kind+' '+part.name+' '+part.description+' '+part.keywords).toLowerCase();
  return q.split(' ').every(word=>haystack.includes(word));
}
export function searchParts(query:string, category:PartCategory|'all'='all'):PartInfo[] {
  return allParts.filter(part => (category==='all'||categoryByKind[part.kind]===category)
    && matchPart(part,query));
}
