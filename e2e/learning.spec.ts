import {test,expect,type Page,type Locator} from '@playwright/test';
import {starterCircuit,rcCircuit} from '../src/circuit/sample';
import {halfAdderDemo} from '../src/digital/samples';
import {pinPosition} from '../src/circuit/types';
import {pinAt} from '../src/digital/types';
import {programmableCpuDemo} from '../src/digital/computerSamples';
import {digitalBusPath} from '../src/digital/network';

async function clickWorld(canvas:Locator,point:{x:number;y:number}){
  await canvas.scrollIntoViewIfNeeded();
  const transform=await canvas.evaluate(element=>({x:Number((element as HTMLElement).dataset.viewX),y:Number((element as HTMLElement).dataset.viewY),zoom:Number((element as HTMLElement).dataset.viewZoom)}));
  await canvas.click({position:{x:transform.x+point.x*transform.zoom,y:transform.y+point.y*transform.zoom}});
}
async function loadLesson(page:Page,lab:string){
  await page.goto('/#'+lab);
  await page.locator('.guided-project>summary').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Load lesson circuit',exact:true}).click();
}

test('analog point voltages, differential reference, component readings, and stale results',async({page})=>{
  await page.goto('/#analog');await page.getByRole('button',{name:/RUN DC/}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-circuits-v01')!).state.document.wires.length);
  await page.getByRole('button',{name:/Inspect points/}).click();
  const canvas=page.getByLabel('Interactive circuit editor');
  const doc=starterCircuit();
  await clickWorld(canvas,pinPosition(doc.components.find(c=>c.id==='r2')!,'a'));
  const readout=page.getByRole('region',{name:'Point measurements'});
  await expect(readout).toContainText('5 V');await expect(readout).toContainText('R2 · A');
  await page.getByRole('button',{name:'Use as reference',exact:true}).click();
  await clickWorld(canvas,pinPosition(doc.components.find(c=>c.id==='g1')!,'g'));
  await expect(readout).toContainText('-5 V');await expect(readout).toContainText('Reference: R2 · A');
  await page.getByRole('button',{name:'Use ground',exact:true}).click();
  await clickWorld(canvas,{x:336,y:168});
  await expect(readout).toContainText('5 mA');await expect(readout).toContainText('25 mW');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-circuits-v01')!).state.document.wires.length)).toBe(before);
  await page.getByRole('button',{name:/Edit & wire/}).click();
  await clickWorld(canvas,{x:336,y:168});
  await page.getByRole('button',{name:/Close point measurements/}).click();
  await page.getByRole('tab',{name:/INSPECT/}).click();
  const value=page.getByLabel('RESISTANCE (OHMS)');await value.fill('2k');await value.press('Tab');
  await page.getByRole('button',{name:/Inspect points/}).click();
  await clickWorld(canvas,pinPosition(doc.components.find(c=>c.id==='r2')!,'a'));
  await expect(readout).toContainText('No current result');await expect(readout.locator('dd')).toHaveCount(0);
});

test('transient comparison, manual axes, expanded graph, and point readings share one time cursor',async({page})=>{
  await page.goto('/#analog');
  await page.locator('.topbar input[type=file]').setInputFiles({name:'rc.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rcCircuit()))});
  await page.getByRole('button',{name:/RLC/}).click();
  await page.getByLabel('TIME WINDOW (ms)').fill('500');
  await page.getByRole('button',{name:'▶ RUN TRANSIENT',exact:true}).click();
  await page.getByLabel('Primary trace',{exact:true}).selectOption('r2');
  await page.getByLabel('Compare trace',{exact:true}).selectOption('v1');
  await expect(page.locator('.scope-trace-values').first()).toContainText('C1');
  await expect(page.locator('.scope-trace-values').first()).toContainText('V1');
  await page.getByLabel('Auto-scale vertical axis').uncheck();
  await page.getByRole('spinbutton',{name:'Y maximum',exact:true}).fill('12');
  await page.getByRole('button',{name:/Expand graph/}).click();
  const expanded=page.getByRole('dialog',{name:'Expanded transient graph'});await expect(expanded).toBeVisible();
  await page.getByRole('slider',{name:'Expanded simulation time'}).press('End');
  await expect(expanded).toContainText('500 ms');
  await page.getByRole('button',{name:'Close expanded graph'}).click();
  await page.getByRole('button',{name:/Inspect points/}).click();
  const canvas=page.getByLabel('Interactive circuit editor');
  await clickWorld(canvas,pinPosition(rcCircuit().components.find(c=>c.id==='r2')!,'a'));
  const readout=page.getByRole('region',{name:'Point measurements'});await expect(readout).toContainText('TRANSIENT · 500 ms');
  expect(parseFloat((await readout.locator('dd').innerText()).replace(' V',''))).toBeGreaterThan(9.8);
  await page.getByRole('slider',{name:'Simulation time',exact:true}).press('Home');
  await expect(readout.locator('dd')).toHaveText('0 V');
  const graph=page.locator('.panel-content>.transient-plot');await graph.scrollIntoViewIfNeeded();
  const bounds=(await graph.boundingBox())!;await graph.click({position:{x:bounds.width*.6,y:bounds.height*.5}});
  await expect(readout.locator('dd')).not.toHaveText('0 V');
});

test('guided divider completes from real measurements and a changed resistance',async({page})=>{
  await loadLesson(page,'analog');await page.locator('.guided-project').getByRole('button',{name:'Run DC',exact:true}).click();
  await page.getByRole('button',{name:/Inspect points/}).click();
  await clickWorld(page.getByLabel('Interactive circuit editor'),{x:528,y:240});
  await expect(page.locator('.guided-project li.is-complete')).toHaveCount(3);
  await page.getByRole('button',{name:'Close point measurements'}).click();
  await page.getByRole('button',{name:'Select R2',exact:true}).click();
  const input=page.getByLabel('RESISTANCE (OHMS)');await input.fill('2k');await input.press('Tab');
  await page.locator('.guided-project').getByRole('button',{name:'Run DC',exact:true}).click();
  await expect(page.locator('.guided-project .lesson-complete')).toBeVisible();
});

test('half-adder truth-table rows drive the circuit and inspect mode preserves input values',async({page})=>{
  await loadLesson(page,'signal');await page.getByRole('button',{name:/GENERATE TRUTH TABLE/}).click();
  for(const vector of ['00','01','10','11'])await page.getByRole('button',{name:'Apply inputs '+vector,exact:true}).click();
  await expect(page.locator('.truth-row-current')).toContainText('Apply');
  await expect(page.locator('.guided-project .lesson-complete')).toBeVisible();
  await page.getByRole('button',{name:/Inspect points/}).click();
  const canvas=page.getByLabel('Digital logic schematic editor');
  await page.getByRole('button',{name:'⊡ FIT',exact:true}).click();
  const half=halfAdderDemo();await clickWorld(canvas,pinAt(half.components.find(c=>c.id==='xor')!,'out'));
  const readout=page.getByRole('region',{name:'Signal point states'});await expect(readout).toContainText('LOW · 0');
  await page.getByRole('button',{name:'Record waveform',exact:true}).click();
  await expect(page.locator('.signal-scope-panel')).toBeVisible();
  await page.getByRole('button',{name:'Close signal point states'}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document.components.filter((c:{kind:string})=>c.kind==='input').map((c:{bit:number})=>c.bit));
  await clickWorld(canvas,half.components.find(c=>c.id==='a')!);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document.components.filter((c:{kind:string})=>c.kind==='input').map((c:{bit:number})=>c.bit))).toEqual(before);
});

test('guided CPU explains the executed instructions and preserves the source draft boundary',async({page})=>{
  await loadLesson(page,'computer');
  const step=page.getByRole('button',{name:'↯ STEP INSTRUCTION',exact:true});
  await step.click();await expect(page.getByRole('region',{name:'Instruction explanation'})).toContainText('Loaded 3 into ACC');
  await step.click();await expect(page.getByRole('region',{name:'Instruction explanation'})).toContainText('ACC 3 → 8');
  await expect(page.locator('.cpu-datapath-blocks .is-used')).toHaveCount(3);
  await step.click();await expect(page.getByRole('region',{name:'Instruction explanation'})).toContainText('Copied ACC 8 to OUT');
  await step.click();await expect(page.locator('.guided-project .lesson-complete')).toBeVisible();
  await page.getByRole('textbox',{name:'CASM assembly source'}).fill('LDI 7\nOUT\nHLT');
  await expect(page.locator('.casm-line-gutter .is-next-instruction')).toHaveCount(0);
  await expect(page.locator('.casm-injection-state')).toContainText('DRAFT NOT INJECTED');
});

test('project copies reopen independently and computer copies retain un-injected drafts',async({page})=>{
  await page.goto('/#computer');await page.locator('summary[aria-label="Project actions"]').click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:/LOAD PROGRAMMABLE CASM CPU/}).click();
  const source=page.getByRole('textbox',{name:'CASM assembly source'});await source.fill('LDI 9\nOUT\nHLT');
  await page.getByRole('button',{name:'▣ Projects',exact:true}).click();
  const shelf=page.getByRole('dialog',{name:'Saved projects'});await expect(shelf).toBeVisible();
  await page.getByLabel('Project copy name').fill('My saved CPU');await page.getByRole('button',{name:'Save new copy',exact:true}).click();
  await expect(shelf).toContainText('Saved “My saved CPU”');await page.getByRole('button',{name:'Close saved projects'}).click();
  await source.fill('LDI 2\nOUT\nHLT');
  await page.getByRole('button',{name:'▣ Projects',exact:true}).click();page.once('dialog',dialog=>dialog.accept());
  await shelf.getByRole('button',{name:'Open',exact:true}).click();
  await page.getByRole('tab',{name:/CODE STUDIO/}).click();await expect(source).toHaveValue('LDI 9\nOUT\nHLT');
  await expect(page.locator('.casm-injection-state')).toContainText('DRAFT NOT INJECTED');
  await page.getByRole('button',{name:'▣ Projects',exact:true}).click();page.once('dialog',dialog=>dialog.accept());
  await shelf.getByRole('button',{name:'Delete',exact:true}).click();await expect(shelf.locator('article')).toHaveCount(0);
});

