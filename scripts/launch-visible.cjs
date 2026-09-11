const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    if (win.webContents.getURL().endsWith('/picker.html')) {
      win.show(); win.focus();
      for (let attempt = 0; attempt < 50; attempt++) {
        const cards = await win.webContents.executeJavaScript(`document.querySelectorAll('.card').length`);
        if (cards === 5) {
          fs.writeFileSync(path.join(__dirname, '../blender/picker-status.json'), JSON.stringify({ visible: win.isVisible(), bounds: win.getBounds(), cards }));
          await new Promise(resolve => setTimeout(resolve,300));
          const image=await win.webContents.capturePage();
          if(!image.isEmpty())fs.writeFileSync(path.join(__dirname,'../blender/compact-picker-preview.png'),image.toPNG());
          return;
        }
        await new Promise(resolve => setTimeout(resolve,100));
      }
      return;
    }
    win.showInactive();
    for (let attempt = 0; attempt < 50; attempt++) {
      const sprite = await win.webContents.executeJavaScript(`(() => {
        const pet = document.querySelector('#pet');
        const image = document.querySelector('#pet-sprite');
        return { title: pet?.title, source: image?.src, width: image?.naturalWidth, displayWidth: pet?.getBoundingClientRect().width, tools:document.querySelectorAll('#pet-tools > button').length, vitals:document.querySelectorAll('#pet-vitals meter').length };
      })()`);
      if (sprite.width === 256 && sprite.title) {
        fs.writeFileSync(path.join(__dirname, '../blender/launch-status.json'), JSON.stringify({ visible: win.isVisible(), bounds: win.getBounds(), sprite }, null, 2));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.error('Pet did not finish loading');
  });
});
require('../dist/main/main.js');
