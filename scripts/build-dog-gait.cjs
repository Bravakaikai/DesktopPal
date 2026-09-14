// Compile a fixed character into a distance-driven, four-beat walking cycle.
const size = 256;
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
async function main() { return require("./build-dog-clean-gait.cjs").main(); }
module.exports={triangulate,deform};
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
