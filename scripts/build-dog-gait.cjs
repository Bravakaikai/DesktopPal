// Compile a fixed character into a distance-driven, four-beat walking cycle.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'assets/pets/dog');
const size = 256, count = 48;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
// A continuous triangle mesh bends the legs without opening cracks in the fur.
function triangulate(points) {
  const p=[...points,{x:-1024,y:-1024},{x:2048,y:-1024},{x:128,y:2048}];
  let triangles=[[points.length,points.length+1,points.length+2]];
  for(let i=0;i<points.length;i++) {
    const edges=new Map(),kept=[];
    for(const tri of triangles) {
      const [a,b,c]=tri.map(j=>p[j]);
      const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
      const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
      const ux=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d;
      const uy=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;
      if((p[i].x-ux)**2+(p[i].y-uy)**2 <= (a.x-ux)**2+(a.y-uy)**2+1e-6) {
        for(let k=0;k<3;k++){const edge=[tri[k],tri[(k+1)%3]],key=[...edge].sort((a,b)=>a-b).join(',');if(edges.has(key))edges.delete(key);else edges.set(key,edge);}
      } else kept.push(tri);
    }
    triangles=[...kept,...[...edges.values()].map(edge=>[...edge,i])];
  }
  return triangles.filter(tri=>tri.every(i=>i<points.length));
}
function deform(raw,points,triangles,shifts,phase,transformPoint) {
  const target=points.map(p=>transformPoint ? transformPoint(p) : ({x:p.x+(p.paw===undefined?0:shifts[p.paw].x),y:p.y+(p.paw===undefined?Math.sin(phase*Math.PI*4)*.5:shifts[p.paw].y)}));
  const out=Buffer.alloc(raw.length);
  for(const ids of triangles) {
    const [a,b,c]=ids.map(i=>target[i]),[sa,sb,sc]=ids.map(i=>points[i]);
    const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(det)<1e-5)continue;
    const left=clamp(Math.floor(Math.min(a.x,b.x,c.x)),0,255),right=clamp(Math.ceil(Math.max(a.x,b.x,c.x)),0,255);
    const top=clamp(Math.floor(Math.min(a.y,b.y,c.y)),0,255),bottom=clamp(Math.ceil(Math.max(a.y,b.y,c.y)),0,255);
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
      const wa=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det;
      const wb=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,wc=1-wa-wb;
      if(Math.min(wa,wb,wc)<-1e-5)continue;
      const u=sa.x*wa+sb.x*wb+sc.x*wc,v=sa.y*wa+sb.y*wb+sc.y*wc;
      const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,q=(y*size+x)*4;
      if(ix<0||iy<0||ix>=255||iy>=255)continue;
      let alpha=0,r=0,g=0,blue=0;
      for(let j=0;j<2;j++)for(let k=0;k<2;k++) {
        const p=((iy+j)*size+ix+k)*4,w=(k?fx:1-fx)*(j?fy:1-fy)*raw[p+3]/255;
        alpha+=w;r+=raw[p]*w;g+=raw[p+1]*w;blue+=raw[p+2]*w;
      }
      if(alpha){out[q]=r/alpha;out[q+1]=g/alpha;out[q+2]=blue/alpha;out[q+3]=alpha*255;}
    }
  }
  return out;
}
async function main() {
  const input = sharp(path.join(root,'assets/source-2d/dog-gait-atlas.png'));
  const info = await input.metadata();
  const width=Math.floor(info.width/4),height=Math.floor(info.height/2);
  const cell=await input.extract({left:0,top:0,width,height}).ensureAlpha().raw().toBuffer();
  const seen=new Uint8Array(width*height);let largest=[];
  for(let p=0;p<seen.length;p++) {
    if(seen[p]||cell[p*4+3]<32)continue;
    const group=[p];seen[p]=1;
    for(let i=0;i<group.length;i++) {
      const x=group[i]%width,y=Math.floor(group[i]/width);
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++) {
        if(x+xx<0||x+xx>=width||y+yy<0||y+yy>=height)continue;
        const n=(y+yy)*width+x+xx;
        if(!seen[n]&&cell[n*4+3]>=32){seen[n]=1;group.push(n);}
      }
    }
    if(group.length>largest.length)largest=group;
  }
  const keep=new Set(largest);
  for(let p=0;p<seen.length;p++)if(!keep.has(p))cell[p*4+3]=0;
  const pose = await sharp(cell,{raw:{width,height,channels:4}}).trim().resize({width:216,height:190,fit:'inside'}).png().toBuffer();
  const bounds = await sharp(pose).metadata();
  const png = await sharp({create:{width:size,height:size,channels:4,background:'#0000'}}).composite([{input:pose,left:Math.round((size-bounds.width)/2),top:218-bounds.height}]).png().toBuffer();
  fs.writeFileSync(path.join(root,'assets/source-2d/dog-gait-base.png'),png);
  if (process.argv.includes('--base-only')) return;
  const raw = await sharp(png).ensureAlpha().raw().toBuffer();
  const legs=[
    {hip:{x:62,y:116},knee:{x:39,y:160},foot:{x:37,y:199},phase:.5},
    {hip:{x:69,y:124},knee:{x:77,y:163},foot:{x:88,y:200},phase:0},
    {hip:{x:141,y:132},knee:{x:134,y:174},foot:{x:140,y:210},phase:.5},
    {hip:{x:170,y:126},knee:{x:191,y:156},foot:{x:212,y:189},neutral:{x:194,y:196},phase:0},
  ];
  const points=[{x:0,y:0,fixed:true},{x:255,y:0,fixed:true},{x:0,y:255,fixed:true},{x:255,y:255,fixed:true}];
  for(const y of [25,75,105])for(const x of [15,45,80,120,160,205,245])points.push({x,y});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  legs.forEach((leg,index)=>{
    points.push({...leg.hip});
    // Two rigid bones, with small skinning regions around the elbow/hock.
    for(const [bone,a,b] of [['upper',leg.hip,leg.knee],['lower',leg.knee,leg.foot]]) {
      const length=distance(a,b),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
      for(const t of (bone==='upper'?[.5,.86]:[.45]))for(const side of [-1,1]) {
        const radius=bone==='upper'?7:6;
        points.push({x:a.x+(b.x-a.x)*t+nx*radius*side,y:a.y+(b.y-a.y)*t+ny*radius*side,leg:index,bone});
      }
    }
    for(const dx of [-11,11])for(const dy of [-7,8])points.push({x:leg.foot.x+dx,y:leg.foot.y+dy,leg:index,bone:'foot'});
  });
  const triangles=triangulate(points);
  const manifest = JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  const output=path.join(root,'assets/source-2d/dog-gait-v3');fs.mkdirSync(output,{recursive:true});
  let unreachable=0;
  function solve(leg,foot,bob) {
    const hip={x:leg.hip.x,y:leg.hip.y+bob};
    const a=distance(leg.hip,leg.knee),b=distance(leg.knee,leg.foot),d=distance(hip,foot);
    if(d>a+b+.01)unreachable++;
    const reach=Math.min(d,a+b-.001),base=Math.atan2(foot.y-hip.y,foot.x-hip.x);
    const cross=(leg.foot.x-leg.hip.x)*(leg.knee.y-leg.hip.y)-(leg.foot.y-leg.hip.y)*(leg.knee.x-leg.hip.x);
    const bend=Math.acos(clamp((a*a+reach*reach-b*b)/(2*a*reach),-1,1));
    return {hip,knee:{x:hip.x+Math.cos(base+Math.sign(cross)*bend)*a,y:hip.y+Math.sin(base+Math.sign(cross)*bend)*a},foot};
  }
  function bonePoint(p,a,b,nextA,nextB) {
    const angle=Math.atan2(nextB.y-nextA.y,nextB.x-nextA.x)-Math.atan2(b.y-a.y,b.x-a.x);
    return {x:nextA.x+(p.x-a.x)*Math.cos(angle)-(p.y-a.y)*Math.sin(angle),y:nextA.y+(p.x-a.x)*Math.sin(angle)+(p.y-a.y)*Math.cos(angle)};
  }
  for (const action of ['walk','run','idle']) {
    const travel = action === 'run' ? 38 : 26;
    const stance = action === 'run' ? .58 : .62;
    const stride = travel / stance;
    const frames=[],buffers=[],n=action==='idle'?12:count;
    for(let frame=0;frame<n;frame++) {
      const phase=frame/n,bob=action==='idle'?6+Math.sin(phase*Math.PI*2)*.45:action==='run'?9+Math.sin(phase*Math.PI*4)*.35:6;
      const pose=legs.map((leg,i)=>{
        // Opposite front/back feet travel together; the other pair is half a
        // cycle behind. Both walking and running keep the same leg order.
        const t=(phase+leg.phase)%1;
        const s=clamp((t-stance)/(1-stance),0,1);
        // Match the backward contact velocity at both ends of the recovery
        // curve, instead of easing to a stop at every lift and touchdown.
        const tangent=-(1-stance)/stance;
        const swing=s*s*(3-2*s)+tangent*(2*s*s*s-3*s*s+s);
        const neutral=leg.neutral??leg.foot;
        const foot={x:neutral.x+(action==='idle'?0:t<stance?travel*(.5-t/stance):travel*(swing-.5)),
          y:neutral.y+(action==='idle'||t<stance?0:-(Math.sin(Math.PI*s)**2)*(action==='run'?11:7))};
        return solve(leg,foot,bob);
      });
      const out=deform(raw,points,triangles,[],phase,p=>{
        if(p.fixed)return p;
        if(p.leg===undefined)return {x:p.x,y:p.y+bob};
        const source=legs[p.leg],target=pose[p.leg];
        if(p.bone==='foot')return {x:p.x+target.foot.x-source.foot.x,y:p.y+target.foot.y-source.foot.y};
        return p.bone==='upper'?bonePoint(p,source.hip,source.knee,target.hip,target.knee):bonePoint(p,source.knee,source.foot,target.knee,target.foot);
      });
      const name=`${action}-${String(frame).padStart(2,'0')}.png`;frames.push(name);
      const png=await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toBuffer();
      buffers.push(png);fs.writeFileSync(path.join(output,name),png);
      if(process.argv.includes('--apply'))fs.writeFileSync(path.join(folder,name),png);
    }
    manifest.animations[action]={frames,fps:action==='idle'?8:48,loop:true,...(action==='idle'?{}:{stride})};
    if(action==='walk') {
      const stacked=await sharp({create:{width:256,height:256*n,channels:4,background:'#0000'}}).composite(buffers.map((input,i)=>({input,left:0,top:i*256}))).raw().toBuffer();
      await sharp(stacked,{raw:{width:256,height:256*n,channels:4,pageHeight:256}}).gif({loop:0,delay:Array.from({length:n},(_,i)=>i%2?20:10),dither:0}).toFile(path.join(root,'blender/dog-walk-v3.gif'));
      await sharp({create:{width:256*6,height:256,channels:4,background:'#eee7dd'}}).composite([0,8,16,24,32,40].map((frame,i)=>({input:buffers[frame],left:i*256,top:0}))).png().toFile(path.join(root,'blender/dog-walk-v3-poses.png'));
    }
  }
  if(unreachable)throw new Error(`${unreachable} unreachable foot positions; shorten the stride`);
  if(process.argv.includes('--apply'))fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Built dog: 48 walk + 48 trot + 12 standing idle frames; fixed bone lengths and grounded stance');
}
module.exports={triangulate,deform};
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
