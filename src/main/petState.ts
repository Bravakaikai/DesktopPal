import { PetState } from "../shared/types";

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export class PetStateManager {
  private saved = new Map<string, PetState>();
  private habits = new Map<string, { digestAt: number; fullFeeds: number; lastFeed: number; rubs: number }>();
  private habit() {
    let value = this.habits.get(this.state.petId);
    if (!value) {
      value = { digestAt: 0, fullFeeds: 0, lastFeed: 0, rubs: 0 };
      this.habits.set(this.state.petId, value);
    }
    return value;
  }
  feedReaction(now = Date.now()): "eat" | "vomit" {
    const habit = this.habit();
    habit.fullFeeds = this.state.hunger >= 95 && now - habit.lastFeed < 30000 ? habit.fullFeeds + 1 : 0;
    habit.lastFeed = now;
    if (habit.fullFeeds >= 2) {
      habit.fullFeeds = 0; habit.digestAt = 0;
      this.state.hunger = clamp(this.state.hunger - 25);
      this.state.mood = clamp(this.state.mood - 8);
      this.state.weight = clamp(this.state.weight - 1);
      return "vomit";
    }
    this.feed();
    if (!habit.digestAt) habit.digestAt = now + 45000;
    return "eat";
  }
  rubReaction(): "rub" | "wiggle" | "react" | "grumpy" {
    const habit = this.habit();
    habit.rubs++;
    this.state.mood = clamp(this.state.mood + 3);
    return (["rub", "wiggle", "react", "grumpy"] as const)[(habit.rubs - 1) % 4];
  }
  nextAutonomousAction(now = Date.now()): "poop" | null {
    const habit = this.habit();
    if (!habit.digestAt || now < habit.digestAt) return null;
    habit.digestAt = 0;
    return "poop";
  }
  clean(): PetState {
    this.state.mood = clamp(this.state.mood + 2);
    return this.getState();
  }
  private state: PetState = {
    petId: "dog",
    name: "",
    hunger: 80,
    mood: 70,
    weight: 35,
    growth: 0,
  };

  getState(): PetState {
    return { ...this.state };
  }
  select(petId: string): PetState {
    this.saved.set(this.state.petId, this.getState());
    this.state = this.saved.get(petId) ?? { petId, name: "", hunger: 80, mood: 70, weight: 35, growth: 0 };
    return this.getState();
  }
  rename(name: string): PetState {
    this.state.name = name.trim().slice(0, 24);
    return this.getState();
  }

  pet(): PetState {
    this.state.mood = clamp(this.state.mood + 15);
    return this.getState();
  }

  feed(): PetState {
    this.state.weight = clamp(this.state.weight + 3);
    this.state.growth = clamp(this.state.growth + 2);
    this.state.hunger = clamp(this.state.hunger + 30);
    this.state.mood = clamp(this.state.mood + 5);
    return this.getState();
  }

  decay(): PetState {
    this.state.hunger = clamp(this.state.hunger - 2);
    if (this.state.hunger < 30) this.state.weight = clamp(this.state.weight - .6);
    // 太餓的時候心情也會跟著下降
    this.state.mood = clamp(this.state.mood - (this.state.hunger < 30 ? 4 : 1));
    return this.getState();
  }
  serialize(): { active: string; pets: PetState[] } {
    this.saved.set(this.state.petId, this.getState());
    return { active: this.state.petId, pets: [...this.saved.values()] };
  }
  restore(input: unknown): void {
    if (!input || typeof input !== "object") return;
    const snapshot = input as { active?: string; pets?: unknown[] };
    if (!Array.isArray(snapshot.pets)) return;
    const number = (value: unknown, fallback: number): number => typeof value === "number" && Number.isFinite(value) ? clamp(value) : fallback;
    for (const value of snapshot.pets) {
      if (!value || typeof value !== "object") continue;
      const saved = value as Partial<PetState>;
      if (!saved.petId || !["dog","cat","rabbit","pig","fish"].includes(saved.petId)) continue;
      this.saved.set(saved.petId, {petId:saved.petId,name:typeof saved.name === "string" ? saved.name.trim().slice(0,24) : "",
        hunger:number(saved.hunger,80),mood:number(saved.mood,70),weight:number(saved.weight,35),growth:number(saved.growth,0)});
    }
    this.state = this.saved.get(snapshot.active ?? "dog") ?? this.saved.get("dog") ?? this.state;
  }
}
