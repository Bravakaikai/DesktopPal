// Compile a fixed character into a distance-driven, four-beat walking cycle.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'assets/pets/dog');
const size = 256, count = 32;
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
  // Paws: rear far, rear near, front near, front far; offsets form a four-beat walk.
  const paws = [{x:37,y:199,phase:.5},{x:87,y:202,phase:0},{x:142,y:211,phase:.75},{x:214,y:189,phase:.25}];
  const points=[{x:0,y:0},{x:255,y:0},{x:0,y:255},{x:255,y:255}];
  for(const y of [80,120,145])for(const x of [0,40,80,120,160,200,255])points.push({x,y});
  paws.forEach((p,paw)=>{for(const dx of [-12,12])for(const dy of [-10,9])points.push({x:p.x+dx,y:p.y+dy,paw});});
  const triangles=triangulate(points);
  const manifest = JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  for (const action of ['walk','run']) {
    const travel = action === 'run' ? 42 : 32;
    const stance = action === 'run' ? .55 : .65;
    const stride = travel / stance;
    const frames=[];
    for(let frame=0;frame<count;frame++) {
      const phase=frame/count;
      const shifts=paws.map((p,i)=>{
        const t=(phase+(action==='run'?[.5,0,.5,0][i]:p.phase))%1;
        // Constant backward motion during foot contact, eased forward recovery.
        const s=clamp((t-stance)/(1-stance),0,1);
        const swing=s*s*(3-2*s);
        return {x: t<stance ? travel*(.5-t/stance) : travel*(swing-.5), y:(p.x>200?20:0)+(t<stance?0:-Math.sin(Math.PI*s)*(action==='run'?14:10))};
      });
      const out=deform(raw,points,triangles,shifts,phase);
      const name=`${action}-${String(frame).padStart(2,'0')}.png`;frames.push(name);
      await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(folder,name));
    }
    manifest.animations[action]={frames,fps:30,loop:true,stride};
  }
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Built dog: 32 walk + 32 trot frames, fixed body and four alternating paw contacts');
}
module.exports={triangulate,deform};
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
