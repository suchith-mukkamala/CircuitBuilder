import {describe,expect,it} from 'vitest';
import {starterCircuit,rcCircuit} from '../circuit/sample';
import {solveDC} from '../simulation/dc';
import {runTransient} from '../simulation/transient';
import {circuitNodes} from '../circuit/connectivity';
import {analogMeasurement} from './measurements';
import {transientPlot} from './transientPlot';
import {fitAnalogCircuit} from './viewport';
describe('point and component measurements',()=>{
  it('measures the same 5 V node at a terminal and anywhere on its wire',()=>{
    const doc=starterCircuit(),result=solveDC(doc);
    const terminal=analogMeasurement(doc,result,{kind:'terminal',componentId:'r2',pin:'a'})!;
    const wire=analogMeasurement(doc,result,{kind:'wire',id:'w2'})!;
    expect(terminal.voltage).toBeCloseTo(5);expect(wire.voltage).toBeCloseTo(5);
    expect(wire.node).toBe(terminal.node);expect(wire.terminals).toHaveLength(2);
    const ground=analogMeasurement(doc,result,{kind:'terminal',componentId:'g1',pin:'g'})!;
    expect(ground.voltage).toBe(0);
  });
  it('distinguishes node voltage from signed voltage, current, and power across a component',()=>{
    const doc=starterCircuit(),result=solveDC(doc);
    const r1=analogMeasurement(doc,result,{kind:'component',id:'r1'})!;
    expect(r1.kind).toBe('branch');expect(r1.voltage).toBeUndefined();
    expect(r1.reading?.voltage).toBeCloseTo(5);expect(r1.reading?.current).toBeCloseTo(.005);
    expect(r1.reading?.power).toBeCloseTo(.025);
    expect(analogMeasurement(doc,result,{kind:'component',id:'v1'})?.reading?.power).toBeLessThan(0);
  });
  it('does not display stale values after edits or measurements at removed targets',()=>{
    const doc=starterCircuit();
    expect(analogMeasurement(doc,null,{kind:'terminal',componentId:'r2',pin:'a'})?.voltage).toBeUndefined();
    expect(analogMeasurement(doc,null,{kind:'wire',id:'missing'})).toBeNull();
    expect(analogMeasurement(doc,null,{kind:'terminal',componentId:'r2',pin:'w'})).toBeNull();
  });
  it('keeps crossing wires on different nets when no junction connects them',()=>{
    const doc=starterCircuit();
    doc.wires=[...doc.wires,{id:'free',from:{x:400,y:100},to:{x:400,y:230}}];
    const nodes=circuitNodes(doc,{allowIncomplete:true});
    expect(analogMeasurement(doc,null,{kind:'wire',id:'free'},nodes)?.node)
      .not.toBe(analogMeasurement(doc,null,{kind:'wire',id:'w2'},nodes)?.node);
  });
  it('follows the selected transient frame instead of reporting a DC endpoint',()=>{
    const doc=rcCircuit(),result=runTransient(doc,{duration:.5,steps:240});
    const first=analogMeasurement(doc,result.frames[0],{kind:'terminal',componentId:'r2',pin:'a'})!;
    const last=analogMeasurement(doc,result.frames.at(-1)!,{kind:'terminal',componentId:'r2',pin:'a'})!;
    expect(first.voltage).toBeCloseTo(0);expect(last.voltage!).toBeGreaterThan(9.8);
    const plots=transientPlot(result,['v1','r2'],'voltage');
    expect(plots.series).toHaveLength(2);expect(plots.min).toBe(0);expect(plots.max).toBe(10);
    expect(plots.x(0)).toBe(52);expect(plots.x(240)).toBe(342);
    expect(plots.series.every(series=>!series.path.includes('NaN'))).toBe(true);
    expect(transientPlot(result,['r2'],'voltage',{min:-2,max:12})).toMatchObject({min:-2,max:12});
  });
  it('fits the analog circuit and pins in desktop and phone viewports',()=>{
    const doc=starterCircuit();
    for(const size of [{width:780,height:600},{width:360,height:440}]){
      const view=fitAnalogCircuit(doc,size);
      for(const c of doc.components){expect(c.x*view.zoom+view.x).toBeGreaterThan(0);expect(c.x*view.zoom+view.x).toBeLessThan(size.width);}
    }
    expect(fitAnalogCircuit({...doc,components:[],wires:[]},{width:0,height:0}).zoom).toBe(1);
  });
});
