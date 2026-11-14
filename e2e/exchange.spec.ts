import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {packageCurrentCircuit} from '../src/bridges/modulePackages';
import {andDemo} from '../src/digital/samples';

const exchange=(page:Page)=>page.getByRole('dialog',{name:'Parts Exchange',exact:true});
const pin=(page:Page,name:string)=>page.locator('.robotics-pin-monitor>div').filter({has:page.getByText(name,{exact:true})});
async function openExchange(page:Page){await page.getByRole('button',{name:'↗ Parts Exchange',exact:true}).click();await expect(exchange(page)).toBeVisible();}
async function publish(page:Page,name:string){await openExchange(page);await page.getByLabel('Shared module name').fill(name);await page.getByRole('button',{name:'Publish module',exact:true}).click();await expect(exchange(page)).toContainText('Published a snapshot');}
async function enableGate(page:Page){
  await page.goto('/#signal');await openExchange(page);await page.getByRole('button',{name:'Connected projects',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Open enable-gate project →',exact:true}).click();
  await expect(exchange(page)).toHaveCount(0);
}
async function uploadAndPause(page:Page){await page.getByRole('button',{name:/Upload & run/}).click();await page.getByRole('button',{name:/Pause/}).click();}

test('an ALU made in Signals becomes the actual computer datapath ALU',async({page})=>{
  await page.goto('/#signal');await openExchange(page);await page.getByRole('button',{name:'Connected projects',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Open ALU workshop →',exact:true}).click();
  await expect.poll(async()=>Number(await page.getByLabel('Digital logic schematic editor').getAttribute('data-view-zoom'))).toBeLessThan(1);
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document);
  await publish(page,'My four-bit ALU');
  await page.getByRole('spinbutton',{name:'Operand A',exact:true}).fill('3');await page.getByRole('spinbutton',{name:'Operand B',exact:true}).fill('5');
  await expect(exchange(page).locator('.exchange-tester>p')).toContainText('Unsigned 8');
  await page.getByLabel('ALU operation').selectOption('3');await expect(exchange(page).locator('.exchange-tester>p')).toContainText('Unsigned 6');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document)).toEqual(original);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Build computer with this ALU',exact:true}).click();
  await expect(page).toHaveURL(/#computer$/);await expect(page.getByRole('textbox',{name:'Computer circuit name'})).toHaveValue('Computer datapath · My four-bit ALU');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state);
  expect(state.document.components.find((c:{id:string})=>c.id==='alu').kind).toBe('block');
  expect(state.document.components.some((c:{kind:string})=>c.kind==='alu4')).toBe(false);expect(state.signalDocument).toEqual(original);
  await page.getByRole('button',{name:/STEP$/}).click();await page.getByRole('button',{name:/STEP$/}).click();
  await expect(page.locator('.signal-status')).toContainText('Clock pulse 2');
});

test('module packages round-trip independently and use-in-lab appends rather than replaces',async({page})=>{
  await enableGate(page);await publish(page,'Enable module');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export module',exact:true}).click();
  const download=await downloadPromise,buffer=await readFile((await download.path())!);
  expect(JSON.parse(buffer.toString()).kind).toBe('circuitbuilder.module');
  await exchange(page).locator('input[type=file]').setInputFiles({name:'module.json',mimeType:'application/json',buffer});
  await expect(page.getByLabel('Shared module').locator('option')).toHaveCount(2);
  await exchange(page).locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(exchange(page).locator('.exchange-feedback')).toContainText('Invalid or unsupported');
  await expect(page.getByLabel('Shared module').locator('option')).toHaveCount(2);
  await page.getByRole('button',{name:'Use in Computer →',exact:true}).click();await expect(page).toHaveURL(/#computer$/);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state);
  expect(after.document.components.length).toBe(state.computerDocument.components.length+1);
  expect(after.signalDocument).toEqual(state.document);
  await page.getByRole('button',{name:'↶',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document.components.length)).toBe(state.computerDocument.components.length);
});

test('a solved Analog voltage becomes an explicitly thresholded Signals source',async({page})=>{
  await page.goto('/#analog');await page.getByRole('button',{name:/RUN DC/}).click();
  await openExchange(page);await page.getByRole('button',{name:'Voltage adapter',exact:true}).click();
  await page.getByLabel('Analog sample point').selectOption('r2:a');await expect(exchange(page).locator('.exchange-sample')).toContainText('5 V');
  await page.getByLabel('Logic threshold').fill('6');await expect(exchange(page).locator('.exchange-sample')).toContainText('LOW / 0');
  await page.getByLabel('Logic threshold').fill('2.5');await expect(exchange(page).locator('.exchange-sample')).toContainText('HIGH / 1');
  await page.getByRole('button',{name:'Add sampled source to Signals →',exact:true}).click();await expect(page).toHaveURL(/#signal$/);
  const part=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document.components.at(-1));
  expect(part.kind).toBe('high');expect(part.name).toContain('R2.A');await expect(page.locator('.signal-status')).toContainText('fixed snapshot');
});

test('a shared logic controller drives Robotics sensors, LEDs, and servo and survives export',async({page})=>{
  await enableGate(page);await publish(page,'My enable gate');
  await page.getByRole('button',{name:'Use in Robotics →',exact:true}).click();await expect(page).toHaveURL(/#robotics$/);
  await expect(page.getByRole('region',{name:'Incoming logic module'})).toBeVisible();
  await page.getByRole('button',{name:'Attach module',exact:true}).click();
  await expect(page.getByLabel('Controller type')).toHaveValue('logic');await uploadAndPause(page);
  await page.getByRole('button',{name:'Button input',exact:true}).click();const distance=page.getByRole('slider',{name:'Distance sensor'});await distance.focus();await distance.press('Home');
  await page.getByRole('button',{name:/Step 100 ms/}).click();await expect(pin(page,'D4')).toContainText('HIGH');
  await page.getByRole('combobox',{name:'Actuator for OUT',exact:true}).selectOption('servo');await expect(page.getByRole('button',{name:/Resume/})).toBeDisabled();
  await uploadAndPause(page);await expect(pin(page,'D5')).toContainText('90°');
  await distance.focus();await distance.press('End');await page.getByRole('button',{name:/Step 100 ms/}).click();await expect(pin(page,'D5')).toContainText('0°');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Export/}).click();const download=await downloadPromise,buffer=await readFile((await download.path())!);
  expect(JSON.parse(buffer.toString()).controller).toBe('logic');
  page.once('dialog',dialog=>dialog.accept());await page.locator('.robotics-file-controls input[type=file]').setInputFiles({name:'logic.robotics.json',mimeType:'application/json',buffer});
  await expect(page.getByLabel('Controller type')).toHaveValue('logic');await expect(page.getByRole('button',{name:/Resume/})).toBeDisabled();
  await page.getByRole('button',{name:'Detach module',exact:true}).click();await expect(page.getByRole('textbox',{name:'MicroScript source code'})).toHaveValue(/Traffic light/);
});

test('floating module outputs stop Robotics instead of inventing actuator values',async({page})=>{
  const floating=andDemo();floating.wires=[];const bundle=packageCurrentCircuit(floating,'Floating gate');
  await page.goto('/#signal');await openExchange(page);
  await exchange(page).locator('input[type=file]').setInputFiles({name:'floating.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await page.getByRole('button',{name:'Use in Robotics →',exact:true}).click();await page.getByRole('button',{name:'Attach module',exact:true}).click();
  await page.getByRole('button',{name:/Upload & run/}).click();await expect(page.getByRole('alert')).toContainText('Drive every mapped output');
  await expect(page.locator('.robotics-runtime-state')).toContainText('FAULT');await expect(pin(page,'D4')).toContainText('LOW');
});

test('graphics and motion preferences change presentation without changing circuit values',async({page})=>{
  await page.goto('/#signal');const canvas=page.getByLabel('Digital logic schematic editor');await expect(canvas).toHaveAttribute('data-animation','idle');
  const input=await canvas.evaluate(element=>({x:Number((element as HTMLElement).dataset.viewX)+144*Number((element as HTMLElement).dataset.viewZoom),y:Number((element as HTMLElement).dataset.viewY)+168*Number((element as HTMLElement).dataset.viewZoom)}));
  await canvas.click({position:input});await expect(canvas).toHaveAttribute('data-animation','active');await expect(canvas).toHaveAttribute('data-animation','idle',{timeout:3000});
  await page.locator('.display-menu>summary').click();await page.getByLabel('Animate state changes').uncheck();await expect(page.locator('.lab-hub-shell')).toHaveAttribute('data-motion','off');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document);
  await page.locator('.display-menu>summary').click();const studio=await canvas.screenshot();
  await page.locator('.display-menu>summary').click();await page.getByLabel('Graphics style').selectOption('neon');await page.keyboard.press('Escape');
  await expect(page.locator('.display-menu')).not.toHaveAttribute('open','');const classic=await canvas.screenshot();expect(studio.equals(classic)).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuitbuilder-signal-v01')!).state.document)).toEqual(before);
  await page.reload();await expect(page.locator('.lab-hub-shell')).toHaveAttribute('data-graphics','neon');await expect(canvas).toHaveAttribute('data-animation','idle');
});

test('system reduced motion disables canvas and servo animations',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#signal');
  await expect(page.locator('.lab-hub-shell')).toHaveAttribute('data-motion','off');await expect(page.getByLabel('Digital logic schematic editor')).toHaveAttribute('data-animation','idle');
  await page.locator('.display-menu>summary').click();await expect(page.getByLabel('Animate state changes')).toBeDisabled();
  await page.getByRole('button',{name:/Robotics$/}).click();await expect(page.locator('.display-menu')).not.toHaveAttribute('open','');await expect(page.locator('.servo-horn')).toBeVisible();
  expect(await page.locator('.servo-horn').evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0s');
});
