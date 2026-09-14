const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const destination=path.join(root,'assets/source-2d/dog-rig-v1');
async function main(){
  const {data,info}=await sharp(path.join(root,'assets/source-2d/dog-rig-atlas-v1.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info,visited=new Uint8Array(width*height),queue=[];
  // The supplied atlas has a neutral preview matte. Only flood-connected
  // neutral background is removed; enclosed eye highlights remain untouched.
  const neutral=p=>Math.max(data[p*4],data[p*4+1],data[p*4+2])-Math.min(data[p*4],data[p*4+1],data[p*4+2])<26&&data[p*4]>110;
  for(let y=0;y<height;y++)for(const x of [0,width-1]){const p=y*width+x;if(!visited[p]&&neutral(p)){visited[p]=1;queue.push(p);}}
  for(let x=0;x<width;x++)for(const y of [0,height-1]){const p=y*width+x;if(!visited[p]&&neutral(p)){visited[p]=1;queue.push(p);}}
  for(let i=0;i<queue.length;i++){
    const p=queue[i],x=p%width,y=Math.floor(p/width);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,q=ny*width+nx;
      if(nx<0||nx>=width||ny<0||ny>=height||visited[q]||!neutral(q))continue;
      visited[q]=1;queue.push(q);
    }
  }
  for(const p of queue)data[p*4+3]=0;
  const seen=new Uint8Array(width*height),parts=[];
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*4+3]<32)continue;
    const pixels=[p];seen[p]=1;
    let l=width,t=height,r=0,b=0;
    for(let i=0;i<pixels.length;i++){
      const q=pixels[i],x=q%width,y=Math.floor(q/width);
      l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,k=ny*width+nx;
        if(nx<0||nx>=width||ny<0||ny>=height||seen[k]||data[k*4+3]<32)continue;
        seen[k]=1;pixels.push(k);
      }
    }
    if(pixels.length>5000)parts.push({pixels,l,t,r,b});
  }
  if(parts.length!==5)throw Error(`Expected body + four complete limbs, got ${parts.length}`);
  parts.sort((a,b)=>Math.floor(a.t/(height/2))-Math.floor(b.t/(height/2))||a.l-b.l);
  fs.mkdirSync(destination,{recursive:true});
  const names=['body','near-front','near-rear','far-front','far-rear'];
  const report=[];
  for(let i=0;i<parts.length;i++){
    const part=parts[i],w=part.r-part.l+1,h=part.b-part.t+1,rgba=Buffer.alloc(w*h*4);
    for(const p of part.pixels){const x=p%width-part.l,y=Math.floor(p/width)-part.t;data.copy(rgba,(y*w+x)*4,p*4,p*4+4);}
    await sharp(rgba,{raw:{width:w,height:h,channels:4}}).png().toFile(path.join(destination,names[i]+'.png'));
    report.push({name:names[i],width:w,height:h,left:part.l,top:part.t});
  }
  fs.writeFileSync(path.join(destination,'parts.json'),JSON.stringify(report,null,2));
  console.log(report);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
