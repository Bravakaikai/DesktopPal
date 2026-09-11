import { contextBridge, ipcRenderer } from "electron";
import { PetState, InteractionType, PetAction } from "../shared/types";

contextBridge.exposeInMainWorld("petAPI", {
  getLanguage: () => ipcRenderer.invoke("get-language"),
  setLanguage: (language: string) => ipcRenderer.invoke("set-language", language),
  onLanguage: (callback: (language: string) => void) => ipcRenderer.on("language-changed", (_event, language) => callback(language)),
  getReminders: () => ipcRenderer.invoke("get-reminders"),
  setReminders: (settings: unknown) => ipcRenderer.invoke("set-reminders", settings),
  acknowledgeReminder: (kind: string, snooze: boolean) => ipcRenderer.send("reminder-ack", kind, snooze),
  onReminder: (callback: (kind: "water" | "stretch") => void) => ipcRenderer.on("reminder", (_event, kind) => callback(kind)),
  getCatalog: () => ipcRenderer.invoke("get-pet-catalog"),
  selectPet: (id: string) => ipcRenderer.send("select-pet", id),
  revealPet: () => ipcRenderer.send("reveal-pet"),
  renamePet: (name: string) => ipcRenderer.send("rename-pet", name),
  openPicker: () => ipcRenderer.send("open-picker"),
  getPetVisible: (): Promise<boolean> => ipcRenderer.invoke("get-pet-visible"),
  setPetVisible: (visible: boolean) => ipcRenderer.send("set-pet-visible", visible),
  onPetVisibleChange: (callback: (visible: boolean) => void) =>
    ipcRenderer.on("pet-visible-update", (_event, visible) => callback(visible)),
  getState: (): Promise<PetState> => ipcRenderer.invoke("get-state"),
  interact: (type: InteractionType) => ipcRenderer.send("interact", type),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send("set-ignore-mouse-events", ignore),
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
  onResetPosition: (callback: () => void) => ipcRenderer.on("reset-position", callback),
  onAction: (callback: (action: PetAction) => void) => {
    ipcRenderer.on("pet-action", (_event, action) => callback(action));
  },
  onStateUpdate: (callback: (state: PetState) => void) => {
    ipcRenderer.on("state-update", (_event, state: PetState) => callback(state));
  },
});
