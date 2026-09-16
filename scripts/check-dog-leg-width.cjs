const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {bonePoint,limbTransform}=require('./build-dog-clean-gait.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// A leg may extend to reach the ground, but an 18 px section must stay 18 px
// even when the bone is longer and rotated away from the vertical.
const root={x:40,y:30},end={x:40,y:70};
const nextRoot={x:20,y:15},nextEnd={x:47,y:51};
const left=bonePoint({x:31,y:50},root,end,nextRoot,nextEnd);
const right=bonePoint({x:49,y:50},root,end,nextRoot,nextEnd);
assert.ok(Math.abs(distance(left,right)-18)<1e-8,'Bone extension must preserve thickness');
assert.ok(distance(bonePoint(end,root,end,nextRoot,nextEnd),nextEnd)<1e-8,'Longitudinal extension still reaches the foot');

// Exercise a folded knee and a level paw independently of the production
// poses, so rotational blending cannot shrink either transition again.
const source={hip:{x:40,y:20},knee:{x:40,y:60},foot:{x:40,y:100}};
const target={hip:{x:40,y:20},knee:{x:10,y:48},foot:{x:40,y:78},pawAngle:0};
const transform=limbTransform(source,target);
for(let y=32;y<=108;y++){
  const a=transform({x:31,y}),b=transform({x:49,y});
  assert.ok(Math.abs(distance(a,b)-18)<1e-8,`Bent leg/ankle thickness at section ${y}`);
}
const report=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/source-2d/dog-gait-v6/leg-width-check.json')));
assert.equal(report.length,(48+48+12)*4,'Check every limb in walk, run and idle');
assert.equal(new Set(report.map(row=>row.leg)).size,4);
for(const row of report){
  assert.ok(row.sections>=25,'Check painted sections from shoulder through paw');
  assert.ok(Math.abs(row.minRatio-1)<.00001&&Math.abs(row.maxRatio-1)<.00001,`${row.action} ${row.frame}: ${row.leg} width`);
}
console.log('PASS length-only extension, bent knee/ankle thickness, and all 432 animated limb poses');
