import type {DigitalRuntime,LogicBit,LogicValue} from './types';
import {decodeCasm} from './casm';

/**
 * CASM CPU4 datapath transition. This is the reference microarchitecture for
 * a single-cycle teaching CPU, NOT a JavaScript-only emulator hooked to a UI.
 * The digital clock solver feeds it the 8 actual *net values* entering CPU4,
 * and propagates its register/output bits back into the circuit.
 *
 * A future educational control-unit implementation can replace CPU4 with
 * decomposed gates and registers while preserving this ISA contract.
 */
export type CpuState4={
  pc:number;acc:number;out:number;zero:LogicBit;carry:LogicBit;
  halt:LogicBit;fault:LogicBit;ir:number;
};
export type CpuTransition={state:CpuState4;ram:number[]};
export const initialCpuState=():CpuState4=>({
  pc:0,acc:0,out:0,zero:1,carry:0,halt:0,fault:0,ir:0,
});
const bit=(value:LogicValue|undefined):LogicBit=>value===1?1:0;
const regWord=(regs:Record<string,LogicValue>|undefined,prefix:string,size:number)=>{
  let value=0;
  for(let i=0;i<size;i++)if(regs?.[prefix+i]===1)value|=1<<i;
  return value;
};
export function readCpuState(runtime:DigitalRuntime,id:string):CpuState4 {
  const regs=runtime.registers[id];
  if(!regs)return initialCpuState();
  return {
    pc:regWord(regs,'pc',4),acc:regWord(regs,'acc',4),
    out:regWord(regs,'out',4),ir:regWord(regs,'ir',8),
    zero:bit(regs.zero),carry:bit(regs.carry),
    halt:bit(regs.halt),fault:bit(regs.fault),
  };
}
export function cpuOutputs(runtime:DigitalRuntime,id:string):Record<string,LogicValue> {
  const cpu=readCpuState(runtime,id);
  return Object.fromEntries([
    ...[0,1,2,3].map(i=>['pc'+i,((cpu.pc>>i)&1) as LogicValue]),
    ...[0,1,2,3].map(i=>['acc'+i,((cpu.acc>>i)&1) as LogicValue]),
    ...[0,1,2,3].map(i=>['out'+i,((cpu.out>>i)&1) as LogicValue]),
    ['zero',cpu.zero],['carry',cpu.carry],
    ['halt',cpu.halt],['fault',cpu.fault],
  ]);
}
export function encodeCpuRegisters(state:CpuState4):Record<string,LogicValue> {
  return Object.fromEntries([
    ...[0,1,2,3].flatMap(i=>[
      ['pc'+i,((state.pc>>i)&1) as LogicValue],
      ['acc'+i,((state.acc>>i)&1) as LogicValue],
      ['out'+i,((state.out>>i)&1) as LogicValue],
    ]),
    ...[0,1,2,3,4,5,6,7].map(i=>['ir'+i,((state.ir>>i)&1) as LogicValue]),
    ['zero',state.zero],['carry',state.carry],
    ['halt',state.halt],['fault',state.fault],
  ]);
}
/**
 * Executes exactly one instruction (one rising clock edge). Operand widths
 * are 4-bit and ACC wraps modulo 16. CARRY on SUB means a borrow happened.
 * Memory is per core, 16x4 and initialized to zero. A halted/faulted CPU
 * remains stopped until reset; PC stays at the HALT/fault address.
 */
export function executeCasm(
  previous:CpuState4,byte:number|null,previousRam:readonly number[],
):CpuTransition {
  const ram=[...previousRam].slice(0,16);
  while(ram.length<16)ram.push(0);
  const state={...previous};
  if(state.halt||state.fault)return {state,ram};
  if(byte===null||!Number.isInteger(byte)||byte<0||byte>255){
    state.fault=1;state.halt=1;
    return {state,ram};
  }
  state.ir=byte;
  const {instruction,operand}=decodeCasm(byte);
  if(!instruction){
    state.fault=1;state.halt=1;return {state,ram};
  }
  let nextPc=(state.pc+1)&15;
  const setAcc=(n:number,carry:LogicBit=0)=>{
    state.acc=n&15;state.zero=state.acc===0?1:0;state.carry=carry;
  };
  switch(instruction.name){
    case 'NOP': break;
    case 'LDI':setAcc(operand);break;
    case 'ADD':{
      const total=state.acc+operand;
      setAcc(total,total>15?1:0);break;
    }
    case 'SUB':{
      const total=state.acc-operand;
      setAcc(total,total<0?1:0);break;
    }
    case 'AND':setAcc(state.acc&operand);break;
    case 'OR':setAcc(state.acc|operand);break;
    case 'XOR':setAcc(state.acc^operand);break;
    case 'LOAD':setAcc(ram[operand]??0);break;
    case 'STORE':ram[operand]=state.acc;break;
    case 'JMP':nextPc=operand;break;
    case 'JZ':if(state.zero===1)nextPc=operand;break;
    case 'JNZ':if(state.zero===0)nextPc=operand;break;
    case 'OUT':state.out=state.acc;break;
    case 'HLT':state.halt=1;nextPc=state.pc;break;
    case 'INC':{
      const total=state.acc+1;
      setAcc(total,total>15?1:0);break;
    }
  }
  state.pc=nextPc;
  return {state,ram};
}
