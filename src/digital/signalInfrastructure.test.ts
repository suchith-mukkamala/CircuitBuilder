import {beforeEach,describe,expect,it} from 'vitest';
import type {DigitalBus,DigitalComponent,DigitalDocument,DigitalWire} from './types';
import {busGroups,isDigitalDocument,pinsOf,digitalId} from './types';
import {buildSignalNetwork,digitalBusPath,digitalWirePath,routeDigitalPoints} from './network';
import {simulateLogic} from './engine';
import {diagnoseDigitalCircuit} from './diagnostics';
import {captureBlock} from './blocks';
import {useDigitalStore} from './useDigitalStore';

const component=(id:string,kind:DigitalComponent['kind'],x:number,y:number,bit?:0|1):
  DigitalComponent=>({id,kind,x,y,rotation:0,...(bit!==undefined?{bit}:{})});
const terminal=(componentId:string,pin:string)=>({componentId,pin});
const wire=(id:string,a:string,pa:string,b:string,pb:string):DigitalWire=>({
  id,from:terminal(a,pa),to:terminal(b,pb),
});
const bus=(id:string,a:string,fromPrefix:string,b:string,toPrefix:string,
  width:4|8|16=4,label?:string):DigitalBus=>({
    id,width,label,
    from:{componentId:a,pins:Array.from({length:width},(_,i)=>fromPrefix+i)},
    to:{componentId:b,pins:Array.from({length:width},(_,i)=>toPrefix+i)},
  });
const word=(doc:DigitalDocument,partId:string,prefix:string):number=>{
  const t=simulateLogic(doc).terminalValues;
  let value=0;
  for(let i=0;i<4;i++){
    const bit=t[partId+':'+prefix+i];
    if(bit!==0&&bit!==1)throw Error('Expected a binary bus bit, got '+bit);
    value|=bit<<i;
  }
  return value;
};
const demo=():DigitalDocument=>{
  const bits=[1,0,1,1] as const;
  return {
    version:1,lab:'signal',name:'Four-bit bus demo',
    components:[
      ...bits.map((bit,i)=>component('in'+i,'input',90,80+i*90,bit)),
      component('split','splitter4',360,220),
      component('alu','alu4',790,300),
      component('zero','low',400,600),
      component('out','led',1090,280),
    ],
    wires:[
      ...bits.map((_,i)=>wire('source'+i,'in'+i,'out','split','bus'+i)),
      ...['b0','b1','b2','b3','op0','op1'].map((pin,i)=>
        wire('const'+i,'zero','out','alu',pin)),
      wire('monitor','alu','y0','out','in'),
    ],
    buses:[bus('main','split','bit','alu','a')],
  };
};

