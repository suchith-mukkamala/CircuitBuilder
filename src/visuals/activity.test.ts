import {describe,expect,it} from 'vitest';
import {activityDuration,activityOpacity,recordActivity} from './activity';
describe('presentation-only state-change activity',()=>{
  it('does not animate a static initial circuit or repeat an unchanged value',()=>{
    const initial={'wire:w1':1,'part:clock':'0:0'};
    expect(recordActivity(null,initial,100,new Map()).size).toBe(0);
    expect(recordActivity(initial,{...initial},200,new Map()).size).toBe(0);
  });
  it('records falling edges and clock cycles, expires activity, and leaves inputs immutable',()=>{
    const before={'wire:w1':1,'part:clock':'0:0'},after={'wire:w1':0,'part:clock':'0:1'};
    const existing=new Map([['deleted',10]]),snapshot=JSON.stringify({before,after});
    const events=recordActivity(before,after,100,existing);
    expect([...events.keys()]).toEqual(['wire:w1','part:clock']);
    expect(existing.has('deleted')).toBe(true);expect(JSON.stringify({before,after})).toBe(snapshot);
    expect(activityOpacity(events.get('wire:w1'),100)).toBe(1);
    expect(activityOpacity(events.get('wire:w1'),100+activityDuration)).toBe(0);
    expect(recordActivity(after,after,100+activityDuration,events).size).toBe(0);
  });
});
