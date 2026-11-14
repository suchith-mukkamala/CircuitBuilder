import {describe,expect,it} from 'vitest';
import {advanceController,compile,initialController} from './engine';
import {defaultInputs,defaultWiring,parseProject,readInput,wiringErrors,type Inputs,type Wiring} from './model';
import {lessons,starterProject} from './projects';

const program=(source:string,wiring=defaultWiring)=>{
  const result=compile(source,wiring);
  expect(result.errors).toEqual([]);
  return result.program!;
};

describe('MicroScript compilation',()=>{
  it.each(lessons)('compiles the $name starter',lesson=>{
    expect(compile(lesson.source,defaultWiring).program).not.toBeNull();
  });
  it('accepts comments, indentation, CRLF, and case-insensitive commands',()=>{
    const built=program('# comment\r\n WRITE d2 high # red\r\n wait 10\r\n');
    expect(built.instructions).toEqual([{op:'write',pin:'D2',value:1,line:2},{op:'wait',ms:10,line:3}]);
  });
  it.each([
    ['write D9 HIGH\nwait 1',1],['servo D5 181\nwait 1',1],['servo D5 -1\nwait 1',1],
    ['wait 0',1],['wait 60001',1],['write D0 HIGH\nwait 1',1],
    ['write D5 HIGH\nwait 1',1],['servo D6 90\nwait 1',1],
    ['else\nwait 1',1],['end\nwait 1',1],['if button == HIGH\nwait 1',1],
    ['if button == HIGH\nelse\nelse\nend\nwait 1',3],
    ['write D2 HIGH',1],['',1],['window.alert("hello")\nwait 1',1],
  ])('reports an actionable line for %s',(source,line)=>{
    const result=compile(source,defaultWiring);
    expect(result.program).toBeNull();
    expect(result.errors.some(error=>error.line===line)).toBe(true);
  });
  it('bounds source length, line count, and nesting',()=>{
    for(const source of ['x'.repeat(16001),'wait 1\n'.repeat(301),
      'if button == HIGH\n'.repeat(9)+'wait 1\n'+'end\n'.repeat(9)]){
      expect(compile(source,defaultWiring).program).toBeNull();
    }
  });
});

