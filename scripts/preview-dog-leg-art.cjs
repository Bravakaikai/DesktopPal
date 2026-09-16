const path=require('node:path');
const sharp=require(process.env.PET_SHARP_PATH || 'C:/Users/kelly.huang.KELLYHUANG-PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
  const files=['assets/pets/dog/sit-00.png','assets/source-2d/dog-rig-v2/previous-walk-00.png','assets/source-2d/dog-gait-v6/walk-00.png'];
  await sharp({create:{width:768,height:256,channels:4,background:'#eee7dd'}})
    .composite(files.map((file,i)=>({input:path.join(root,file),left:i*256,top:0})))
    .png().toFile(path.join(root,'blender/dog-leg-art-before-after.png'));
})().catch(error=>{console.error(error);process.exit(1)});
