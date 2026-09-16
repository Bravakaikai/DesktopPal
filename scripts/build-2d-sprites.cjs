// Package generated pose atlases into transparent, aligned runtime animation frames.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.PET_SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '..');
const size = 256;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

async function extract(file, columns, rows) {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const poses = [];
  for (let index=0; index<columns*rows; index++) {
    const x0=Math.round(index%columns*info.width/columns), y0=Math.round(Math.floor(index/columns)*info.height/rows);
    const width=Math.round((index%columns+1)*info.width/columns)-x0;
    const height=Math.round((Math.floor(index/columns)+1)*info.height/rows)-y0;
    const rgba=Buffer.alloc(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const p=((y+y0)*info.width+x+x0)*4,q=(y*width+x)*4;
      const r=data[p],g=data[p+1],b=data[p+2],excess=g-Math.max(r,b);
      const alpha=1-clamp((excess-5)/60,0,1);
      rgba[q]=r;rgba[q+1]=Math.min(g,Math.max(r,b));rgba[q+2]=b;rgba[q+3]=Math.round(alpha*255);
    }
    // Contract the chroma matte by one source pixel to remove green antialias spill.
    const alphaCopy=Uint8Array.from({length:width*height},(_,p)=>rgba[p*4+3]);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      let a=255;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)a=Math.min(a,alphaCopy[(y+dy)*width+x+dx]);
      rgba[(y*width+x)*4+3]=a;
    }
    // Keep the connected character, dropping detached motion marks and props.
    const visited=new Uint8Array(width*height);let largest=[];
    for(let p=0;p<visited.length;p++){
      if(visited[p]||rgba[p*4+3]<24)continue;
      const component=[p];visited[p]=1;
      for(let n=0;n<component.length;n++){
        const k=component[n],x=k%width,y=Math.floor(k/width);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(x+dx<0||x+dx>=width||y+dy<0||y+dy>=height)continue;
          const j=(y+dy)*width+x+dx;
          if(!visited[j]&&rgba[j*4+3]>=24){visited[j]=1;component.push(j);}
        }
      }
      if(component.length>largest.length)largest=component;
    }
    if(largest.length<width*height*.08)throw Error(`Missing character: ${file} cell ${index}`);
    const keep=new Uint8Array(width*height);let l=width,t=height,r=0,b=0;
    for(const k of largest){keep[k]=1;l=Math.min(l,k%width);r=Math.max(r,k%width);t=Math.min(t,Math.floor(k/width));b=Math.max(b,Math.floor(k/width));}
    for(let p=0;p<keep.length;p++)if(!keep[p])rgba[p*4+3]=0;
    const cropWidth=r-l+1,cropHeight=b-t+1;
    const scale=Math.min(216/cropWidth,198/cropHeight);
    const w=Math.round(cropWidth*scale),h=Math.round(cropHeight*scale);
    const crop=await sharp(rgba,{raw:{width,height,channels:4}}).extract({left:l,top:t,width:cropWidth,height:cropHeight}).resize(w,h).png().toBuffer();
    const png=await sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left:Math.round((size-w)/2),top:218-h}]).png().toBuffer();
    poses.push({png,raw:await sharp(png).raw().toBuffer()});
  }
  return poses;
}

function selectPose(id, action, i, n) {
  if(id==='fish')return ({sleep:2,drag:3,eat:1,sniff:1,stretch:3,react:4,rub:4,wiggle:4,grumpy:5,vomit:1,poop:5,bubbles:5,twirl:4})[action]??0;
  if(action==='walk')return [5,6,7,8][Math.floor(i/n*4)%4];
  if(action==='run')return [5,6,9,7,8,9][Math.floor(i/n*6)%6];
  return ({idle:id==='pig'?0:1,sit:1,sleep:2,stretch:3,drag:4,eat:10,react:11,rub:12,wiggle:13,grumpy:14,poop:15,vomit:16,sniff:17,dig:18,pee:19,groom:18,pounce:19,earwiggle:18,hop:19,roll:18,snuffle:19})[action]??0;
}