test('full browser storage keeps editing available and reports the failed save',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#analog');const name=page.getByRole('textbox',{name:'Circuit name',exact:true});await name.fill('My unsaved circuit');
  await page.getByRole('button',{name:/RUN DC/}).click();await expect(page.locator('.editor-foot')).toContainText('SIMULATION READY');
  await page.getByRole('button',{name:'▣ Projects',exact:true}).click();await page.getByRole('button',{name:'Save new copy',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Saved projects'})).toContainText('Could not save');
  await page.getByRole('button',{name:'Close saved projects'}).click();
  await expect(page.getByRole('status',{name:'Project save status'})).not.toContainText('Saved in this browser');
  expect(errors).toEqual([]);
});

test('desktop panels resize by keyboard and retain their widths',async({page},testInfo)=>{
  test.skip(testInfo.project.name==='phone','Phone panels stack rather than resize horizontally.');
  await page.goto('/#analog');const resizer=page.getByRole('separator',{name:'Resize instrument panel'});
  await resizer.focus();await resizer.press('ArrowLeft');await expect(resizer).toHaveAttribute('aria-valuenow','336');
  await page.reload();await expect(resizer).toHaveAttribute('aria-valuenow','336');
});

test('computer buses expose their actual bits and unsigned word',async({page})=>{
  await page.goto('/#computer');await page.locator('summary[aria-label="Project actions"]').click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:/LOAD PROGRAMMABLE CASM CPU/}).click();
  await page.getByRole('tab',{name:'▣ HARDWARE',exact:true}).click();
  await page.getByRole('button',{name:/Inspect points/}).click();
  const doc=programmableCpuDemo(),bus=doc.buses!.find(b=>b.id==='pcBus')!;
  const path=digitalBusPath(doc,bus);
  const segments=path.slice(1).map((point,i)=>({a:path[i],b:point,length:Math.hypot(point.x-path[i].x,point.y-path[i].y)}));
  const segment=segments.sort((a,b)=>b.length-a.length)[0];
  await clickWorld(page.getByLabel('Digital logic schematic editor'),{x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2});
  const readout=page.getByRole('region',{name:'Signal point states'});
  await expect(readout).toContainText('Bits [3:0]');await expect(readout).toContainText('0000');await expect(readout).toContainText('0 / 0x0');
  await page.getByRole('button',{name:'Close signal point states'}).click();
  await page.getByRole('button',{name:/STEP$/,exact:false}).click();
  await clickWorld(page.getByLabel('Digital logic schematic editor'),{x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2});
  await expect(readout).toContainText('0001');await expect(readout).toContainText('1 / 0x1');
});