describe('real multi-bit electrical nets',()=>{
  it('connects four independent digital bits from a splitter into an ALU',()=>{
    const doc=demo();
    expect(isDigitalDocument(doc)).toBe(true);
    expect(doc.buses?.[0].width).toBe(4);
    expect(word(doc,'alu','a')).toBe(13);
    expect(word(doc,'alu','y')).toBe(13);
    expect(simulateLogic(doc).ledValues.out).toBe(1);
    const nets=buildSignalNetwork(doc);
    expect(new Set([0,1,2,3].map(i=>nets.terminals['alu:a'+i])).size).toBe(4);
  });
  it('gives 4/8/16-bit splitters passive bit-to-bit connections',()=>{
    for(const width of [4,8,16] as const){
      const part=component('s','splitter'+width as DigitalComponent['kind'],300,300);
      expect(busGroups(part).map(g=>g.width)).toEqual([width,width]);
      expect(pinsOf(part)).toHaveLength(width*2);
      const doc:DigitalDocument={version:1,lab:'signal',name:'taps',
        components:[part],wires:[]};
      expect(isDigitalDocument(doc)).toBe(true);
      const nets=buildSignalNetwork(doc);
      for(let i=0;i<width;i++){
        expect(nets.terminals['s:bus'+i]).toBe(nets.terminals['s:bit'+i]);
      }
      expect(new Set(Array.from({length:width},(_,i)=>nets.terminals['s:bus'+i])).size)
        .toBe(width);
    }
  });
  it('joins identically named buses bit-for-bit across distant parts',()=>{
    const doc=demo();
    doc.components.push(component('bridge','splitter4',1100,680),
      component('tap','splitter4',1250,680));
    doc.buses=[
      bus('one','split','bit','bridge','bus',4,'DATA'),
      bus('two','tap','bit','alu','a',4,'DATA'),
    ];
    expect(isDigitalDocument(doc)).toBe(true);
    expect(word(doc,'alu','a')).toBe(13);
    const networks=buildSignalNetwork(doc);
    for(let i=0;i<4;i++)
      expect(networks.terminals['bridge:bus'+i]).toBe(networks.terminals['tap:bit'+i]);
  });
  it('named 1-bit wires join electrically without physically meeting',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'Named nets',
      components:[component('v','high',96,96),component('out','led',740,420)],
      wires:[
        {id:'left',from:terminal('v','out'),to:{x:144,y:96}},
        {id:'right',from:{x:700,y:420},to:terminal('out','in')},
      ]};
    expect(simulateLogic(doc).ledValues.out).toBe('Z');
    doc.wires[0].label='RESET';
    doc.wires[1].label='RESET';
    expect(isDigitalDocument(doc)).toBe(true);
    expect(simulateLogic(doc).ledValues.out).toBe(1);
    expect(buildSignalNetwork(doc).wires.left).toBe(buildSignalNetwork(doc).wires.right);
    expect(isDigitalDocument({...doc,wires:[{...doc.wires[0],label:'bad name'},doc.wires[1]]}))
      .toBe(false);
  });
  it('rejects invalid bus pin counts and malformed imported bus groups',()=>{
    const doc=demo();
    const invalid=(bus:DigitalBus):DigitalDocument=>({...doc,buses:[bus]});
    expect(isDigitalDocument(invalid({...doc.buses![0],width:8}))).toBe(false);
    expect(isDigitalDocument(invalid({...doc.buses![0],
      from:{componentId:'split',pins:['bus0','bus1','bus2','bus3']}}))).toBe(true);
    expect(isDigitalDocument(invalid({...doc.buses![0],
      from:{componentId:'split',pins:['bus0','bus0','bus2','bus3']}}))).toBe(false);
    expect(isDigitalDocument(invalid({...doc.buses![0],
      to:{componentId:'alu',pins:['op0','op1','b0','b1']}}))).toBe(false);
  });
  it('preserves bus definitions and named wires inside a captured block',()=>{
    const doc=demo();
    doc.components.push(component('result','led',1200,470));
    doc.wires.push(wire('out2','alu','y1','result','in'));
    doc.wires[0].label='SRC_0';
    const {definition,condensed}=captureBlock(doc,'ALU BUS MODULE');
    expect(definition.circuit.buses).toHaveLength(1);
    expect(definition.circuit.buses![0].width).toBe(4);
    expect(definition.circuit.wires[0].label).toBe('SRC_0');
    expect(isDigitalDocument(condensed)).toBe(true);
  });
  it('mere wire/bus crossings do not short unrelated nets',()=>{
    const doc=demo();
    const before=word(doc,'alu','y');
    doc.wires.push({id:'stray',from:{x:650,y:180},to:{x:650,y:500}});
    expect(word(doc,'alu','y')).toBe(before);
  });
});

describe('live structural diagnostics',()=>{
  it('detects unconnected clocks and missing data sources with locations',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'Issues',
      components:[component('ff','dff',320,220)],wires:[]};
    const issues=diagnoseDigitalCircuit(doc);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({code:'FLOATING_CLOCK',severity:'error',componentId:'ff'}),
      expect.objectContaining({code:'FLOATING_INPUT',componentId:'ff'}),
    ]));
  });
  it('detects driver collisions created by distant matching net labels',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'Conflict',
      components:[component('a','high',0,50),component('b','low',0,350)],
      wires:[
        {id:'wa',label:'CLK',from:terminal('a','out'),to:{x:100,y:50}},
        {id:'wb',label:'CLK',from:terminal('b','out'),to:{x:100,y:350}},
      ]};
    expect(diagnoseDigitalCircuit(doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({code:'DRIVER_CONFLICT',severity:'error'}),
    ]));
  });
  it('reports wrong named bus widths rather than silently joining signals',()=>{
    const doc=demo();
    doc.components.push(component('s8','splitter8',400,850));
    doc.components.push(component('t8','splitter8',1000,850));
    doc.buses![0].label='DATA';
    doc.buses!.push(bus('extra','s8','bit','t8','bus',8,'DATA'));
    expect(isDigitalDocument(doc)).toBe(true);
    expect(diagnoseDigitalCircuit(doc).some(i=>i.code==='BUS_WIDTH_MISMATCH')).toBe(true);
    doc.wires[0].label='DATA';
    expect(diagnoseDigitalCircuit(doc).some(i=>i.code==='SCALAR_BUS_NAME')).toBe(true);
  });
  it('detects feedback through combinational logic but not clocked storage',()=>{
    const loop:DigitalDocument={version:1,lab:'signal',name:'loop',
      components:[component('n','not',300,240)],
      wires:[wire('loop','n','out','n','a')]};
    expect(diagnoseDigitalCircuit(loop).some(i=>i.code==='FEEDBACK_LOOP')).toBe(true);
    loop.components[0].kind='dff';
    loop.wires[0]=wire('loop','n','q','n','d');
    expect(diagnoseDigitalCircuit(loop).some(i=>i.code==='FEEDBACK_LOOP')).toBe(false);
  });
});

