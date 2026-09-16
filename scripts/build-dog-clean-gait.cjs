// Animate complete, independently painted limbs instead of cutting old feet
// out of a flattened pose. Far limbs always stay behind body and near limbs.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {triangulate,deform}=require('./build-dog-gait.cjs');
const root=path.resolve(__dirname,'..'),size=256,count=48;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const legs=[
  {name:'far-rear',width:46,hip:{x:62,y:116},knee:{x:53,y:159},foot:{x:65,y:194},phase:.5,trotPhase:.5},
  {name:'near-rear',width:46,hip:{x:69,y:124},knee:{x:64,y:163},foot:{x:67,y:200},phase:0,trotPhase:0},
  {name:'near-front',front:true,width:44,hip:{x:147,y:132},knee:{x:147,y:166},foot:{x:149,y:200},phase:.75,trotPhase:.5},
  {name:'far-front',front:true,width:44,hip:{x:154,y:126},knee:{x:154,y:158},foot:{x:156,y:190},phase:.25,trotPhase:0},
];
function sample(source,width,height,u,v,target,q){
  const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
  if(ix<0||iy<0||ix>=width-1||iy>=height-1)return;
  let a=0,r=0,g=0,b=0;
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
    const k=((iy+dy)*width+ix+dx)*4,w=(dx?fx:1-fx)*(dy?fy:1-fy)*source[k+3]/255;
    a+=w;r+=source[k]*w;g+=source[k+1]*w;b+=source[k+2]*w;
  }
  if(a){target[q]=r/a;target[q+1]=g/a;target[q+2]=b/a;target[q+3]=a*255;}
}
async function limbArtwork(leg,folder){
  const height=leg.foot.y-leg.hip.y+16,width=leg.width;
  const input=await sharp(path.join(folder,leg.name+'.png')).resize(width,height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  function center(y){let sum=0,weight=0;for(let x=0;x<width;x++){const a=input[(y*width+x)*4+3];sum+=x*a;weight+=a;}return sum/weight;}
  const rootX=center(8),pawX=center(height-8),shear=(leg.foot.x-leg.hip.x-pawX+rootX)/(height-16);
  const out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=y-leg.hip.y+8,u=x-leg.hip.x+rootX-shear*(v-8),q=(y*size+x)*4;
    sample(input,width,height,u,v,out,q);
    // A soft root blends into the shoulder. All knee/foot pixels remain opaque.
    out[q+3]*=clamp((v-1)/18,0,1);
  }
  return out;
}
function solve(leg,foot,bob){
  const hip={x:leg.hip.x,y:leg.hip.y+bob},d=distance(hip,foot);
  let a=distance(leg.hip,leg.knee),b=distance(leg.knee,leg.foot);
  // Front legs stand almost straight. Permit a small, even extension at the
  // ends of a stride instead of adding permanent slack that bows both elbows.
  if(leg.front){
    const extension=Math.max(1,d/(a+b-.001));
    assert.ok(extension<1.14,`${leg.name}: excessive stride extension`);
    a*=extension;b*=extension;
  }
  assert.ok(d<a+b+.01,`${leg.name}: foot exceeds bone reach`);
  const reach=Math.min(d,a+b-.001),base=Math.atan2(foot.y-hip.y,foot.x-hip.x);
  const cross=(leg.foot.x-leg.hip.x)*(leg.knee.y-leg.hip.y)-(leg.foot.y-leg.hip.y)*(leg.knee.x-leg.hip.x);
  const bend=Math.acos(clamp((a*a+reach*reach-b*b)/(2*a*reach),-1,1));
  return {hip,knee:{x:hip.x+Math.cos(base+Math.sign(cross)*bend)*a,y:hip.y+Math.sin(base+Math.sign(cross)*bend)*a},foot};
}
function bonePoint(p,a,b,nextA,nextB){
  const length=distance(a,b),nextLength=distance(nextA,nextB);
  const along=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(length*length);
  const across=((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))/length;
  // Extension affects bone length only, never the thickness of the leg.
  return {x:nextA.x+along*(nextB.x-nextA.x)+across*(nextB.y-nextA.y)/nextLength,
    y:nextA.y+along*(nextB.y-nextA.y)-across*(nextB.x-nextA.x)/nextLength};
}
function blendBones(p,source,target){
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const upper=bonePoint(p,source.hip,source.knee,target.hip,target.knee);
  const lower=bonePoint(p,source.knee,source.foot,target.knee,target.foot);
  const a=target.pawAngle,dx=p.x-source.foot.x,dy=p.y-source.foot.y;
  const paw={x:target.foot.x+dx*Math.cos(a)-dy*Math.sin(a),y:target.foot.y+dx*Math.sin(a)+dy*Math.cos(a)};
  const skin=mix(upper,lower,smooth((p.y-source.knee.y+14)/28));
  return mix(skin,paw,smooth((p.y-source.foot.y+19)/12));
}
function limbTransform(source,target){
  const sections=new Map();
  return p=>{
    let section=sections.get(p.y);
    if(!section){
      const a=p.y<source.knee.y?source.hip:source.knee,b=p.y<source.knee.y?source.knee:source.foot;
      const center={x:p.y>=source.foot.y?source.foot.x:a.x+(b.x-a.x)*(p.y-a.y)/(b.y-a.y),y:p.y};
      const next=blendBones(center,source,target),side=blendBones({x:center.x+1,y:p.y},source,target);
      const widthScale=distance(next,side);
      assert.ok(widthScale>.1,'Joint section cannot collapse');
      section={center,next,normal:{x:(side.x-next.x)/widthScale,y:(side.y-next.y)/widthScale}};
      sections.set(p.y,section);
    }
    // Blending rotated bones compresses the inside of a bent joint. Restore
    // the painted cross-section around its moving centre, including ankles.
    const offset=p.x-section.center.x;
    return {x:section.next.x+offset*section.normal.x,y:section.next.y+offset*section.normal.y};
  };
}
function over(destination,layer){
  for(let q=0;q<destination.length;q+=4){
    const a=layer[q+3]/255,b=destination[q+3]/255*(1-a),alpha=a+b;if(!a)continue;
    for(let c=0;c<3;c++)destination[q+c]=(layer[q+c]*a+destination[q+c]*b)/alpha;
    destination[q+3]=alpha*255;
  }
}
async function main(){
  const folder=path.join(root,'assets/source-2d/dog-rig-v2'),output=path.join(root,'assets/source-2d/dog-gait-v6');
  const runtime=path.join(root,'assets/pets/dog');fs.mkdirSync(output,{recursive:true});
  const bodyPng=await sharp({create:{width:size,height:size,channels:4,background:'#0000'}})
    .composite([{input:await sharp(path.join(folder,'body.png')).resize(196,134,{fit:'fill'}).png().toBuffer(),left:36,top:34}]).png().toBuffer();
  const body=await sharp(bodyPng).raw().toBuffer();
  const limbs=await Promise.all(legs.map(leg=>limbArtwork(leg,folder)));
  const rigs=legs.map(leg=>{
    const points=[];
    for(let y=leg.hip.y-18;y<=leg.foot.y+24;y+=6)for(let x=leg.hip.x-52;x<=leg.hip.x+52;x+=6){
      points.push({x,y,bone:y>=leg.foot.y-13?'foot':y<leg.knee.y?'upper':'lower'});
    }
    return {points,triangles:triangulate(points)};
  });
  const bodyPoints=[{x:0,y:0},{x:255,y:0},{x:0,y:255},{x:255,y:255}],bodyTriangles=[[0,1,2],[1,2,3]];
  const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'manifest.json')));
  let occlusionPixels=0;
  const frontJointChecks=[];
  const widthChecks=[];
  const previewFrames={};
  for(const action of ['walk','run','idle']){
    const travel=action==='run'?38:60,stance=action==='run'?.58:.76,stride=travel/stance;
    const n=action==='idle'?12:count,frames=[],buffers=[],footprints=[];
    for(let frame=0;frame<n;frame++){
      const phase=frame/n,bob=action==='idle'?12+Math.sin(phase*Math.PI*2)*.45:12;
      const pose=legs.map(leg=>{
        const t=(phase+(action==='run'?leg.trotPhase:leg.phase))%1,s=clamp((t-stance)/(1-stance),0,1);
        const tangent=-(1-stance)/stance,swing=s*s*(3-2*s)+tangent*(2*s*s*s-3*s*s+s);
        const moving=action!=='idle',lift=!moving||t<stance?0:Math.sin(Math.PI*s)**2*(action==='run'?15:20);
        // Front feet share the body's rest offset. Omitting it makes the idle
        // pose 12 px crouched and turns straight front legs into bow legs.
        const foot={x:leg.foot.x+(!moving?0:t<stance?travel*(.5-t/stance):travel*(swing-.5)),y:leg.foot.y+(leg.front?12:0)-lift};
        return {...solve(leg,foot,bob),pawAngle:lift?-.22*Math.sin(Math.PI*s):0,lift};
      });
      for(let i=0;i<legs.length;i++)if(legs[i].front){
        const p=pose[i],axis={x:p.foot.x-p.hip.x,y:p.foot.y-p.hip.y};
        const elbowOffset=(axis.x*(p.knee.y-p.hip.y)-axis.y*(p.knee.x-p.hip.x))/Math.hypot(axis.x,axis.y);
        assert.ok(elbowOffset>=-.01,'Both front elbows must fold backward, never in opposite directions');
        if(p.lift===0)assert.ok(elbowOffset<5.5,'Supporting front leg must stay nearly straight');
        if(action==='idle')assert.ok(Math.abs(axis.x)<=3,'Resting front paw must sit below its shoulder');
        frontJointChecks.push({action,frame,leg:legs[i].name,hip:p.hip,knee:p.knee,foot:p.foot,lift:p.lift,elbowOffset});
      }
      footprints.push(pose.map(p=>({...p.foot,lift:p.lift})));
      const paintedBody=deform(body,bodyPoints,bodyTriangles,[],phase,p=>({x:p.x,y:p.y+bob}));
      const transforms=legs.map((leg,i)=>limbTransform(leg,pose[i]));
      for(let i=0;i<legs.length;i++){
        let minRatio=Infinity,maxRatio=0,sections=0;
        for(let y=legs[i].hip.y+12;y<=legs[i].foot.y+4;y+=2){
          const edges=[];
          for(let x=0;x<size;x++)if(limbs[i][(y*size+x)*4+3]>=128)edges.push(x);
          if(edges.length<4)continue;
          const left={x:edges[0],y},right={x:edges.at(-1),y};
          const ratio=distance(transforms[i](left),transforms[i](right))/distance(left,right);
          assert.ok(Math.abs(ratio-1)<.00001,`${action} ${frame} ${legs[i].name}: painted leg width changed`);
          minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio);sections++;
        }
        widthChecks.push({action,frame,leg:legs[i].name,sections,minRatio,maxRatio});
      }
      const paintedLegs=rigs.map((rig,i)=>deform(limbs[i],rig.points,rig.triangles,[],phase,transforms[i]));
      const out=Buffer.alloc(size*size*4);
      for(const layer of [paintedLegs[0],paintedLegs[3],paintedBody,paintedLegs[1],paintedLegs[2]])over(out,layer);
      // Inspect actual composited crossing pixels, including torso overlap.
      for(let q=0;q<out.length;q+=4)if(paintedLegs[2][q+3]>=240&&(paintedLegs[3][q+3]||paintedBody[q+3])){
        // Retain the repainted PNG's genuine alpha (its interior is 253/255).
        // Only the alpha-allowed background contribution may remain visible.
        const tolerance=256-paintedLegs[2][q+3];
        for(let c=0;c<3;c++)assert.ok(Math.abs(out[q+c]-paintedLegs[2][q+c])<=tolerance,'Near front paw must cover far paw/body');
        occlusionPixels++;
      }
      const name=`${action}-${String(frame).padStart(2,'0')}.png`,png=await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toBuffer();
      frames.push(name);buffers.push(png);fs.writeFileSync(path.join(output,name),png);
    }
    manifest.animations[action]={frames,fps:action==='idle'?8:48,loop:true,...(action==='idle'?{}:{stride})};
    previewFrames[action]=buffers;
    if(action==='walk'){
      const landings=footprints.flatMap((feet,i)=>feet.flatMap((foot,leg)=>foot.lift<=.01&&footprints[(i+n-1)%n][leg].lift>.01?[{frame:i,leg}]:[]));
      assert.deepEqual(landings.map(p=>p.frame),[0,12,24,36]);
      assert.ok(footprints.every(feet=>feet.filter(p=>p.lift>.01).length<=1));
      for(const {frame,leg} of landings)assert.ok(footprints[frame][leg].x-footprints[frame][leg^1].x>=32,'Next paw must land fully ahead');
      fs.writeFileSync(path.join(output,'walk-footprints.json'),JSON.stringify({stride,stance,landings,frames:footprints},null,2));
      const stacked=await sharp({create:{width:size,height:size*n,channels:4,background:'#0000'}}).composite(buffers.map((input,i)=>({input,left:0,top:i*size}))).raw().toBuffer();
      await sharp(stacked,{raw:{width:size,height:size*n,channels:4,pageHeight:size}}).gif({loop:0,delay:Array(n).fill(30),dither:0}).toFile(path.join(root,'blender/dog-walk-clean-layers.gif'));
      await sharp({create:{width:size*8,height:size,channels:4,background:'#eee7dd'}}).composite([0,6,12,18,24,30,36,42].map((frame,i)=>({input:buffers[frame],left:i*size,top:0}))).png().toFile(path.join(root,'blender/dog-walk-clean-layers-poses.png'));
    }
  }
  assert.ok(occlusionPixels>1000,'Exercise real near/far/body crossings');
  manifest.speed=24;manifest.behaviors.find(p=>p.action==='run').speedScale=46/24;
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(output,'layer-check.json'),JSON.stringify({occlusionPixels,order:['far-rear','far-front','body','near-rear','near-front']},null,2));
  fs.writeFileSync(path.join(output,'front-joints.json'),JSON.stringify(frontJointChecks,null,2));
  fs.writeFileSync(path.join(output,'leg-width-check.json'),JSON.stringify(widthChecks,null,2));
  const comparison=await sharp({create:{width:size*2,height:size*count,channels:4,background:'#0000'}})
    .composite(previewFrames.walk.flatMap((input,i)=>[
      {input:previewFrames.idle[Math.floor(i*previewFrames.idle.length/count)],left:0,top:i*size},
      {input,left:size,top:i*size}
    ])).raw().toBuffer();
  await sharp(comparison,{raw:{width:size*2,height:size*count,channels:4,pageHeight:size}})
    .gif({loop:0,delay:Array(count).fill(30),dither:0}).toFile(path.join(root,'blender/dog-leg-width-consistency.gif'));
  if(process.argv.includes('--apply')){
    for(const action of ['walk','run','idle'])for(const file of manifest.animations[action].frames)fs.copyFileSync(path.join(output,file),path.join(runtime,file));
    fs.copyFileSync(path.join(output,'manifest.json'),path.join(runtime,'manifest.json'));
  }
  console.log(`Built clean dog walk/run/idle: aligned front legs, full-paw forward passing, ${occlusionPixels} verified occlusion pixels`);
}
module.exports={main,bonePoint,limbTransform};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
