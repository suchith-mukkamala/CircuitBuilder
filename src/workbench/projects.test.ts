import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseSavedProjects} from './projects';
import {starterCircuit} from '../circuit/sample';
import {programmableCpuDemo} from '../digital/computerSamples';
import {browserStorage} from './browserStorage';
afterEach(()=>vi.unstubAllGlobals());
const item={id:'experiment',name:'My circuit',savedAt:'2026-11-14T12:00:00Z',snapshot:{document:starterCircuit()}};
describe('named local project copies',()=>{
  it('round-trips independent documents and CASM drafts',()=>{
    const copy=parseSavedProjects(JSON.parse(JSON.stringify([item])),'analog')[0];
    copy.snapshot.document.name='Changed';expect(item.snapshot.document.name).not.toBe('Changed');
    const computer={...item,snapshot:{document:programmableCpuDemo(),drafts:{rom:'LDI 7\nOUT\nHLT'}}};
    expect(parseSavedProjects([computer],'computer')[0].snapshot.drafts?.rom).toContain('LDI 7');
  });
  it('rejects unrelated lab formats, malformed records, and oversized shelves',()=>{
    for(const value of [null,{},[{...item,savedAt:'invalid'}],Array(13).fill(item),[{...item,snapshot:{document:{}}}]])
      expect(()=>parseSavedProjects(value,'analog')).toThrow();
    expect(()=>parseSavedProjects([item],'signal')).toThrow();
    expect(()=>parseSavedProjects([{...item,snapshot:{document:programmableCpuDemo(),drafts:{rom:12}}}],'computer')).toThrow();
  });
  it('keeps editing available when storage is blocked or full',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('quota');},removeItem:()=>{throw new Error('blocked');}});
    expect(browserStorage.getItem('draft')).toBeNull();
    expect(()=>browserStorage.setItem('draft','data')).not.toThrow();
    expect(()=>browserStorage.removeItem('draft')).not.toThrow();
  });
});
