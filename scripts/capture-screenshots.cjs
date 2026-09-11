// Dev tool: boots the app with a throwaway profile and saves cropped PNG
// screenshots of the pet window (toolbar open) and the picker window, once
// per README language, into docs/screenshots/. Not part of the shipped app.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });
app.setPath('userData', path.resolve(__dirname, '../.capture-profile'));

const LANGUAGES = [
  { code: 'zh-Hant', suffix: '' },
  { code: 'en', suffix: '.en' },
];

setTimeout(() => { console.error('Capture timed out'); app.exit(1); }, 60000);

async function waitFor(win, expression) {
  for (let i = 0; i < 100; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

let petWin = null;
let pickerWin = null;

app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    const isPicker = win.webContents.getURL().endsWith('/picker.html');
    win.showInactive();
    try {
      if (isPicker) {
        await waitFor(win, `document.querySelectorAll('.card').length === 5`);
        pickerWin = win;
      } else {
        await waitFor(win, `document.querySelector('#pet-sprite')?.naturalWidth === 256`);
        petWin = win;
      }
      if (petWin && pickerWin) await captureAllLanguages();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

async function captureAllLanguages() {
  for (const { code, suffix } of LANGUAGES) {
    await pickerWin.webContents.executeJavaScript(`pickerAPI.setLanguage(${JSON.stringify(code)})`);
    await waitFor(petWin, `document.documentElement.lang === ${JSON.stringify(code)}`);
    await waitFor(pickerWin, `document.documentElement.lang === ${JSON.stringify(code)}`);
    await pause(300);

    await petWin.webContents.executeJavaScript(`openTools()`);
    await pause(300);
    const rect = await petWin.webContents.executeJavaScript(`(() => {
      const p = document.querySelector('#pet').getBoundingClientRect();
      const t = document.querySelector('#pet-tools').getBoundingClientRect();
      const left = Math.max(0, Math.min(p.left, t.left) - 20);
      const top = Math.max(0, Math.min(p.top, t.top) - 20);
      const right = Math.max(p.right, t.right) + 20;
      const bottom = Math.max(p.bottom, t.bottom) + 20;
      return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
    })()`);
    const petPng = await petWin.webContents.capturePage(rect);
    fs.writeFileSync(path.join(outDir, `pet${suffix}.png`), petPng.toPNG());

    const pickerPng = await pickerWin.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `picker${suffix}.png`), pickerPng.toPNG());
  }
  app.exit(0);
}

require('../dist/main/main.js');
