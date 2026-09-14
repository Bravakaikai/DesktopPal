export interface PetState {
  petId: string;
  name: string; // custom nickname; empty means "use the species default name"
  hunger: number; // 0 (餓) - 100 (飽)
  mood: number; // 0 (低落) - 100 (開心)
  weight: number; // 0 (瘦) - 100 (圓潤), changes gradually through feeding/hunger
  growth: number; // 0 (幼小) - 100 (長大), grows with meals
}

export type InteractionType = "pet" | "feed" | "clean" | "rub";
export type PetAction = "eat" | "react" | "sleep" | "rub" | "wiggle" | "grumpy" | "poop" | "pee" | "vomit" | "clean" | "place-food";
