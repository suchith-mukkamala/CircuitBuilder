import type { ComponentKind } from './types';
export type AnalogCategory = 'passives'|'sources'|'reactive';
export type AnalogPart = {
  kind: ComponentKind;
  symbol: string; label: string; detail: string; tone: string; keywords: string;
};
export const analogCategories: {
  id: AnalogCategory; title: string; icon: string; description: string; parts: AnalogPart[];
}[] = [
  {id:'passives',title:'PASSIVES & REFERENCE',icon:'▤',
    description:'Resistive components and ground',
    parts:[
      {kind:'resistor',symbol:'▤',label:'RESISTOR',detail:'1 kΩ · R',tone:'amber',keywords:'resistance passive ohm'},
      {kind:'potentiometer',symbol:'◩',label:'POTENTIOMETER',detail:'1 kΩ · 50%',tone:'purple',
        keywords:'variable resistor pot wiper control'},
      {kind:'ground',symbol:'⏚',label:'GROUND',detail:'0 V reference',tone:'mint',
        keywords:'gnd earth reference zero'},
    ]},
  {id:'sources',title:'SOURCES & CONTROLS',icon:'⊕',
    description:'Apply electrical excitation',
    parts:[
      {kind:'voltage_source',symbol:'⊕',label:'DC VOLTAGE',detail:'5 V · V',tone:'gold',
        keywords:'battery vdc power supply source'},
      {kind:'current_source',symbol:'↓',label:'DC CURRENT',detail:'5 mA · I',tone:'blue',
        keywords:'ampere amps ma source'},
      {kind:'switch',symbol:'╱',label:'SPST SWITCH',detail:'Click to toggle',tone:'pink',
        keywords:'open close contact on off toggle'},
    ]},
  {id:'reactive',title:'ENERGY STORAGE',icon:'▥',
    description:'Transient circuit devices',
    parts:[
      {kind:'capacitor',symbol:'▥',label:'CAPACITOR',detail:'100 µF · C',tone:'pink',
        keywords:'capacitance farad rc charge'},
      {kind:'inductor',symbol:'∿',label:'INDUCTOR',detail:'100 mH · L',tone:'blue',
        keywords:'inductance henry rl coil'},
    ]},
];
export const analogParts = analogCategories.flatMap(c=>c.parts);
export function searchAnalogParts(query:string,category:AnalogCategory|'all'='all'):AnalogPart[]{
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return analogCategories.filter(c=>category==='all'||c.id===category)
    .flatMap(c=>c.parts)
    .filter(part=>{
      const haystack=(
        part.kind.replace(/_/g,' ')+' '+part.label+' '+part.detail+' '+part.keywords
      ).toLowerCase();
      return terms.every(term=>haystack.includes(term));
    });
}
