const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),size=256;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
async function main(){
  for(const id of ['cat','rabbit']){
    const folder=path.join(root,'assets/pets',id),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
    const base=path.join(root,'assets/source-2d',`${id}-drag-clean-base.png`);
    if(!fs.existsSync(base))fs.copyFileSync(path.join(folder,manifest.animations.drag.frames[0]),base);
    const source=await sharp(base).ensureAlpha().raw().toBuffer(),n=manifest.animations.drag.frames.length;
    const output=path.join(root,'assets/source-2d',`${id}-drag-v2`);fs.mkdirSync(output,{recursive:true});
    for(let i=0;i<n;i++){
      const wave=Math.sin(i/n*Math.PI*2),angle=.065*wave,cos=Math.cos(angle),sin=Math.sin(angle),out=Buffer.alloc(source.length);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const xx=x-128,yy=y-70;
        let u=cos*xx+sin*yy+128,v=-sin*xx+cos*yy+70;
        // The old abrupt sign change at x=128 split paws crossing the centre.
        // This continuous field cannot jump from one side of a leg to another.
        u+=wave*3*clamp((v-145)/70,0,1)*Math.tanh((u-128)/18);
        const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,q=(y*size+x)*4;
        if(ix<0||iy<0||ix>=255||iy>=255)continue;
        let a=0,r=0,g=0,b=0;
        for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
          const k=((iy+dy)*size+ix+dx)*4,w=(dx?fx:1-fx)*(dy?fy:1-fy)*source[k+3]/255;
          a+=w;r+=source[k]*w;g+=source[k+1]*w;b+=source[k+2]*w;
        }
        if(a){out[q]=r/a;out[q+1]=g/a;out[q+2]=b/a;out[q+3]=a*255;}
      }
      await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(output,manifest.animations.drag.frames[i]));
    }
    if(process.argv.includes('--apply'))for(const file of manifest.animations.drag.frames)fs.copyFileSync(path.join(output,file),path.join(folder,file));
    console.log(`Rebuilt ${id}: ${n} continuous drag frames`);
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
