// Dev tool: composes build/icon.png (1024x1024) from the pug artwork on a
// rounded gradient background, using Chromium's own <canvas> (no extra
// image-processing dependency needed). electron-builder auto-generates the
// per-platform .ico/.icns from this single file. Not part of the shipped app.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.resolve(__dirname, '../build');
fs.mkdirSync(outDir, { recursive: true });
app.setPath('userData', path.resolve(__dirname, '../.icon-profile'));

const size = 1024;
const petImage = path.resolve(__dirname, '../assets/pets/dog/idle-00.png').replace(/\\/g, '/');
const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const grad = ctx.createLinearGradient(0, 0, ${size}, ${size});
grad.addColorStop(0, '#ffdca8');
grad.addColorStop(1, '#ff9a3c');
roundRect(0, 0, ${size}, ${size}, ${Math.round(size * 0.22)});
ctx.fillStyle = grad;
ctx.fill();
const img = new Image();
img.onload = () => {
  const scale = (${size} * 0.82) / Math.max(img.width, img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (${size} - w) / 2, (${size} - h) / 2 + ${size} * 0.03, w, h);
  window.__ready = true;
};
img.onerror = () => { window.__error = true; };
img.src = 'file://${petImage}';
</script>
</body></html>`;
const htmlPath = path.resolve(__dirname, '../.icon-profile-template.html');
fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
fs.writeFileSync(htmlPath, html);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: size, height: size, useContentSize: true, frame: false, show: false, webPreferences: { offscreen: false } });
  await win.loadFile(htmlPath);
  for (let i = 0; i < 100; i++) {
    const state = await win.webContents.executeJavaScript(`({ ready: window.__ready, error: window.__error })`);
    if (state.error) throw new Error('Failed to load pet image for icon');
    if (state.ready) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const png = await win.webContents.capturePage();
  fs.writeFileSync(path.join(outDir, 'icon.png'), png.toPNG());
  fs.rmSync(htmlPath, { force: true });
  console.log('Wrote build/icon.png');
  app.exit(0);
});
