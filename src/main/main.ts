import { app, BrowserWindow, ipcMain, Menu, screen, Tray, powerMonitor } from "electron";
import { ReminderClock, ReminderKind, ReminderSettings } from "./reminders";
import * as path from "path";
import * as fs from "fs";
import { PetStateManager } from "./petState";
import { createTrayIcon } from "./trayIcon";
import { InteractionType, PetAction } from "../shared/types";

// Lose 2 fullness points every two minutes: a full pet needs about 56 minutes
// to reach the hungry warning, and a meal restores about 30 minutes of fullness.
const DECAY_INTERVAL_MS = 2 * 60_000;

let petWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pickerWindow: BrowserWindow | null = null;
const petState = new PetStateManager();
const reminders = new ReminderClock();
let language = "system";
const catalog: { id: string; name: string }[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../assets/pets/catalog.json"), "utf8")
);
function playAction(action: PetAction): void {
  if (action === "eat") { action = petState.feedReaction(); broadcastState(); }
  if (action === "react") broadcastState(petState.pet());
  petWindow?.webContents.send("pet-action", action);
}
function petMenu(): Electron.MenuItemConstructorOptions {
  return { label: "切換寵物", submenu: catalog.map(({ id, name }) => ({
    label: name, type: "radio", checked: petState.getState().petId === id,
    click: () => { broadcastState(petState.select(id)); updateTrayMenu(); },
  })) };
}
function actionMenuItems(): Electron.MenuItemConstructorOptions[] {
  return [
    { label: "餵食", click: () => playAction("place-food") },
    { label: "摸摸", click: () => playAction("react") },
    { label: "休息一下", click: () => playAction("sleep") },
    { label: "清理畫面", click: () => playAction("clean") },
  ];
}

function createPetWindow(): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height, x, y } = display.workArea;

  petWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: process.argv.some(arg => arg.includes("smoke-pets")),
    },
  });

  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 預設整個視窗滑鼠事件穿透，只有 renderer 偵測到游標在寵物身上時才會關閉穿透
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  petWindow.webContents.on("console-message", (_event, _level, message, line, sourceId) => {
    console.log(`[renderer console] ${sourceId}:${line} ${message}`);
  });
  petWindow.webContents.on("render-process-gone", (_event, details) => {
    console.log(`[renderer crashed] ${JSON.stringify(details)}`);
  });
  petWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.log(`[did-fail-load] ${errorCode} ${errorDescription}`);
  });

  petWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function revealPet(): void {
  if (!petWindow) return;
  const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  petWindow.setBounds({ x, y, width, height });
  petWindow.webContents.send("reset-position");
  petWindow.showInactive();
  petWindow.moveTop();
}