function animate(raw,id,action,i,n){
  const out=Buffer.alloc(size*size*4),phase=Math.PI*2*i/n,w=Math.sin(phase);
  let angle=0,sx=1,sy=1,dy=0;
  if(['idle','sit','sleep'].includes(action))sy=1+(.008*w);
  if(['eat','sniff','snuffle','vomit'].includes(action)){angle=.015*w;dy=1.2*w;}
  if(['react','rub','wiggle','earwiggle','roll'].includes(action)){angle=.025*w;dy=-2*Math.max(0,w);}
  if(['run','hop','pounce'].includes(action))dy=-5*Math.max(0,w);
  if(action==='drag'){angle=.065*w;dy=-5;}
  if(action==='poop')sy=1+.015*w;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const pivotY=action==='drag'?70:218;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const xx=x-128,yy=y-pivotY-dy;
    let u=(cos*xx+sin*yy)/sx+128,v=(-sin*xx+cos*yy)/sy+pivotY;
    if(id==='fish'){
      const tail=clamp((105-u)/70,0,1),topFin=clamp((115-v)/65,0,1),bottomFin=clamp((v-170)/45,0,1);
      v+=w*5*tail;u+=Math.sin(phase+.7)*3*(topFin+bottomFin);
      if(action==='drag')v+=Math.sin(clamp((u-25)/210,0,1)*Math.PI)*7;
    } else if(['walk','run','drag','dig'].includes(action)) {
      const limbs=clamp((v-145)/70,0,1);
      u+=Math.sin(phase+(u<128?Math.PI:0))*3*limbs;
    }
    const ix=Math.floor(u),iy=Math.floor(v);if(ix<0||iy<0||ix>=size-1||iy>=size-1)continue;
    const fx=u-ix,fy=v-iy,q=(y*size+x)*4;
    // Premultiplied bilinear sampling keeps transparent fur edges clean.
    let a=0,red=0,green=0,blue=0;
    for(let j=0;j<2;j++)for(let k=0;k<2;k++){
      const p=((iy+j)*size+ix+k)*4,weight=(k?fx:1-fx)*(j?fy:1-fy),wa=weight*raw[p+3]/255;
      a+=wa;red+=raw[p]*wa;green+=raw[p+1]*wa;blue+=raw[p+2]*wa;
    }
    if(a){out[q]=Math.round(red/a);out[q+1]=Math.round(green/a);out[q+2]=Math.round(blue/a);out[q+3]=Math.round(a*255);}
  }
  return out;
}

(async()=>{
  const report=[];
  for(const id of ['dog','rabbit','cat','pig','fish']){
    const poses=await extract(path.join(root,'assets/source-2d',`${id}-atlas.png`),id==='fish'?3:5,id==='fish'?2:4);
    const folder=path.join(root,'assets/pets',id);const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
    manifest.artStyle='illustrated-2d';
    const poseFolder=path.join(root,'assets/source-2d',id);fs.mkdirSync(poseFolder,{recursive:true});
    for(let i=0;i<poses.length;i++)fs.writeFileSync(path.join(poseFolder,`pose-${String(i).padStart(2,'0')}.png`),poses[i].png);
    let frames=0;
    for(const [action,spec] of Object.entries(manifest.animations)){
      for(let i=0;i<spec.frames.length;i++){
        const pose=poses[selectPose(id,action,i,spec.frames.length)];
        await sharp(animate(pose.raw,id,action,i,spec.frames.length),{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(folder,spec.frames[i]));frames++;
      }
    }
    fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));report.push({id,poses:poses.length,frames});console.log(`Built ${id}: ${frames} transparent frames`);
  }
  fs.writeFileSync(path.join(root,'assets/source-2d/build-report.json'),JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exit(1);});
