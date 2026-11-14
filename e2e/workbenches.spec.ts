import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const pin=(page:Page,name:string)=>page.locator('.robotics-pin-monitor>div').filter({has:page.getByText(name,{exact:true})});
const openRobotics=async(page:Page)=>{
  await page.goto('/#robotics');
  await expect(page.getByRole('heading',{name:'Robotics & control'})).toBeVisible();
};
const uploadAndPause=async(page:Page)=>{
  await page.getByRole('button',{name:/Upload & run/}).click();
  await page.getByRole('button',{name:/Pause/}).click();
};

test('four laboratories are reachable, linkable, and fit the viewport',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.landing-choices>button')).toHaveCount(4);
  for(const [name,hash] of [['Analog','analog'],['Signals','signal'],['Computer','computer'],['Robotics','robotics']]){
    await page.getByRole('button',{name:new RegExp('^.*'+name+'$')}).first().click();
    await expect(page).toHaveURL(new RegExp('#'+hash+'$'));
    await expect(page.locator('.lab-guide h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.reload();await expect(page.getByRole('heading',{name:'Robotics & control'})).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/#computer$/);
  expect(errors).toEqual([]);
});

test('analog solver, panel preferences, and focus mode still work',async({page})=>{
  await page.goto('/#analog');
  await page.getByRole('button',{name:/RUN DC/}).click();
  await expect(page.getByRole('tab',{name:/SIMULATE/})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.editor-foot')).toContainText('SIMULATION READY');
  await page.getByRole('button',{name:/FOCUS/}).click();
  await expect(page.locator('.compact-right')).toHaveCount(0);
  await expect(page.locator('.analog-catalog')).toHaveCount(0);
  await page.getByRole('button',{name:/FOCUS/}).click();
  await expect(page.locator('.compact-right')).toBeVisible();
  await page.reload();await expect(page.locator('.compact-right')).toBeVisible();
});

test('signal tools and independent computer workspace preserve their projects',async({page})=>{
  await page.goto('/#signal');
  await page.getByRole('textbox',{name:'Signal circuit name'}).fill('My logic experiment');
  await page.getByRole('combobox',{name:'Open signal tool'}).selectOption('truth');
  await expect(page.locator('.signal-truth-panel')).toBeVisible();
  await page.getByRole('button',{name:/Computer$/}).click();
  await expect(page.getByRole('textbox',{name:'Computer circuit name'})).not.toHaveValue('My logic experiment');
  await page.getByRole('button',{name:/Signals$/}).click();
  await expect(page.getByRole('textbox',{name:'Signal circuit name'})).toHaveValue('My logic experiment');
});

test('computer code drafts stay separate from injected ROM',async({page})=>{
  await page.goto('/#computer');
  await page.locator('summary[aria-label="Project actions"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:/LOAD PROGRAMMABLE CASM CPU/}).click();
  const source=page.getByRole('textbox',{name:'CASM assembly source'});
  await expect(source).toBeVisible();await source.fill('LDI 7\nOUT\nHLT');
  await expect(page.locator('.casm-injection-state')).toContainText('DRAFT NOT INJECTED');
  await page.getByRole('button',{name:/ASSEMBLE & INJECT INTO CIRCUIT/}).click();
  await expect(page.locator('.casm-injection-state')).not.toContainText('DRAFT NOT INJECTED');
  await page.getByRole('button',{name:/STEP INSTRUCTION/}).click();
  await expect(page.locator('.casm-studio-readouts')).toContainText('7');
});

test('traffic lights obey virtual time and pause/reset controls',async({page})=>{
  await openRobotics(page);await uploadAndPause(page);
  await page.getByRole('button',{name:/Reset/}).click();
  await expect(pin(page,'D2')).toContainText('LOW');
  for(let i=0;i<19;i++)await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D2')).toContainText('HIGH');
  await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D2')).toContainText('LOW');await expect(pin(page,'D4')).toContainText('HIGH');
  await page.getByRole('tab',{name:/Event log/}).click();
  await expect(page.getByRole('tabpanel',{name:'Output events'})).toContainText('2.00 s');
  await page.getByRole('button',{name:/Reset/}).click();
  await expect(page.locator('.robotics-runtime-state')).toContainText('0.00 s');
});

test('door sensor drives the uploaded program while code edits remain drafts',async({page})=>{
  await openRobotics(page);await page.getByLabel('STARTER PROJECT').selectOption('door');
  await uploadAndPause(page);
  const distance=page.getByRole('slider',{name:'Distance sensor'});
  await distance.focus();await distance.press('Home');
  await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D5')).toContainText('90°');
  const source=page.getByRole('textbox',{name:'MicroScript source code'});
  await source.fill((await source.inputValue()).replace('servo D5 90','servo D5 120'));
  await expect(page.getByText('DRAFT · NOT UPLOADED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D5')).toContainText('90°');
  await page.getByRole('button',{name:'Upload program from editor'}).click();
  await page.getByRole('button',{name:/Pause/}).click();
  await expect(pin(page,'D5')).toContainText('120°');
  await distance.focus();await distance.press('End');
  await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D5')).toContainText('0°');
});

test('button overrides obstacle warnings and rewiring requires another upload',async({page})=>{
  await openRobotics(page);await page.getByLabel('STARTER PROJECT').selectOption('obstacle');
  const distance=page.getByRole('slider',{name:'Distance sensor'});await distance.focus();await distance.press('Home');
  await uploadAndPause(page);await expect(pin(page,'D2')).toContainText('HIGH');
  await page.getByRole('button',{name:'Button input',exact:true}).click();
  await page.getByRole('button',{name:/Step 100 ms/}).click();
  await expect(pin(page,'D2')).toContainText('LOW');await expect(pin(page,'D4')).toContainText('HIGH');
  await page.locator('.robotics-wiring>summary').click();
  await page.getByRole('combobox',{name:'Red LED pin',exact:true}).selectOption('D0');
  await expect(page.getByRole('button',{name:/Upload & run/})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('share D0');
  await expect(page.getByRole('button',{name:/Resume/})).toBeDisabled();
  await page.getByRole('combobox',{name:'Red LED pin',exact:true}).selectOption('D6');
  await expect(page.getByRole('button',{name:/Upload & run/})).toBeEnabled();
  const source=page.getByRole('textbox',{name:'MicroScript source code'});
  await source.fill((await source.inputValue()).replaceAll('D2','D6'));
  await page.getByRole('button',{name:'Button input',exact:true}).click();
  await uploadAndPause(page);await expect(pin(page,'D6')).toContainText('HIGH');
});

test('drafts survive reload and JSON round trips; bad imports preserve current work',async({page})=>{
  await openRobotics(page);
  const source=page.getByRole('textbox',{name:'MicroScript source code'});
  const text=(await source.inputValue())+'\n# my saved draft';await source.fill(text);
  await page.reload();await expect(source).toHaveValue(text);
  await expect(page.getByRole('button',{name:/Resume/})).toBeDisabled();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Export/}).click();
  const download=await downloadPromise;
  const exported=await readFile((await download.path())!);
  expect(JSON.parse(exported.toString()).source).toBe(text);
  await page.locator('.robotics-file-controls input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"lab":"signal"}')});
  await expect(page.getByRole('status',{name:'Robotics project status'})).toContainText('Invalid Robotics Lab project');await expect(source).toHaveValue(text);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.robotics-file-controls input[type=file]').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:exported});
  await expect(source).toHaveValue(text);await expect(page.getByRole('status',{name:'Robotics project status'})).toContainText('Project ready');
  await source.fill('write D9 HIGH\nwait 100');
  await expect(page.getByRole('button',{name:/Upload & run/})).toBeDisabled();
  await page.getByRole('button',{name:/Line 1 Unknown instruction/}).click();await expect(source).toBeFocused();
});
