import {digitalPins,readInput,type DigitalPin,type Inputs,type Wiring} from './model';

type Compare='<'|'>'|'<='|'>='|'=='|'!=';
type Instruction=({op:'write';pin:DigitalPin;value:number}|{op:'servo';pin:DigitalPin;angle:number}|
  {op:'wait';ms:number}|{op:'if';sensor:string;compare:Compare;value:number;target:number}|
  {op:'jump';target:number})&{line:number};
export type Program={instructions:Instruction[]};
export type CompileError={line:number;message:string};
export type Compilation={program:Program|null;errors:CompileError[]};
export type TraceEvent={time:number;message:string};
export type ControllerState={time:number;pc:number;line:number;waitUntil:number;
  pins:Record<DigitalPin,number>;servos:Record<DigitalPin,number>;steps:number;trace:TraceEvent[];error:string|null};

/** MicroScript is a bounded teaching language; user text is never evaluated as JavaScript. */
export function compile(source:string,wiring:Wiring):Compilation{
  const errors:CompileError[]=[];
  const code:Instruction[]=[];
  const stack:{index:number;elseIndex?:number;line:number}[]=[];
  const error=(line:number,message:string)=>{errors.push({line,message});};
  if(source.length>16000)return {program:null,errors:[{line:1,message:'Keep your program under 16,000 characters.'}]};
  const lines=source.split(/\r?\n/);
  if(lines.length>300)return {program:null,errors:[{line:301,message:'Keep your program under 300 lines.'}]};
  lines.forEach((raw,index)=>{
    const text=raw.replace(/#.*/,'').trim();
    const line=index+1;
    if(!text)return;
    let match:RegExpMatchArray|null;
    if((match=text.match(/^write\s+(D[0-7])\s+(HIGH|LOW|0|1)$/i))){
      const pin=match[1].toUpperCase() as DigitalPin;
      if(wiring.button===pin)error(line,pin+' is connected to an input. Choose an output pin.');
      if(wiring.servo===pin)error(line,'Use servo '+pin+' <angle> to control the servo.');
      code.push({op:'write',pin,value:/^(HIGH|1)$/i.test(match[2])?1:0,line});
    }else if((match=text.match(/^servo\s+(D[0-7])\s+(\d+)$/i))){
      const pin=match[1].toUpperCase() as DigitalPin,angle=Number(match[2]);
      if(angle>180)error(line,'Servo angle must be from 0 to 180 degrees.');
      if(wiring.servo!==pin)error(line,'Connect the servo to '+pin+' in the pin map first.');
      code.push({op:'servo',pin,angle,line});
    }else if((match=text.match(/^wait\s+(\d+)$/i))){
      const ms=Number(match[1]);
      if(ms<1||ms>60000)error(line,'Wait must be from 1 to 60,000 milliseconds.');
      code.push({op:'wait',ms,line});
    }else if((match=text.match(/^if\s+(button|distance|knob|D[0-7]|A[01])\s*(==|!=|<=|>=|<|>)\s*(HIGH|LOW|-?\d+)$/i))){
      if(stack.length>=8)error(line,'Use no more than 8 nested conditions.');
      const value=/^HIGH$/i.test(match[3])?1:/^LOW$/i.test(match[3])?0:Number(match[3]);
      if(!Number.isSafeInteger(value))error(line,'Condition needs a finite whole number.');
      stack.push({index:code.length,line});
      code.push({op:'if',sensor:match[1],compare:match[2] as Compare,value,target:0,line});
    }else if(/^else$/i.test(text)){
      const frame=stack.at(-1);
      if(!frame||frame.elseIndex!==undefined){error(line,'Each else needs one matching if.');return;}
      frame.elseIndex=code.length;
      (code[frame.index] as Extract<Instruction,{op:'if'}>).target=code.length+1;
      code.push({op:'jump',target:0,line});
    }else if(/^end$/i.test(text)){
      const frame=stack.pop();
      if(!frame){error(line,'This end has no matching if.');return;}
      const instruction=code[frame.elseIndex??frame.index];
      if(instruction.op==='if'||instruction.op==='jump')instruction.target=code.length;
    }else error(line,'Unknown instruction. Use write, servo, wait, if, else, or end.');
  });
  stack.forEach(frame=>error(frame.line,'Close this if with end.'));
  if(!code.length)error(1,'Write a program or choose a starter project.');
  else if(!code.some(instruction=>instruction.op==='wait'))error(1,'Add a wait instruction so the controller can advance time.');
  return {program:errors.length?null:{instructions:code},errors};
}

export function initialController():ControllerState{
  const pins=Object.fromEntries(digitalPins.map(pin=>[pin,0])) as Record<DigitalPin,number>;
  return {time:0,pc:0,line:0,waitUntil:0,pins,servos:{...pins},steps:0,trace:[],error:null};
}
function compare(a:number,op:Compare,b:number):boolean{
  switch(op){case '<':return a<b;case '>':return a>b;case '<=':return a<=b;
    case '>=':return a>=b;case '==':return a===b;case '!=':return a!==b;}
}

/** Virtual time is independent of frame rate. A wait consumes exactly its specified time. */
export function advanceController(program:Program,state:ControllerState,elapsed:number,inputs:Inputs,wiring:Wiring):ControllerState{
  if(state.error)return state;
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>60000)throw new Error('Invalid controller time step.');
  const vm={...state,pins:{...state.pins},servos:{...state.servos},trace:[...state.trace]};
  const target=state.time+elapsed;
  const record=(message:string)=>{vm.trace=[...vm.trace,{time:vm.time,message}].slice(-80);};
  for(let budget=0;budget<10000;budget++){
    if(vm.waitUntil>vm.time){
      if(vm.waitUntil>target){vm.time=target;return vm;}
      vm.time=vm.waitUntil;vm.waitUntil=0;
    }
    if(vm.pc>=program.instructions.length)vm.pc=0;
    const instruction=program.instructions[vm.pc];
    if(!instruction){vm.error='Upload a non-empty program.';return vm;}
    vm.line=instruction.line;vm.steps++;
    vm.pc++;
    switch(instruction.op){
      case 'write':
        if(vm.pins[instruction.pin]!==instruction.value)record(instruction.pin+' → '+(instruction.value?'HIGH':'LOW'));
        vm.pins[instruction.pin]=instruction.value;break;
      case 'servo':
        if(vm.servos[instruction.pin]!==instruction.angle)record(instruction.pin+' → '+instruction.angle+'°');
        vm.servos[instruction.pin]=instruction.angle;break;
      case 'wait':vm.waitUntil=vm.time+instruction.ms;break;
      case 'if':
        if(!compare(readInput(instruction.sensor,inputs,wiring,vm.pins),instruction.compare,instruction.value))vm.pc=instruction.target;
        break;
      case 'jump':vm.pc=instruction.target;break;
    }
  }
  vm.error='Instruction limit reached. Add a wait to every repeating path, or use a smaller time step.';
  return vm;
}