function showPicker(): void {
  if (pickerWindow) { pickerWindow.show(); pickerWindow.focus(); return; }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(800, area.width);
  const height = Math.min(510, area.height);
  pickerWindow = new BrowserWindow({ width, height,
    x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2),
    title: "DesktopPal · 寵物選擇", backgroundColor: "#1e1e1e", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "../preload/preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  pickerWindow.on("closed", () => { pickerWindow = null; });
  pickerWindow.once("ready-to-show", () => { pickerWindow?.show(); pickerWindow?.focus(); });
  pickerWindow.loadFile(path.join(__dirname, "../renderer/picker.html"));
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("DesktopPal");
  tray.on("click", showPicker);
  updateTrayMenu();
}

function updateTrayMenu(): void {
  const menu = Menu.buildFromTemplate([
    { label: "開啟寵物選擇", click: showPicker },
    { label: "把寵物帶到這個螢幕", click: revealPet },
    petMenu(),
    ...actionMenuItems(),
    { type: "separator" },
    {
      label: "顯示 / 隱藏寵物",
      click: () => setPetVisible(!petWindow?.isVisible()),
    },
    { type: "separator" },
    {
      label: "結束",
      click: () => app.quit(),
    },
  ]);

  tray?.setContextMenu(menu);
}

function broadcastState(state = petState.getState()): void {
  try {
    const file=path.join(app.getPath("userData"),"pet-state.json");
    fs.writeFileSync(`${file}.tmp`,JSON.stringify(petState.serialize()));
    fs.renameSync(`${file}.tmp`,file);
  } catch (error) { console.error("Could not save pet progress",error); }
  petWindow?.webContents.send("state-update", state);
  pickerWindow?.webContents.send("state-update", state);
}

function setPetVisible(visible: boolean): void {
  if (!petWindow) return;
  visible ? petWindow.show() : petWindow.hide();
  pickerWindow?.webContents.send("pet-visible-update", visible);
}

app.whenReady().then(() => {
  const languageFile = path.join(app.getPath("userData"), "language.json");
  const languages = ["system", "zh-Hant", "zh-Hans", "en"];
  try { const saved=JSON.parse(fs.readFileSync(languageFile,"utf8"));if(languages.includes(saved))language=saved; } catch { /* Use system language on first launch. */ }
  const settingsFile = path.join(app.getPath("userData"), "reminders.json");
  try { reminders.update(JSON.parse(fs.readFileSync(settingsFile, "utf8"))); } catch { /* First launch uses defaults. */ }
  try { petState.restore(JSON.parse(fs.readFileSync(path.join(app.getPath("userData"),"pet-state.json"),"utf8"))); } catch { /* New pets start small. */ }
  createPetWindow();
  createTray();
  if (!process.argv.some(arg => arg.includes("smoke-pets"))) showPicker();

  setInterval(() => broadcastState(petState.decay()), DECAY_INTERVAL_MS);
  setInterval(() => {
    const action = petState.nextAutonomousAction();
    if (action) playAction(action);
    const reminder = reminders.tick(Date.now(), powerMonitor.getSystemIdleTime());
    if (reminder) petWindow?.webContents.send("reminder", reminder);
  }, 1000);

  ipcMain.handle("get-state", () => petState.getState());
  ipcMain.handle("get-language", () => language);
  ipcMain.handle("set-language", (_event, next: string) => {
    if(!languages.includes(next))return language;
    language=next;fs.writeFileSync(languageFile,JSON.stringify(language));
    for(const window of BrowserWindow.getAllWindows())window.webContents.send("language-changed",language);
    return language;
  });
  ipcMain.handle("get-pet-catalog", () => catalog);
  ipcMain.handle("get-reminders", () => ({ ...reminders.settings }));
  ipcMain.handle("set-reminders", (_event, settings: Partial<ReminderSettings>) => {
    if (!settings || typeof settings !== "object") return { ...reminders.settings };
    const result = reminders.update(settings);
    fs.writeFileSync(settingsFile, JSON.stringify(result)); return result;
  });
  ipcMain.on("reminder-ack", (_event, kind: ReminderKind, snooze: boolean) => {
    if (kind === "water" || kind === "stretch") reminders.acknowledge(kind, !!snooze);
  });
  ipcMain.on("select-pet", (event, id: string) => {
    if (!catalog.some(pet => pet.id === id)) return;
    broadcastState(petState.select(id)); updateTrayMenu();
    if (event.sender === pickerWindow?.webContents) revealPet();
  });
  ipcMain.on("reveal-pet", revealPet);
  ipcMain.on("rename-pet", (_event, name: string) => {
    if (typeof name !== "string") return;
    broadcastState(petState.rename(name));
  });
  ipcMain.on("open-picker", showPicker);
  ipcMain.handle("get-pet-visible", () => petWindow?.isVisible() ?? true);
  ipcMain.on("set-pet-visible", (_event, visible: boolean) => setPetVisible(!!visible));

  ipcMain.on("interact", (_event, type: InteractionType) => {
    if (type === "pet") playAction("react");
    if (type === "feed") playAction("eat");
    if (type === "rub") {
      const action = petState.rubReaction(); broadcastState(); playAction(action);
    }
    if (type === "clean") broadcastState(petState.clean());
  });

  ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
    petWindow?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on("show-context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
      petMenu(),
      ...actionMenuItems(),
      { type: "separator" },
      { label: "隱藏", click: () => setPetVisible(false) },
      { label: "結束", click: () => app.quit() },
    ]);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) menu.popup({ window: win });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
