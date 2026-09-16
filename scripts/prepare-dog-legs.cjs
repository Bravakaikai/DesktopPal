// Extract the repainted, consistently stocky limbs without changing their alpha.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
  const source=path.join(root,'assets/source-2d/dog-legs-atlas-v2.png');
  const output=path.join(root,'assets/source-2d/dog-rig-v2');
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const names=['near-front','near-rear','far-front','far-rear'],parts=[];
  fs.mkdirSync(output,{recursive:true});
  for(let i=0;i<4;i++){
    const x0=(i%2)*info.width/2,y0=Math.floor(i/2)*info.height/2;
    let left=info.width,top=info.height,right=-1,bottom=-1,transparent=0;
    for(let y=y0;y<y0+info.height/2;y++)for(let x=x0;x<x0+info.width/2;x++){
      const alpha=data[(y*info.width+x)*4+3];
      if(alpha===0)transparent++;
      if(alpha<32)continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    assert.ok(transparent>info.width*info.height/8,'Each limb has real transparent surroundings');
    assert.ok(right>left&&bottom>top,'A complete limb occupies each atlas cell');
    left=Math.max(x0,left-3);top=Math.max(y0,top-3);
    right=Math.min(x0+info.width/2-1,right+3);bottom=Math.min(y0+info.height/2-1,bottom+3);
    const bounds={left,top,width:right-left+1,height:bottom-top+1};
    await sharp(source).extract(bounds).png().toFile(path.join(output,names[i]+'.png'));
    parts.push({name:names[i],...bounds});
  }
  fs.copyFileSync(path.join(root,'assets/source-2d/dog-rig-v1/body.png'),path.join(output,'body.png'));
  fs.writeFileSync(path.join(output,'parts.json'),JSON.stringify(parts,null,2));
  console.log(parts);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1)});