describe('routing and undoable editor actions',()=>{
  beforeEach(()=>{
    useDigitalStore.setState({
      document:demo(),past:[],future:[],editStack:[],pending:null,pendingBus:null,
      selectedIds:[],selection:null,dragOrigin:null,
    });
  });
  it('chooses a Manhattan route around obstacles and supports waypoint overrides',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'route',
      components:[component('obstacle','and',240,0)],wires:[]};
    const from={x:0,y:0},to={x:240,y:120};
    const auto=routeDigitalPoints(doc,from,to);
    expect(auto[0]).toEqual(from);
    expect(auto.at(-1)).toEqual(to);
    for(let i=1;i<auto.length;i++)
      expect(auto[i].x===auto[i-1].x||auto[i].y===auto[i-1].y).toBe(true);
    expect(auto).not.toContainEqual({x:240,y:0});
    const manual=routeDigitalPoints(doc,from,to,[],[{x:120,y:84}]);
    expect(manual).toContainEqual({x:120,y:84});
  });
  it('creates a bus from actual chip pin groups with matching widths',()=>{
    const store=useDigitalStore.getState();
    const doc=store.document,source=doc.components.find(c=>c.id==='split')!;
    const target=doc.components.find(c=>c.id==='alu')!;
    const first=busGroups(source).find(g=>g.direction==='out')!;
    const second=busGroups(target).find(g=>g.title==='B[3:0]')!;
    store.startBus(first);
    expect(useDigitalStore.getState().pendingBus?.width).toBe(4);
    store.finishBus(second);
    expect(useDigitalStore.getState().document.buses).toHaveLength(2);
    expect(useDigitalStore.getState().pendingBus).toBeNull();
    store.undo();
    expect(useDigitalStore.getState().document.buses).toHaveLength(1);
    store.redo();
    expect(useDigitalStore.getState().document.buses).toHaveLength(2);
  });
  it('preserves a pending bus if target widths mismatch and allows ESC cancel',()=>{
    const store=useDigitalStore.getState();
    store.add('splitter8',{x:1100,y:680});
    const source=useDigitalStore.getState().document.components.find(c=>c.id==='split')!;
    const target=useDigitalStore.getState().document.components.find(c=>c.kind==='splitter8')!;
    store.startBus(busGroups(source)[0]);
    store.finishBus(busGroups(target)[0]);
    expect(useDigitalStore.getState().pendingBus?.width).toBe(4);
    expect(useDigitalStore.getState().message).toMatch(/mismatch/);
    store.cancelWire();
    expect(useDigitalStore.getState().pendingBus).toBeNull();
  });
  it('renames scalar wires, rejects invalid names, and can rename buses',()=>{
    const store=useDigitalStore.getState();
    store.setWireLabel('source0','CLK');
    expect(useDigitalStore.getState().document.wires[0].label).toBe('CLK');
    store.setWireLabel('source0','BAD SPACE');
    expect(useDigitalStore.getState().document.wires[0].label).toBe('CLK');
    store.setBusLabel('main','DATA');
    expect(useDigitalStore.getState().document.buses?.[0].label).toBe('DATA');
    expect(isDigitalDocument(useDigitalStore.getState().document)).toBe(true);
  });
  it('supports manual route corners, smart restore, and deleting a selected bus',()=>{
    const store=useDigitalStore.getState();
    store.setBend('bus','main',{x:610,y:180});
    expect(useDigitalStore.getState().document.buses?.[0].waypoints)
      .toEqual([{x:612,y:180}]);
    const path=digitalBusPath(useDigitalStore.getState().document,
      useDigitalStore.getState().document.buses![0]);
    expect(path.length).toBeGreaterThan(2);
    store.autoRoute('bus','main');
    expect(useDigitalStore.getState().document.buses?.[0].waypoints).toEqual([]);
    store.select({type:'bus',id:'main'});
    store.remove();
    expect(useDigitalStore.getState().document.buses).toHaveLength(0);
    store.undo();
    expect(useDigitalStore.getState().document.buses).toHaveLength(1);
  });
  it('copies buses between selected components without preserving cross-short labels',()=>{
    const store=useDigitalStore.getState();
    store.setBusLabel('main','DATA');
    store.selectAll();
    store.copy();
    store.paste();
    const doc=useDigitalStore.getState().document;
    expect(doc.buses).toHaveLength(2);
    expect(doc.buses?.[1].label).toBeUndefined();
    expect(isDigitalDocument(doc)).toBe(true);
  });
  it('keeps its format portable across JSON serialization',()=>{
    const doc=useDigitalStore.getState().document;
    expect(isDigitalDocument(JSON.parse(JSON.stringify(doc)))).toBe(true);
    expect(digitalWirePath(doc,doc.wires[0]).length).toBeGreaterThan(1);
    expect(digitalBusPath(doc,doc.buses![0]).length).toBeGreaterThan(1);
    expect(digitalId()).toMatch(/^[a-z0-9]+$/);
  });
});
