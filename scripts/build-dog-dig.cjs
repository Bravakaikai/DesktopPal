// Animate the existing drawing as one connected mesh; no blended silhouettes.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {triangulate,deform}=require('./build-dog-gait.cjs');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'assets/pets/dog');
const frameCount=24,fps=32;
// Lift together, reach forward, plant both paws, then scrape back with force.
const keys=[{t:0,x:-15,y:-7},{t:.26,x:17,y:-22},{t:.46,x:21,y:0},{t:.77,x:-17,y:0},{t:1,x:-15,y:-7}];
function motion(phase) {
  const end=keys.findIndex(key=>key.t>phase),a=keys[end-1],b=keys[end];
  const t=(phase-a.t)/(b.t-a.t),ease=t*t*(3-2*t);
  return {x:a.x+(b.x-a.x)*ease,y:a.y+(b.y-a.y)*ease};
}
async function main() {
  const raw=await sharp(path.join(root,'assets/source-2d/dog-dig-base.png')).ensureAlpha().raw().toBuffer();
  const points=[{x:0,y:0},{x:255,y:0},{x:0,y:255},{x:255,y:255}];
  // Hind feet stay planted while the chest, neck and ears follow the stroke.
  for(const [x,y] of [[18,85],[26,142],[24,210],[66,210],[75,155]])points.push({x,y});
  for(const [x,y] of [[30,63],[66,61],[83,86],[93,124],[114,147]])points.push({x,y,part:'body'});
  for(const [x,y] of [[29,19],[63,19],[90,45]])points.push({x,y,part:'tail'});
  for(const [x,y] of [[99,36],[144,33],[188,33],[241,43],[96,83],[139,83],[193,91],[243,100],[131,147],[177,153],[232,156]])points.push({x,y,part:'head'});
  for(const [x,y] of [[105,60],[121,76],[112,105]])points.push({x,y,part:'ear'});
  for(const [paw,box] of [[0,[118,157,180,206]],[1,[174,205,194,220]]]) {
    for(const x of [box[0],box[1]])for(const y of [box[2],box[3]])points.push({x,y,paw});
  }
  const triangles=triangulate(points),buffers=[],frames=[];
  for(let i=0;i<frameCount;i++) {
    const phase=i/frameCount,stroke=motion(phase),effort=Math.sin(phase*Math.PI*2-Math.PI/2);
    const transform=p=>{
      if(p.paw!==undefined)return {x:p.x+stroke.x,y:p.y+stroke.y+(p.paw===0?12:0)};
      if(p.part==='body')return {x:p.x+stroke.x*.12,y:p.y+effort*2.4};
      if(p.part==='tail')return {x:p.x+Math.sin(phase*Math.PI*2+.6)*3,y:p.y-effort*2};
      if(p.part==='head'||p.part==='ear') {
        const angle=.035+effort*.045,dx=p.x-107,dy=p.y-131;
        return {x:107+dx*Math.cos(angle)-dy*Math.sin(angle)+stroke.x*.08,
          y:131+dx*Math.sin(angle)+dy*Math.cos(angle)+effort*1.2+(p.part==='ear'?Math.sin(phase*Math.PI*2-1)*2.5:0)};
      }
      return p;
    };
    const out=deform(raw,points,triangles,[],phase,transform);
    const name=`dig-${String(i).padStart(2,'0')}.png`;
    const png=await sharp(out,{raw:{width:256,height:256,channels:4}}).png().toBuffer();
    fs.writeFileSync(path.join(folder,name),png);buffers.push(png);frames.push(name);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  manifest.animations.dig={frames,fps,loop:true};
  manifest.behaviors.find(item=>item.action==='dig').duration=3.75;
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  // Export a loop preview and six chronological checkpoints for visual QA.
  const stacked=await sharp({create:{width:256,height:256*frameCount,channels:4,background:'#0000'}})
    .composite(buffers.map((input,i)=>({input,left:0,top:i*256}))).raw().toBuffer();
  await sharp(stacked,{raw:{width:256,height:256*frameCount,channels:4,pageHeight:256}})
    .gif({loop:0,delay:Array(frameCount).fill(Math.round(1000/fps)),dither:0}).toFile(path.join(root,'blender/dog-dig-preview.gif'));
  await sharp({create:{width:256*6,height:256,channels:4,background:'#eee7dd'}})
    .composite([0,4,8,12,16,20].map((frame,i)=>({input:buffers[frame],left:i*256,top:0}))).png().toFile(path.join(root,'blender/dog-dig-contact-sheet.png'));
  console.log(`Built dog digging: ${frameCount} connected frames, synchronized paws, planted hind feet`);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
