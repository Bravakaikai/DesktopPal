export interface ReminderSettings { enabled: boolean; stretchMinutes: number; waterMinutes: number }
export type ReminderKind = "stretch" | "water";
export class ReminderClock {
  settings: ReminderSettings = { enabled: true, stretchMinutes: 45, waterMinutes: 60 };
  private due: Record<ReminderKind, number>;
  constructor(now = Date.now()) { this.due = { stretch: now + 45 * 60000, water: now + 60 * 60000 }; }
  update(value: Partial<ReminderSettings>, now = Date.now()): ReminderSettings {
    const minutes = (n: unknown, fallback: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(5, Math.min(180, Math.round(n))) : fallback;
    this.settings = { enabled: typeof value.enabled === "boolean" ? value.enabled : this.settings.enabled,
      stretchMinutes: minutes(value.stretchMinutes, this.settings.stretchMinutes), waterMinutes: minutes(value.waterMinutes, this.settings.waterMinutes) };
    this.acknowledge("stretch", false, now); this.acknowledge("water", false, now); return { ...this.settings };
  }
  acknowledge(kind: ReminderKind, snooze = false, now = Date.now()): void {
    this.due[kind] = now + (snooze ? 5 : kind === "stretch" ? this.settings.stretchMinutes : this.settings.waterMinutes) * 60000;
  }
  tick(now = Date.now(), idleSeconds = 0): ReminderKind | null {
    if (idleSeconds >= 180) this.acknowledge("stretch", false, now);
    if (!this.settings.enabled || idleSeconds >= 60) return null;
    const kind = (["stretch", "water"] as const).find(kind => now >= this.due[kind]);
    if (!kind) return null;
    this.acknowledge(kind, false, now); return kind;
  }
}
