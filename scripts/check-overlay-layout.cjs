const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async function checkOverlayLayout(win,mouse,pause) {
  const js=code=>win.webContents.executeJavaScript(code);
  const bounds=win.getBounds(),saved=await js(`api.getState()`);
  const prompts=['該喝水啦！','Take a moment to stand up, stretch your shoulders, and drink some water.'];
  let cases=0;
  for(const size of [[bounds.width,bounds.height],[640,360]]) {
    win.setSize(...size);await pause(70);
    await mouse({type:'mouseMove',x:Math.floor(size[0]/2),y:Math.floor(size[1]/2)});
    for(const growth of [0,100])for(const toolbar of [false,true])for(const corner of ['tl','tr','bl','br']) {
      await js(`if(currentReminder)dismissReminder(false);closeTools();hovering=false;overrideTime=0;restPhase='none';
        renderState({petId:selectedId,name:'',hunger:10,mood:70,weight:50,growth:${growth}});
        x=${corner.endsWith('r')?'innerWidth-petWidth':'0'};y=${corner.startsWith('b')?'innerHeight-petWidth':'0'};
        showReminder('water');document.querySelector('#reminder-text').textContent=${JSON.stringify(prompts[toolbar?1:0])};${toolbar?'openTools()':''}`);
      await pause(65);
      const result=await js(`(()=>{
        const r=reminderCard.getBoundingClientRect(),p=pet.getBoundingClientRect(),t=petTools.getBoundingClientRect(),b=moodBadge.getBoundingClientRect();
        const inside=q=>q.left>=0&&q.top>=0&&q.right<=innerWidth&&q.bottom<=innerHeight;
        const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
        return {inside:inside(r),badge:inside(b),coversPet:overlaps(r,p),coversTools:toolsOpen&&overlaps(r,t),
          clickable:['reminder-done','reminder-later'].every(id=>{const el=document.getElementById(id),q=el.getBoundingClientRect();return inside(q)&&el.contains(document.elementFromPoint(q.x+q.width/2,q.y+q.height/2));}),
          viewport:[innerWidth,innerHeight],rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
      })()`);
      const label=JSON.stringify({size,growth,toolbar,corner,result});
      assert.ok(result.inside&&result.badge&&result.clickable,label);
      assert.ok(!result.coversPet&&!result.coversTools,label);
      cases++;
      if(size[0]===bounds.width&&growth===0&&corner==='br'&&!toolbar) {
        const rect={x:bounds.width-350,y:bounds.height-190,width:350,height:190};
        fs.writeFileSync(path.join(__dirname,'../blender/reminder-edge-fixed.png'),(await win.webContents.capturePage(rect)).toPNG());
      }
    }
  }
  // Hit-test with real pointer input after the clipped corner reproduction.
  await js(`closeTools();hovering=false`);await pause(70);
  const button=await js(`(()=>{const r=document.querySelector('#reminder-done').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  await mouse({type:'mouseMove',...button});
  await pause(70);
  assert.ok(await js(`!toolsOpen&&document.querySelector('#reminder-done').contains(document.elementFromPoint(${button.x},${button.y}))`),'Reminder buttons stay put when approached with the pointer');
  await mouse({type:'mouseDown',button:'left',clickCount:1,...button});
  await mouse({type:'mouseUp',button:'left',clickCount:1,...button});
  assert.ok(await js(`currentReminder===null&&reminderCard.hidden`),'Corner reminder can actually be dismissed');
  win.setBounds(bounds);await pause(70);
  await js(`renderState(${JSON.stringify(saved)});closeTools();hovering=false;overrideTime=0;restPhase='none';x=16;y=200;clampPosition()`);
  await pause(70);
  console.log(`PASS ${cases} reminder edge layouts: tiny/grown pets, toolbar, multiline text, small viewport, badge and clickable buttons`);
};