describe('virtual controller execution',()=>{
  it('switches traffic lights at exact wait boundaries and repeats',()=>{
    const p=program(lessons[0].source);
    let vm=advanceController(p,initialController(),0,defaultInputs,defaultWiring);
    expect(vm.pins).toMatchObject({D2:1,D3:0,D4:0});
    vm=advanceController(p,vm,1999,defaultInputs,defaultWiring);
    expect(vm.pins.D2).toBe(1);
    vm=advanceController(p,vm,1,defaultInputs,defaultWiring);
    expect(vm.pins).toMatchObject({D2:0,D3:0,D4:1});
    vm=advanceController(p,vm,3000,defaultInputs,defaultWiring);
    expect(vm.pins).toMatchObject({D2:0,D3:1,D4:0});
    vm=advanceController(p,vm,1000,defaultInputs,defaultWiring);
    expect(vm.pins).toMatchObject({D2:1,D3:0,D4:0});
    expect(vm.time).toBe(6000);
  });
  it('has identical results regardless of playback chunk size',()=>{
    const p=program(lessons[0].source);
    let small=initialController(),large=initialController();
    for(let i=0;i<240;i++)small=advanceController(p,small,50,defaultInputs,defaultWiring);
    for(let i=0;i<12;i++)large=advanceController(p,large,1000,defaultInputs,defaultWiring);
    expect(small).toEqual(large);
  });
  it('opens and closes a servo door on the real sensor threshold',()=>{
    const p=program(lessons[1].source);
    let vm=advanceController(p,initialController(),0,{...defaultInputs,distance:34},defaultWiring);
    expect(vm.servos.D5).toBe(90);expect(vm.pins.D4).toBe(1);
    vm=advanceController(p,vm,50,{...defaultInputs,distance:35},defaultWiring);
    expect(vm.servos.D5).toBe(0);expect(vm.pins.D4).toBe(0);
  });
  it('handles nested branches and the obstacle detector button override',()=>{
    const p=program(lessons[2].source);
    let vm=advanceController(p,initialController(),0,{...defaultInputs,distance:20},defaultWiring);
    expect(vm.pins).toMatchObject({D2:1,D4:0});
    vm=advanceController(p,vm,50,{...defaultInputs,distance:20,button:1},defaultWiring);
    expect(vm.pins).toMatchObject({D2:0,D4:1});
    vm=advanceController(p,vm,50,{...defaultInputs,distance:30},defaultWiring);
    expect(vm.pins).toMatchObject({D2:0,D4:1});
  });
  it.each(['<','>','<=','>=','==','!='])('executes %s comparisons',(op)=>{
    const p=program(`if knob ${op} 100\nwrite D2 HIGH\nelse\nwrite D2 LOW\nend\nwait 1`);
    const expected:Record<string,boolean>={'<':false,'>':true,'<=':false,'>=':true,'==':false,'!=':true};
    const vm=advanceController(p,initialController(),0,{...defaultInputs,knob:101},defaultWiring);
    expect(vm.pins.D2).toBe(Number(expected[op]));
  });
  it('reads named inputs and their current pin mappings, including disconnected inputs',()=>{
    const wiring:Wiring={...defaultWiring,button:'D1',distance:'A1',knob:'A0'};
    const inputs:Inputs={button:1,distance:75,knob:987};
    const pins=initialController().pins;
    expect(readInput('button',inputs,wiring,pins)).toBe(1);
    expect(readInput('D1',inputs,wiring,pins)).toBe(1);
    expect(readInput('D0',inputs,wiring,pins)).toBe(0);
    expect(readInput('A1',inputs,wiring,pins)).toBe(75);
    expect(readInput('A0',inputs,wiring,pins)).toBe(987);
    expect(readInput('distance',inputs,{...wiring,distance:null},pins)).toBe(0);
    const p=program('if D1 == HIGH\nwrite D2 HIGH\nend\nwait 1',wiring);
    expect(advanceController(p,initialController(),0,inputs,wiring).pins.D2).toBe(1);
  });
  it('updates a rewired output rather than the original LED pin',()=>{
    const wiring={...defaultWiring,red:'D6' as const};
    const p=program('write D6 HIGH\nwait 1',wiring);
    const vm=advanceController(p,initialController(),0,defaultInputs,wiring);
    expect(vm.pins.D6).toBe(1);expect(vm.pins.D2).toBe(0);
  });
  it('does not mutate prior state, inputs, wiring, or compiled instructions',()=>{
    const p=program(lessons[1].source),vm=initialController();
    const before=JSON.stringify({p,vm,defaultInputs,defaultWiring});
    advanceController(p,vm,100,defaultInputs,defaultWiring);
    expect(JSON.stringify({p,vm,defaultInputs,defaultWiring})).toBe(before);
  });
  it('halts a non-yielding branch and bounds the event history',()=>{
    const bad=program('if button == HIGH\nwait 1\nend');
    const halted=advanceController(bad,initialController(),50,defaultInputs,defaultWiring);
    expect(halted.error).toMatch(/wait/);
    expect(advanceController(bad,halted,50,defaultInputs,defaultWiring)).toBe(halted);
    const blinking=program('write D2 HIGH\nwait 1\nwrite D2 LOW\nwait 1');
    const vm=advanceController(blinking,initialController(),100,defaultInputs,defaultWiring);
    expect(vm.trace).toHaveLength(80);expect(vm.error).toBeNull();
  });
  it.each([-1,NaN,Infinity,60001])('rejects invalid time steps (%s)',elapsed=>{
    expect(()=>advanceController(program('wait 1'),initialController(),elapsed,defaultInputs,defaultWiring)).toThrow();
  });
});

describe('project persistence and wiring validation',()=>{
  it('round-trips modified source and connections without storing execution state',()=>{
    const project=starterProject('door');project.source+='\n# my experiment';project.wiring.green='D6';
    const restored=parseProject(JSON.parse(JSON.stringify({...project,untrustedExtra:true})));
    expect(restored).toEqual(project);expect(restored).not.toHaveProperty('untrustedExtra');
  });
  it('keeps a code draft if its project name was cleared',()=>{
    const project={...starterProject(),name:'',source:'wait 100'};
    expect(parseProject(project)).toMatchObject({name:'Untitled robotics project',source:'wait 100'});
  });
  it.each([null,{}, {version:2,lab:'robotics'}, {...starterProject(),lab:'signal'},
    {...starterProject(),wiring:{...defaultWiring,red:'A0'}},
    {...starterProject(),wiring:{...defaultWiring,button:'D9'}},
    {...starterProject(),wiring:{}}, {...starterProject(),source:'x'.repeat(16001)},
  ])('rejects malformed or unrelated imports',value=>expect(()=>parseProject(value)).toThrow());
  it('detects input and servo conflicts while allowing digital output fan-out',()=>{
    expect(wiringErrors(defaultWiring)).toEqual([]);
    expect(wiringErrors({...defaultWiring,red:'D0'})).toHaveLength(1);
    expect(wiringErrors({...defaultWiring,red:'D5'})).toHaveLength(1);
    expect(wiringErrors({...defaultWiring,distance:'A1'})).toHaveLength(1);
    expect(wiringErrors({...defaultWiring,red:'D4'})).toEqual([]);
  });
});
