const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const menus = [];
const smokeProfile=path.resolve(__dirname,'../blender/.smoke-profile');fs.mkdirSync(smokeProfile,{recursive:true});app.setPath('userData',smokeProfile);
fs.rmSync(path.join(smokeProfile,'pet-state.json'),{force:true});
setTimeout(() => { console.error('Smoke test timed out'); app.exit(1); }, 90000).unref();
const build = Menu.buildFromTemplate.bind(Menu);
Menu.buildFromTemplate = template => { const menu = build(template); menus.push(menu); return menu; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let running = false;
app.on('browser-window-created', (_event, win) => {
  win.hide();
  // Keep real desktop pointer forwarding out of the synthetic input test.
  win.setIgnoreMouseEvents = () => {};
  if (running) return;
  running = true;
  win.webContents.once('did-finish-load', () => run(win).catch(error => { console.error(error); app.exit(1); }));
});
require('../dist/main/main.js');
async function waitFor(win, expression) {
  for (let i = 0; i < 100; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await pause(50);
  }
  throw new Error(`Timed out: ${expression}`);
}
async function run(win) {
  win.webContents.debugger.attach('1.3');
  async function mouse(event) {
    await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: {mouseMove:'mouseMoved',mouseDown:'mousePressed',mouseUp:'mouseReleased'}[event.type],
      x:event.x,y:event.y,button:event.button??'none',
      buttons:event.type==='mouseDown'||event.modifiers?.includes('leftButtonDown')?1:0,
      clickCount:event.clickCount??0,
    });
  }
  async function placeNearbyFood() {
    await waitFor(win, `placingFood`);
    const point=await win.webContents.executeJavaScript(`({x:Math.round(x+petWidth/2+14),y:Math.round(y+petWidth*.8)})`);
    await mouse({type:'mouseMove',...point});
    await mouse({type:'mouseDown',button:'left',clickCount:1,...point});
    await mouse({type:'mouseUp',button:'left',clickCount:1,...point});
    assert.ok(await win.webContents.executeJavaScript(`foods.some(f=>f.element.dataset.food===selectedId+'food' && f.element.querySelector('svg'))`),'Food uses the selected species artwork');
  }

  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/pets/catalog.json'), 'utf8'));
  for (const entry of catalog) {
    const menu = menus.at(-1);
    const item = menu.items.find(item => item.label === '切換寵物').submenu.items.find(item => item.label === entry.name);
    item.click();
    await waitFor(win, `document.querySelector('#pet').title.startsWith(${JSON.stringify(entry.name)}) && document.querySelector('#pet-sprite').alt === ${JSON.stringify(entry.name)} && document.querySelector('#pet-sprite').naturalWidth === 256 && document.querySelector('#pet-sprite').src.includes('/${entry.id}/')`);
    for (const [label, action] of [['餵食','eat'],['摸摸','react'],['休息一下','sleep']]) {
      menus.at(-1).items.find(item => item.label === label).click();
      if(action==='eat')await placeNearbyFood();
      await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/${action}-')`);
    }
    await pause(320);
    await win.webContents.executeJavaScript(`document.querySelector('#pet').click()`);
    await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/react-') && document.querySelector('.heart') !== null`);
    console.log(`PASS ${entry.id}: selection, decoding, feed, pet, sleep, wake on click`);
  }
  const rect = await win.webContents.executeJavaScript(`(() => { const r = document.querySelector('#pet').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);

  await mouse({type:'mouseMove',...rect});
  await pause(100);
  await waitFor(win, `getComputedStyle(document.querySelector('#pet-tools')).visibility === 'visible'`);
  await win.webContents.executeJavaScript(`api.selectPet('fish')`);
  await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/fish/')`);
  await win.webContents.executeJavaScript(`document.querySelector('#feed-pet').click()`);
  await placeNearbyFood();
  await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/eat-')`);
  console.log('PASS hover toolbar, selector IPC and feed button');
  for (const entry of catalog) {
  
    menus.at(-1).items.find(item => item.label === '切換寵物').submenu.items.find(item => item.label === entry.name).click();
    await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/${entry.id}/') && document.querySelector('#pet').title.startsWith(${JSON.stringify(entry.name)})`);
    const before = await win.webContents.executeJavaScript(`(() => { const r=document.querySelector('#pet').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    await mouse({type:'mouseMove',...before});
    await pause(60);
    await mouse({type:'mouseDown',button:'left',clickCount:1,...before});
    await pause(60);
    await mouse({type:'mouseMove',x:before.x+10,y:before.y-10,button:'left',modifiers:['leftButtonDown']});
    await pause(60);
    await mouse({type:'mouseMove',x:before.x+110,y:before.y-120,button:'left',modifiers:['leftButtonDown']});
    await pause(60);
    await waitFor(win, `document.querySelector('#pet').classList.contains('dragging') && document.querySelector('#pet-sprite').src.includes('/drag-')`);
    const during = await win.webContents.executeJavaScript(`(() => { const r=document.querySelector('#pet').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    assert.ok(during.y < before.y - 80, `Pet must follow pointer vertically: ${entry.id} ${JSON.stringify({before,during})}`);
    await mouse({type:'mouseUp',button:'left',clickCount:1,x:before.x+110,y:before.y-120});
    await waitFor(win, `!document.querySelector('#pet').classList.contains('dragging')`);
    console.log(`PASS ${entry.id}: pointer capture, drag frames and drop`);
  }
  win.webContents.send('pet-action','poop');
  await waitFor(win, `document.querySelector('.waste.poop') !== null`);
  assert.ok(await win.webContents.executeJavaScript(`(()=>{const p=sprite.getBoundingClientRect(),w=document.querySelector('.waste.poop').getBoundingClientRect();return w.bottom<p.bottom-8&&w.bottom>p.top+p.height*.5&&w.left+w.width/2>p.left&&w.left+w.width/2<p.right})()`),'Waste emitted beneath the visible pet after dragging, not transparent sprite border');
  const wasteBefore=await win.webContents.executeJavaScript(`document.querySelector('.waste.poop').style.cssText`);
  await win.webContents.executeJavaScript(`x+=80;y-=40;clampPosition()`);
  await pause(100);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.waste.poop').style.cssText`),wasteBefore,'Deposited waste stays at emission position');
  await win.webContents.executeJavaScript(`document.querySelector('.waste.poop').click()`);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('.waste.poop.cleaning .sweep-broom svg')!==null`),'Broom appears before waste disappears');
  await waitFor(win, `document.querySelector('.waste.poop') === null`);
  win.webContents.send('pet-action','vomit');
  await waitFor(win, `document.querySelector('.waste.vomit') !== null`);
  await win.webContents.executeJavaScript(`document.querySelector('#clean-pet').click()`);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('.waste.cleaning .sweep-broom')!==null`),'Clean all sweeps before removal');
  await waitFor(win, `document.querySelector('.waste') === null`);
  await win.webContents.executeJavaScript(`receiveAction('react')`);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelector('.heart')!==null&&!speech.classList.contains('visible')`),'Heart action uses a heart without a speech bubble');
  await win.webContents.executeJavaScript(`makeWaste('poop');makeWaste('pee');makeWaste('vomit');cleanWaste();cleanWaste()`);
  assert.ok(await win.webContents.executeJavaScript(`document.querySelectorAll('.sweep-broom').length===1&&document.querySelector('.waste.poop.cleaning')!==null&&document.querySelectorAll('.waste').length===3`),'Only first mess sweeps, even after repeated clean-all');
  await waitFor(win, `document.querySelector('.waste.poop')===null&&document.querySelector('.waste.pee.cleaning')!==null`);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.sweep-broom').length`),1,'One broom moves to the next mess');
  await waitFor(win, `document.querySelector('.waste.pee')===null&&document.querySelector('.waste.vomit.cleaning')!==null`);
  await waitFor(win, `document.querySelector('.waste')===null`);
  console.log('PASS waste location, sequential cleanup and heart without dialogue');
  let rubPoint = await win.webContents.executeJavaScript(`(() => { const r=document.querySelector('#pet').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
  let rubEvents=0;ipcMain.on('interact',(_event,kind)=>{if(kind==='rub')rubEvents++;});
  await pause(1700);
  rubPoint = await win.webContents.executeJavaScript(`(() => { const r=document.querySelector('#pet').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
  await mouse({type:'mouseMove',...rubPoint});await pause(80);
  for (let i=0;i<10;i++) {
    await mouse({type:'mouseMove',x:rubPoint.x+(i%2?25:-25),y:rubPoint.y});
    await pause(40);
  }
  await waitFor(win, `['rub','wiggle','react','grumpy'].some(a=>document.querySelector('#pet-sprite').src.includes('/'+a+'-'))`);
  assert.ok(rubEvents>0,'Rubbing must send the actual rub interaction');
  console.log('PASS back-and-forth rubbing gesture');
  assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('#pet-tools > button svg').length`),5);
  await win.webContents.executeJavaScript(`api.selectPet('dog')`);
  await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/dog/')`);
  await require('./check-care.cjs')(win,mouse,waitFor,pause);
  await require('./check-dig.cjs')(win,mouse,waitFor,pause);
  await win.webContents.executeJavaScript(`hovering=false;document.activeElement.blur();overrideTime=3;setAction('pee')`);
  await waitFor(win, `document.querySelector('.waste.pee') !== null`);
  await win.webContents.executeJavaScript(`document.querySelector('.waste.pee').click()`);
  await mouse({type:'mouseMove',x:2,y:2});
  await win.webContents.executeJavaScript(`closeTools();hovering=false;overrideTime=0;movingSeconds=60;x=18;modeTimer=0;restPhase='none'`);
  await waitFor(win, `restPhase==='sleep' && document.querySelector('#pet-sprite').src.includes('/sleep-')`);
  assert.ok(await win.webContents.executeJavaScript(`Math.abs(x-16)<2`),'Tired pet sleeps at screen edge');
  win.webContents.send('reminder','stretch');
  await waitFor(win, `!document.querySelector('#reminder-card').hidden`);
  await waitFor(win, `action==='stretch'`);
    assert.ok(await win.webContents.executeJavaScript(`document.querySelector('#reminder-card').parentElement===pet`),'Reminder belongs to pet');
    assert.ok(await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#reminder-card').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`),'Reminder stays on screen');
    require('fs').writeFileSync(require('path').join(__dirname,'../blender/reminder-preview.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`document.querySelector('#reminder-later').click()`);
  await waitFor(win, `document.querySelector('#reminder-card').hidden`);
  win.webContents.send('reminder','water');
  await waitFor(win, `!document.querySelector('#reminder-card').hidden`);
  await win.webContents.executeJavaScript(`document.querySelector('#reminder-done').click()`);
  await waitFor(win, `document.querySelector('#reminder-card').hidden`);
  console.log('PASS SVG toolbar, visual pet switcher, pee cleanup, tired edge-sleep and reminder buttons');
  await require('./check-overlay-layout.cjs')(win,mouse,pause);
  await win.webContents.executeJavaScript(`openTools();restPhase='none';overrideTime=0`);
  const gap=await win.webContents.executeJavaScript(`(()=>{const a=petTools.getBoundingClientRect();return {x:Math.round(a.left+20),y:Math.round(a.top+20)}})()`);
  await mouse({type:'mouseMove',...gap});await pause(1200);
  assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(petTools).visibility`),'visible');
  const beforeFreeze=await win.webContents.executeJavaScript(`pet.getBoundingClientRect().y`);await pause(350);
  assert.equal(await win.webContents.executeJavaScript(`pet.getBoundingClientRect().y`),beforeFreeze);
  await mouse({type:'mouseMove',x:600,y:20});await pause(1100);
  assert.equal(await win.webContents.executeJavaScript(`toolsOpen`),false);
  assert.ok(await win.webContents.executeJavaScript(`energyForHunger(0)<.2 && energyForHunger(20)<.5 && energyForHunger(80)===1`));
  await win.webContents.executeJavaScript(`renderState({petId:selectedId,hunger:10,mood:70})`);
  assert.ok(await win.webContents.executeJavaScript(`pet.classList.contains('low-energy') && moodBadge.querySelector('svg')!==null`));
  await win.webContents.executeJavaScript(`startFoodPlacement()`);
  await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await win.webContents.executeJavaScript(`placingFood`),false);
  console.log('PASS hover gap, frozen toolbar, delayed close, hunger energy and food placement cancel');
  await win.webContents.executeJavaScript(`foods.splice(0).forEach(f=>f.element.remove());closeTools();hovering=false;overrideTime=0;pendingWaste=null;queuedActions.length=0;restPhase='none';x=200;y=250;renderState({petId:selectedId,hunger:80,mood:70});startFoodPlacement()`);
  const destination={x:420,y:378};
  await mouse({type:'mouseMove',...destination});
  await mouse({type:'mouseDown',button:'left',clickCount:1,...destination});
  await mouse({type:'mouseUp',button:'left',clickCount:1,...destination});
  // Leave the pointer on the bowl throughout approach and consumption.
  await waitFor(win, `foods.some(f=>f.served)`);
  await waitFor(win, `document.querySelector('#pet-sprite').src.includes('/eat-') || document.querySelector('#pet-sprite').src.includes('/vomit-')`);
  assert.ok(await win.webContents.executeJavaScript(`Math.abs(x-(420-petWidth/2))<4 && Math.abs(y-(378-petWidth*.8))<4`));
  console.log('PASS distant food reached and consumed with cursor left on bowl');
  await win.webContents.executeJavaScript(`foods.splice(0).forEach(f=>f.element.remove());overrideTime=0;pendingWaste=null;queuedActions.length=0;x=200;y=250;placeFood(420,378);openTools();hovering=true;document.querySelector('#sleep-pet').focus();document.querySelector('#sleep-pet').click();document.querySelector('#clean-pet').click()`);
  await waitFor(win, `foods.some(f=>f.served)`);
  assert.ok(await win.webContents.executeJavaScript(`Math.abs(x-(420-petWidth/2))<4&&Math.abs(y-(378-petWidth*.8))<4`),'Food pursuit survives focused and clicked toolbar controls');
  console.log('PASS feeding takes priority over hover, toolbar focus, petting and sleep clicks');
  let switchCleanEvents=0;
  const onSwitchClean=(_event,kind)=>{if(kind==='clean')switchCleanEvents++;};ipcMain.on('interact',onSwitchClean);
  await win.webContents.executeJavaScript(`foods.splice(0).forEach(f=>f.element.remove());overrideTime=0;queuedActions.length=0;pendingWaste=null;placeFood(700,300);makeWaste('poop');makeWaste('pee');document.querySelector('.waste.poop').click();pendingWaste='vomit';overrideTime=1;api.selectPet('cat');api.selectPet('rabbit');api.selectPet('pig')`);
  await waitFor(win, `manifest?.id==='pig'&&selectedId==='pig'&&!document.querySelector('.placed-food,.waste')&&foods.length===0`);
  await pause(1100);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.placed-food,.waste').length`),0,'Rapid switches discard food, waste and pending elimination');
  assert.equal(switchCleanEvents,0,'Discarded sweep does not reward the next pet');ipcMain.removeListener('interact',onSwitchClean);
  console.log('PASS rapid switching clears food, waste, pending elimination and cleaning callbacks');
  const previousLanguage=await win.webContents.executeJavaScript(`api.getLanguage()`);
  menus.at(-1).items.find(item=>item.label==='開啟寵物選擇').click();
  const picker=BrowserWindow.getAllWindows().find(window=>window!==win);
  await waitFor(picker, `document.querySelector('#language-choice') !== null && typeof pickerAPI !== 'undefined'`);
  assert.ok(picker.getBounds().height<=510,'Compact picker default height');
  assert.ok(await picker.webContents.executeJavaScript(`document.querySelector('.settings').getBoundingClientRect().bottom <= innerHeight`),'Settings fit in compact window');
  fs.writeFileSync(path.join(__dirname,'../blender/compact-picker-preview.png'),(await picker.webContents.capturePage()).toPNG());
  await picker.webContents.executeJavaScript(`document.querySelector('#language-choice').value='en';document.querySelector('#language-choice').dispatchEvent(new Event('change'))`);
  await waitFor(win, `document.documentElement.lang==='en' && document.querySelector('#feed-pet').title==='Feed'`);
  await waitFor(picker, `document.querySelector('h1').textContent==='Choose your little companion'`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(smokeProfile,'language.json'),'utf8')),'en');
  await picker.webContents.executeJavaScript(`document.querySelector('#language-choice').value='zh-Hans';document.querySelector('#language-choice').dispatchEvent(new Event('change'))`);
  await waitFor(win, `document.documentElement.lang==='zh-Hans' && document.querySelector('#feed-pet').title==='喂食'`);
  await picker.webContents.executeJavaScript(`pickerAPI.setLanguage(${JSON.stringify(previousLanguage)})`);
  console.log('PASS language selector, cross-window translations and saved preference');
  const namedPetId = await win.webContents.executeJavaScript(`selectedId`);
  await picker.webContents.executeJavaScript(`(() => { const input=document.querySelector('#pet-name'); input.value='Buddy'; input.dispatchEvent(new Event('change')); })()`);
  await waitFor(win, `pet.title.startsWith('Buddy')`);
  await waitFor(picker, `document.querySelector('#status').textContent==='♥ Buddy'`);
  await win.webContents.executeJavaScript(`api.selectPet(${JSON.stringify(namedPetId === 'fish' ? 'dog' : 'fish')})`);
  await waitFor(picker, `document.querySelector('#pet-name').value===''`);
  await win.webContents.executeJavaScript(`api.selectPet(${JSON.stringify(namedPetId)})`);
  await waitFor(win, `pet.title.startsWith('Buddy')`);
  await waitFor(picker, `document.querySelector('#pet-name').value==='Buddy'`);
  await picker.webContents.executeJavaScript(`(() => { const input=document.querySelector('#pet-name'); input.value=''; input.dispatchEvent(new Event('change')); })()`);
  await waitFor(win, `pet.title.startsWith(document.querySelector('#pet-sprite').alt) && !pet.title.startsWith('Buddy')`);
  console.log('PASS naming a pet persists per-pet and updates the floating window live');
  const {ReminderClock}=require('../dist/main/reminders.js');const clock=new ReminderClock(0);
  assert.equal(clock.tick(45*60000,0),'stretch');assert.equal(clock.tick(60*60000,0),'water');
  clock.acknowledge('water',true,60*60000);assert.equal(clock.tick(65*60000,0),'water');
  clock.update({enabled:false},0);assert.equal(clock.tick(9999999,0),null);
  clock.update({enabled:true,stretchMinutes:0,waterMinutes:999},0);assert.equal(clock.settings.stretchMinutes,5);assert.equal(clock.settings.waterMinutes,180);
  assert.equal(clock.tick(5*60000,200),null);assert.equal(clock.tick(6*60000,0),null);
  console.log('PASS reminder timing, snooze, settings bounds, disable and idle reset');
  const { PetStateManager } = require('../dist/main/petState.js');
  const state = new PetStateManager(); state.feed(); state.select('cat'); state.pet();
  assert.equal(state.select('dog').hunger,100); assert.equal(state.select('cat').mood,85);
  assert.equal(state.rename('  Buddy  ').name,'Buddy');
  assert.equal(state.select('dog').name,''); assert.equal(state.select('cat').name,'Buddy');
  console.log('PASS pet nicknames are trimmed and kept separate per pet');
  const digestion = new PetStateManager();
  assert.equal(digestion.feedReaction(100000),'eat');
  assert.equal(digestion.nextAutonomousAction(144999),null);
  assert.equal(digestion.nextAutonomousAction(145000),'poop');
  assert.equal(digestion.nextAutonomousAction(145001),null);
  assert.equal(digestion.feedReaction(150000),'eat');
  assert.equal(digestion.feedReaction(151000),'eat');
  assert.equal(digestion.feedReaction(152000),'vomit');
  assert.equal(digestion.nextAutonomousAction(250000),null);
  assert.deepEqual(Array.from({length:4},()=>digestion.rubReaction()),['rub','wiggle','react','grumpy']);
  console.log('PASS digestion timing, overfeeding, single waste event and varied rub responses');
  assert.deepEqual(errors, []);
  console.log('PASS independent pet state; no renderer errors');
  assert.equal(JSON.parse(fs.readFileSync(path.join(smokeProfile,'pet-state.json'),'utf8')).pets.length,5,'Pet progress saved to disk');
  app.exit(0);
}
