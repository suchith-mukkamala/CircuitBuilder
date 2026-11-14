import {decodeCasm} from './casm';
import type {CpuState4} from './cpuCore';
export type CpuExplanation={title:string;detail:string;blocks:string[]};
export function explainCpuStep(before:CpuState4,after:CpuState4,ram:readonly number[]):CpuExplanation{
  if(before.halt)return {title:'CPU is halted',detail:'No instruction executed. Reset the CPU to continue.',blocks:[]};
  if(after.fault)return {title:'CPU fault',detail:'The instruction could not be executed. Check the instruction bus and reset the CPU.',blocks:[]};
  const {instruction,operand}=decodeCasm(after.ir);
  const name=instruction?.name??'Unknown';
  const title=name+(instruction?.operand?' '+operand:'');
  const pc=' PC '+before.pc+' → '+after.pc+'.';
  switch(name){
    case 'LDI':return {title,detail:'Loaded '+operand+' into ACC (was '+before.acc+').'+pc,blocks:['ROM','ACC']};
    case 'OUT':return {title,detail:'Copied ACC '+before.acc+' to OUT (was '+before.out+').'+pc,blocks:['ACC','OUT']};
    case 'LOAD':return {title,detail:'Read RAM['+operand+'] into ACC: '+after.acc+'.'+pc,blocks:['RAM','ACC']};
    case 'STORE':return {title,detail:'Stored ACC '+before.acc+' in RAM['+operand+']: '+ram[operand]+'.'+pc,blocks:['ACC','RAM']};
    case 'HLT':return {title,detail:'Stopped execution at address '+after.pc+'. Registers keep their values until reset.',blocks:[]};
    case 'JMP':case 'JZ':case 'JNZ':return {title,detail:(name==='JMP'?'Jumped to address '+after.pc:
      'Tested ZERO = '+before.zero+'; '+((name==='JZ'?before.zero===1:before.zero===0)?'branch taken.':'continued to the next instruction.'))+pc,blocks:['ROM','PC']};
    case 'NOP':return {title,detail:'No register operation.'+pc,blocks:['PC']};
    default:return {title,detail:name+' changed ACC '+before.acc+' → '+after.acc+'. ZERO = '+after.zero+', CARRY = '+after.carry+
      (name==='SUB'?' (borrow).':'.')+' Arithmetic wraps to 4 bits.'+pc,blocks:['ROM','ALU','ACC']};
  }
}
