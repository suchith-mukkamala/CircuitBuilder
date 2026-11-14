export const digitalPins=['D0','D1','D2','D3','D4','D5','D6','D7'] as const;
export const analogPins=['A0','A1'] as const;
export type DigitalPin=typeof digitalPins[number];
export type Pin=DigitalPin|typeof analogPins[number];
export const devices=[
  {id:'button',name:'Push button',kind:'input',color:'#a8bcfc'},
  {id:'distance',name:'Distance sensor',kind:'analog',color:'#81d8ed'},
  {id:'knob',name:'Analog dial',kind:'analog',color:'#c8aff9'},
  {id:'red',name:'Red LED',kind:'output',color:'#ff8e9e'},
  {id:'amber',name:'Amber LED',kind:'output',color:'#ffd083'},
  {id:'green',name:'Green LED',kind:'output',color:'#80e2c5'},
  {id:'servo',name:'Servo motor',kind:'output',color:'#9bc0ff'},
] as const;
export type Device=typeof devices[number]['id'];
export type Wiring=Record<Device,Pin|null>;
export type Inputs={button:number;distance:number;knob:number};
import {validateLogicController,type LogicController} from '../bridges/logicController';
export type RoboticsProject={version:1;lab:'robotics';name:string;lesson:string;source:string;wiring:Wiring;
  controller?:'micro'|'logic';logic?:LogicController};
export const defaultWiring:Wiring={button:'D0',distance:'A0',knob:'A1',red:'D2',amber:'D3',green:'D4',servo:'D5'};
export const defaultInputs:Inputs={button:0,distance:150,knob:512};

export function wiringErrors(wiring:Wiring):string[]{
  const errors:string[]=[];
  for(const device of devices){
    const pin=wiring[device.id];
    if(pin===null)continue;
    const allowed:readonly string[]=device.kind==='analog'?analogPins:digitalPins;
    if(!allowed.includes(pin)){errors.push(device.name+' needs a '+(device.kind==='analog'?'A0–A1':'D0–D7')+' pin.');continue;}
    // A controller input cannot also drive a load. Output fan-out to LEDs is allowed.
    for(const other of devices){
      if(other.id===device.id||wiring[other.id]!==pin)continue;
      if(device.kind!=='output'||other.kind!=='output'||device.id==='servo'||other.id==='servo'){
        const conflict=[device.name,other.name].sort().join(' and ')+' share '+pin+'. Choose separate pins.';
        if(!errors.includes(conflict))errors.push(conflict);
      }
    }
  }
  return errors;
}

export function parseProject(value:unknown):RoboticsProject{
  if(!value||typeof value!=='object')throw new Error('This is not a Robotics Lab project.');
  const p=value as Partial<RoboticsProject>;
  if(p.version!==1||p.lab!=='robotics'||typeof p.name!=='string'||p.name.length>90||
    typeof p.source!=='string'||p.source.length>16000||typeof p.lesson!=='string'||p.lesson.length>80||
    !p.wiring||typeof p.wiring!=='object')throw new Error('Invalid Robotics Lab project or unsupported version.');
  const wiring={} as Wiring;
  if(p.controller!==undefined&&!['micro','logic'].includes(p.controller))throw new Error('Unknown controller type.');
  if(p.logic!==undefined&&!validateLogicController(p.logic))throw new Error('Invalid or unsupported logic controller.');
  if(p.controller==='logic'&&!p.logic)throw new Error('The logic controller is missing.');
  for(const device of devices){
    const pin=p.wiring[device.id];
    const allowed:readonly string[]=device.kind==='analog'?analogPins:digitalPins;
    if(pin!==null&&(typeof pin!=='string'||!allowed.includes(pin)))throw new Error('Invalid connection for '+device.name+'.');
    wiring[device.id]=pin;
  }
  return {version:1,lab:'robotics',name:p.name.trim()?p.name:'Untitled robotics project',lesson:p.lesson,source:p.source,wiring,
    ...(p.controller?{controller:p.controller}:{}),...(p.logic?{logic:p.logic}:{})};
}

/** Unconnected inputs read zero. Digital output pins are also readable. */
export function readInput(name:string,inputs:Inputs,wiring:Wiring,pins:Record<DigitalPin,number>):number{
  const key=name.toLowerCase();
  if(key==='button'||key==='distance'||key==='knob')return wiring[key]===null?0:inputs[key];
  const pin=name.toUpperCase() as Pin;
  for(const device of ['button','distance','knob'] as const)if(wiring[device]===pin)return inputs[device];
  return digitalPins.includes(pin as DigitalPin)?pins[pin as DigitalPin]:0;
}
