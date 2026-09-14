const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
function components(data){
  const seen=new Uint8Array(256*256),groups=[];
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*4+3]<32)continue;
    const pixels=[p];seen[p]=1;
    for(let i=0;i<pixels.length;i++){
      const x=pixels[i]%256,y=pixels[i]>>8;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,k=ny*256+nx;
        if(nx<0||nx>255||ny<0||ny>255||seen[k]||data[k*4+3]<32)continue;
        seen[k]=1;pixels.push(k);
      }
    }
    groups.push(pixels.length);
  }
  return groups.sort((a,b)=>b-a);
}
async function main(){
  const reports=[];
  for(const id of ['dog','cat','rabbit','pig','fish']){
    const folder=path.join(root,'assets/pets',id),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
    const report={id,checked:0,detached:[]};
    for(const [action,spec] of Object.entries(manifest.animations))for(const file of spec.frames){
      const {data,info}=await sharp(path.join(folder,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,256);assert.equal(info.height,256);
      assert.equal(data[3],0,'Sprites have a transparent background');
      const groups=components(data);
      if(groups[1]>=12)report.detached.push({action,file,sizes:groups.slice(0,4)});
      report.checked++;
    }
    reports.push(report);
  }
  fs.writeFileSync(path.join(root,'blender/pet-layer-audit-after.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports));
  assert.ok(reports.every(report=>report.detached.length===0),'No detached limb fragments in any pet animation');
}
module.exports={components,main};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
