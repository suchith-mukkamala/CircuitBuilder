import type { DigitalDocument,DigitalComponent,DigitalWire } from './types';
import { defaultRomWords } from './types';

const component=(id:string,kind:DigitalComponent['kind'],x:number,y:number,
  name?:string,bit?:0|1):DigitalComponent => ({
    id,kind,x,y,rotation:0,...(name?{name}:{}),...(bit===0||bit===1?{bit}:{}),
  });
const terminal=(componentId:string,pin:string)=>({componentId,pin});
export function counterDemo():DigitalDocument {
  const parts:DigitalComponent[]=[
    component('clk','clock',120,170,'CLOCK'),
    component('en','high',120,330,'ENABLE'),
    component('rst','low',120,445,'RESET'),
    component('pc','counter4',412,292,'4-BIT PC'),
    ...[0,1,2,3].map(i=>component('led'+i,'led',696,175+i*78,'BIT '+i)),
  ];
  const wires:DigitalWire[]=[
    {id:'clk',from:terminal('clk','out'),to:terminal('pc','clk')},
    {id:'en',from:terminal('en','out'),to:terminal('pc','en')},
    {id:'reset',from:terminal('rst','out'),to:terminal('pc','reset')},
    ...[0,1,2,3].map(i=>({id:'q'+i,from:terminal('pc','q'+i),
      to:terminal('led'+i,'in')})),
  ];
  return {version:1,lab:'signal',name:'Clocked 4-Bit Counter',components:parts,wires};
}
export function flipFlopDemo():DigitalDocument {
  return {
    version:1,lab:'signal',name:'First D Flip-Flop',
    components:[
      component('clk','clock',132,350,'CLK'),
      component('d','input',132,180,'DATA',1),
      component('ff','dff',396,264,'D REGISTER'),
      component('out','led',652,264,'SAVED BIT'),
    ],
    wires:[
      {id:'wd',from:terminal('d','out'),to:terminal('ff','d')},
      {id:'wc',from:terminal('clk','out'),to:terminal('ff','clk')},
      {id:'wq',from:terminal('ff','q'),to:terminal('out','in')},
    ],
  };
}
/**
 * Functional educational CPU datapath: clocked 4-bit program counter feeds
 * editable 16x4 ROM. ALU adds ROM's current value to accumulator. The
 * accumulator captures old combinational ALU output on the same rising
 * edge as the PC increments. This is a stateful datapath, NOT a complete
 * instruction-set CPU (no instruction decoder or machine-code execution).
 */
export function cpuCoreDemo():DigitalDocument {
  const parts:DigitalComponent[]=[
    component('clk','clock',96,132,'SYSTEM CLK'),
    component('on','high',96,255,'ENABLE'),
    component('off','low',96,380,'RESET / ADD'),
    component('pc','counter4',360,240,'PROGRAM CTR'),
    {...component('rom','rom16x4',592,240,'PROGRAM ROM'),words:defaultRomWords()},
    component('alu','alu4',828,320,'4-BIT ALU'),
    component('acc','register4',1070,360,'ACCUMULATOR'),
    ...[0,1,2,3].map(i=>component('out'+i,'led',1320,240+i*78,'ACC BIT '+i)),
  ];
  const wires:DigitalWire[]=[];
  const connect=(id:string,a:string,ap:string,b:string,bp:string)=>{
    wires.push({id,from:terminal(a,ap),to:terminal(b,bp)});
  };
  connect('pc_clk','clk','out','pc','clk');
  connect('acc_clk','clk','out','acc','clk');
  connect('pc_en','on','out','pc','en');
  connect('acc_en','on','out','acc','en');
  connect('pc_reset','off','out','pc','reset');
  connect('alu_op0','off','out','alu','op0');
  connect('alu_op1','off','out','alu','op1');
  for(let i=0;i<4;i++){
    connect('address'+i,'pc','q'+i,'rom','a'+i);
    connect('instruction'+i,'rom','q'+i,'alu','a'+i);
    connect('feedback'+i,'acc','q'+i,'alu','b'+i);
    connect('data'+i,'alu','y'+i,'acc','d'+i);
    connect('display'+i,'acc','q'+i,'out'+i,'in');
  }
  return {version:1,lab:'signal',name:'4-Bit CPU Datapath · PC + ROM + ALU + ACC',
    components:parts,wires};
}
