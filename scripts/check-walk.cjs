const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

module.exports=async function checkWalk(win,mouse) {
  require('./check-dog-leg-width.cjs');
  const root=path.resolve(__dirname,'..');
  const track=JSON.parse(fs.readFileSync(path.join(root,'assets/source-2d/dog-gait-v6/walk-footprints.json')));
  assert.deepEqual(track.landings.map(item=>item.frame),[0,12,24,36],'Four evenly spaced walking footfalls');
  assert.equal(new Set(track.landings.map(item=>item.leg)).size,4,'Each of the four paws takes its own turn');
  for(const {frame,leg} of track.landings)assert.ok(track.frames[frame][leg].x-track.frames[frame][leg^1].x>=32,'Trailing paw must land fully ahead of the supporting paw, not just cross centres');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/pets/dog/manifest.json')));
  let head;
  for(const action of ['walk','run','idle'])for(const frame of manifest.animations[action].frames) {
    const runtime=fs.readFileSync(path.join(root,'dist/assets/pets/dog',frame));
    assert.ok(runtime.equals(fs.readFileSync(path.join(root,'assets/source-2d/dog-gait-v6',frame))),'Built app must contain the matching walk, run and idle artwork');
    if(action!=='walk')continue;
    const crop=await sharp(runtime).extract({left:105,top:35,width:125,height:65}).raw().toBuffer();
    if(head)assert.ok(crop.equals(head),'Head stays level through the walking cycle');
    head=crop;
  }
  const js=code=>win.webContents.executeJavaScript(code);
  await mouse({type:'mouseMove',x:2,y:2});
  for(const growth of [0,100])for(const direction of [-1,1]) {
    await js(`closeTools();hovering=false;document.activeElement.blur();currentReminder=null;reminderCard.hidden=true;
      renderState({petId:selectedId,hunger:80,mood:70,weight:35,growth:${growth}});stamina=100;
      foods.splice(0).forEach(f=>f.element.remove());stopToy();held=null;dragging=false;pendingWaste=null;queuedActions.length=0;
      x=220;y=220;direction=${direction};overrideTime=0;restPhase='none';movingSeconds=0;modeTimer=10;
      mode={action:'walk',duration:10,weight:1,speedScale:1};setAction('walk');gaitPhase=0;`);
    const samples=await js(`new Promise(resolve=>{
      const frames=[];
      function sample(){
        frames.push({x,y,phase:gaitPhase,clock:lastTimestamp,src:sprite.src,loaded:sprite.complete&&sprite.naturalWidth===256,
          top:pet.getBoundingClientRect().top,mirrored:pet.classList.contains('facing-left'),stride:manifest.animations.walk.stride*petWidth/256*bodyWidth});
        if(frames.length===42)resolve(frames);else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    })`);
    assert.ok(samples.every(s=>s.y===220&&s.top===220&&s.mirrored===(direction===-1)),'Walk translates without bouncing in either direction');
    for(let i=1;i<samples.length;i++) {
      const before=samples[i-1],after=samples[i];
      assert.ok((after.x-before.x)*direction>0,'Walking advances continuously instead of stopping between steps');
      const expected=(before.phase+Math.abs(after.x-before.x)/after.stride)%1;
      assert.ok(Math.abs(expected-after.phase)<.0001,'Feet follow distance traveled at both baby and adult sizes');
      assert.ok(after.src.endsWith(`/walk-${String(Math.floor(after.phase*48)).padStart(2,'0')}.png`),'Visible sprite follows the current gait frame');
    }
    assert.ok(samples.every(s=>s.loaded),'Every displayed walking frame is already decoded');
  }
  await js(`renderState({petId:selectedId,hunger:80,mood:70,weight:35,growth:0});direction=1;modeTimer=0;setAction('idle')`);
  console.log('PASS full-paw forward passing, four distinct footfalls, level head, deployed artwork, continuous left/right walking at baby/adult sizes');
};
