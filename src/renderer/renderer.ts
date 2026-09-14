// This file is loaded as a plain browser script; no imports or exports.
interface PetState { petId: string; name: string; hunger: number; mood: number; weight: number; growth: number }
type Action = "idle" | "walk" | "run" | "sit" | "sniff" | "stretch" | "react" | "eat" | "sleep" | "drag" | "rub" | "wiggle" | "grumpy" | "poop" | "vomit" | "dig" | "pee" | "groom" | "pounce" | "earwiggle" | "hop" | "roll" | "snuffle" | "bubbles" | "twirl";
type IncomingAction = "eat" | "react" | "sleep" | "rub" | "wiggle" | "grumpy" | "poop" | "pee" | "vomit" | "clean" | "place-food";
interface Behavior { action: Action; duration: number; weight: number; speedScale: number }
interface PetManifest {
  id: string; name: string; motion: "ground" | "float" | "hop"; speed: number; displaySize: number;
  animations: Partial<Record<Action, { frames: string[]; fps: number; loop: boolean; stride?: number }>>;
  behaviors?: Behavior[];
  rest?: { afterMovingSeconds: number; sleepSeconds: number; edgeInset: number };
}
interface PetAPI {
  getState(): Promise<PetState>; interact(type: "pet" | "feed" | "clean" | "rub"): void;
  setIgnoreMouseEvents(ignore: boolean): void; showContextMenu(): void;
  onStateUpdate(callback: (state: PetState) => void): void;
  onAction(callback: (action: IncomingAction) => void): void;
  onResetPosition(callback: () => void): void;
  onReminder(callback: (kind: "water" | "stretch") => void): void;
  acknowledgeReminder(kind: "water" | "stretch", snooze: boolean): void;
  openPicker(): void;
}
const ui = (window as unknown as { PetUI: { zh: boolean; t(key: string): string; icon(key: string): string; prompt(kind: string, index?: number): { text: string; index: number } } }).PetUI;
const api = (window as unknown as { petAPI: PetAPI }).petAPI;
const stage = document.getElementById("stage") as HTMLDivElement;
const pet = document.getElementById("pet") as HTMLDivElement;
const sprite = document.getElementById("pet-sprite") as HTMLImageElement;
const moodBadge = document.getElementById("mood-badge") as HTMLDivElement;
const petTools = document.getElementById("pet-tools") as HTMLDivElement;
const speech = document.getElementById("pet-speech") as HTMLDivElement;
const sleepButton = document.getElementById("sleep-pet") as HTMLButtonElement;
const toyButton = document.getElementById("toy-pet") as HTMLButtonElement;
const toyCursor = document.getElementById("toy-cursor") as HTMLDivElement;
const TOOL_WIDTH = 254;
let toolsOpen = false;
let toolsCloseTimer: number | undefined;
let visualLift = 0;
function openTools(): void {
  if (dragging || placingFood) return;
  window.clearTimeout(toolsCloseTimer); toolsCloseTimer = undefined;
  toolsOpen = true; pet.classList.add("tools-open");
}
function closeTools(): void {
  window.clearTimeout(toolsCloseTimer); toolsCloseTimer = undefined;
  toolsOpen = false; pet.classList.remove("tools-open");
  if (petTools.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
}
function delayCloseTools(): void {
  if (toolsCloseTimer !== undefined) return;
  toolsCloseTimer = window.setTimeout(closeTools, 900);
}
function inToolsArea(clientX: number, clientY: number): boolean {
  if (!toolsOpen || dragging) return false;
  const boxes = [pet.getBoundingClientRect(), petTools.getBoundingClientRect()];
  if (!reminderCard.hidden) boxes.push(reminderCard.getBoundingClientRect());
  // Include the path between the pet and the toolbar, not just their painted pixels.
  return clientX >= Math.min(...boxes.map(r => r.left)) - 10 && clientX <= Math.max(...boxes.map(r => r.right)) + 10
    && clientY >= Math.min(...boxes.map(r => r.top)) - 10 && clientY <= Math.max(...boxes.map(r => r.bottom)) + 10;
}
let movingSeconds = 0;
let restPhase: "none" | "approach" | "sleep" = "none";
let restTarget = 0;
let restRemaining = 0;
let specialProduced = false;
let effectTime = 0;
let hungerLevel = 80;
let energy = 1;
let happiness = 70;
let placingFood = false;
let playingToy = false;
let placingToy = false;
let toyX = 0, toyY = 0, toyPlayRemaining = 6;
let toyRewardAt = 0;
let stamina = 100;
const savedStamina = new Map<string, number>();
let pointerX = -1;
let pointerY = -1;
interface Food { petId: string; x: number; y: number; element: HTMLDivElement; served: boolean; remaining: number }
const foods: Food[] = [];
function startFoodPlacement(): void {
  if (!manifest || dragging) return;
  stopToy();
  placingFood=true;closeTools();document.body.classList.add("placing-food");
  api.setIgnoreMouseEvents(false);speak(ui.t("placefood"), 8);
}
function cancelFoodPlacement(): void {
  placingFood=false;document.body.classList.remove("placing-food");api.setIgnoreMouseEvents(true);
}
function placeFood(clientX: number, clientY: number): void {
  if (!manifest) return;
  if (foods.length >= 5) { cancelFoodPlacement(); speak(ui.t("toomuchfood"), 2); return; }
  const food: Food={petId:manifest.id,x:Math.max(24,Math.min(window.innerWidth-24,clientX)),y:Math.max(32,Math.min(window.innerHeight-24,clientY)),element:document.createElement("div"),served:false,remaining:1.8};
  const foodKey=`${manifest.id}food`;
  food.element.className=`placed-food food-${manifest.id}`;food.element.dataset.food=foodKey;food.element.innerHTML=ui.icon(foodKey);food.element.setAttribute("aria-label",ui.t(foodKey));
  food.element.style.left=`${food.x-22}px`;food.element.style.top=`${food.y-18}px`;stage.appendChild(food.element);foods.push(food);
  pointerX=clientX;pointerY=clientY;
  cancelFoodPlacement();closeTools();restPhase="none";movingSeconds=0;if(!pendingWaste)overrideTime=0;speechTimer=0;hovering=false;
}
function energyForHunger(hunger: number): number {
  return hunger >= 60 ? 1 : hunger >= 25 ? .45 + (hunger - 25) / 35 * .55 : .18 + hunger / 25 * .27;
}
function movementSpeed(multiplier=1): number {
  return manifest ? manifest.speed*(petWidth/manifest.displaySize)*multiplier*energy : 0;
}
function syncToyButton(): void {
  toyButton.setAttribute("aria-pressed", String(playingToy));
  const label = ui.t(playingToy ? "stopToy" : "toy");
  toyButton.title = label; toyButton.setAttribute("aria-label", label);
}
function stopToy(): void {
  if (!playingToy) return;
  playingToy = false; placingToy = false; toyCursor.hidden = true; toyCursor.classList.remove("caught","placed");
  document.body.classList.remove("playing-toy"); syncToyButton();
  modeTimer = 0;
  api.setIgnoreMouseEvents(!(toolsOpen || hovering || held || placingFood));
}
function toggleToy(): void {
  if (playingToy) { stopToy(); return; }
  if (!manifest || held || dragging) return;
  if (placingFood) cancelFoodPlacement();
  playingToy = true; placingToy = true; toyPlayRemaining = 6; restPhase = "none"; movingSeconds = 0;
  toyRewardAt = performance.now()-8000;
  queuedActions.splice(0, queuedActions.length, ...queuedActions.filter(next => next !== "sleep"));
  if (!pendingWaste && !["eat", "vomit"].includes(action)) overrideTime = 0;
  if (pointerX < 0 || pointerY < 0) { pointerX = x + petWidth / 2; pointerY = y + petWidth * .8; }
  toyCursor.innerHTML = ui.icon("toy"); toyCursor.hidden = false;
  document.body.classList.add("playing-toy"); syncToyButton(); closeTools(); speak("");
  api.setIgnoreMouseEvents(false);
}
function placeToy(): void {
  if (!playingToy || !placingToy) return;
  toyX=Math.max(15,Math.min(window.innerWidth-15,pointerX));
  toyY=Math.max(15,Math.min(window.innerHeight-15,pointerY));
  placingToy=false;toyPlayRemaining=6;toyRewardAt=performance.now()-8000;
  toyCursor.classList.add("placed");closeTools();hovering=false;
  api.setIgnoreMouseEvents(true);
}
function syncVitals(): void {
  const values: [string, number][] = [["energy", Math.round(energy * 100)], ["hunger", Math.round(hungerLevel)], ["cleanliness", Math.max(0, 100 - document.querySelectorAll(".waste").length * 15)], ["happiness", Math.round(happiness)]];
  for (const [key, value] of values) {
    const meter = document.getElementById(`${key}-meter`) as HTMLMeterElement;
    meter.value = value; meter.setAttribute("aria-label", ui.t(key));
    meter.parentElement!.title = `${ui.t(key)} ${value}/100`;
    document.getElementById(`${key}-value`)!.textContent = String(value);
    meter.parentElement!.classList.toggle("low", value < 30);
  }
}
let hovering = false;
let manifest: PetManifest | null = null;
let selectedId = "";
let petName = "";
function displayName(id: string): string { return petName || ui.t(id); }
let loadVersion = 0;
let petWidth = 144;
let x = Math.max(0, (window.innerWidth - petWidth) / 2);
let y = Math.max(0, window.innerHeight - petWidth - 24);
let direction = 1;
let mode: Behavior = { action: "idle", duration: 2, weight: 1, speedScale: 0 };
let modeTimer = 2;
let lastTimestamp = 0;
let action: Action = "idle";
let actionTime = 0;
let gaitPhase = 0;
let bodyWidth = 1;
let growth = 0;
function resizePet(): void {
  if (!manifest) return;
  const next=manifest.displaySize*(.4+.6*growth/100),delta=next-petWidth;
  // Preserve the foot position as the pet grows between meals.
  x-=delta/2;y-=delta*.8;petWidth=next;
  pet.style.width=pet.style.height=`${petWidth}px`;clampPosition();
}
let overrideTime = 0;
let displayedFrame = "";
let speechTimer = 0;
let dragging = false;
let held: { pointer: number; startX: number; startY: number; offsetX: number; offsetY: number } | null = null;
let suppressClickUntil = 0;
let pendingWaste: "poop" | "vomit" | null = null;
const queuedActions: IncomingAction[] = [];
let rubDistance = 0, rubTurns = 0, lastRubX = 0, lastRubSign = 0, lastRubAt = 0, rubCooldown = 0;
const cache = new Map<string, Promise<PetManifest>>();

function clampPosition(): void {
  x = Math.max(0, Math.min(x, window.innerWidth - petWidth));
  y = Math.max(0, Math.min(y, window.innerHeight - petWidth));
}
function speak(text: string, duration = 2): void {
  {
    const symbols: Record<string,string> = { "乾乾淨淨！":"✨", "嗚哇～被抓起來了！":"!", "降落成功！":"", "啊嗚！":"", "好喜歡你！":"", "好舒服～":"", "嘿嘿，好癢！":"♫", "哼，再搓就生氣囉！":"!", "嗯……":"…", "吃太多了……呃！":"!", "Zzz…":"Zzz…" };
    text = symbols[text] ?? text;
  }
  if (!text) { speechTimer=0;speech.textContent="";speech.classList.remove("visible");return; }
  speech.textContent = text; speechTimer = duration; speech.classList.add("visible");
}
function setAction(next: Action): void {
  const resolved = manifest?.animations[next] ? next : "idle";
  if (action !== resolved) { action = resolved; actionTime = 0; effectTime = 0; specialProduced = false; }
}
function loadPet(id: string): Promise<PetManifest> {
  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`../assets/pets/${id}/manifest.json`);
      if (!response.ok) throw new Error(`Missing pet manifest: ${id}`);
      const data: PetManifest = await response.json();
      if (!data.animations.idle?.frames.length) throw new Error(`Missing idle frames: ${id}`);
      await Promise.all(Object.values(data.animations).flatMap(a => a!.frames).map(file => {
        const image = new Image(); image.src = `../assets/pets/${id}/${file}`; return image.decode();
      }));
      return data;
    })();
    cache.set(id, pending); pending.catch(() => cache.delete(id));
  }
  return pending;
}
function chooseBehavior(): void {
  if (manifest?.rest && movingSeconds >= manifest.rest.afterMovingSeconds) {
    restPhase = "approach";restTarget = x < (window.innerWidth-petWidth)/2 ? manifest.rest.edgeInset : window.innerWidth-petWidth-manifest.rest.edgeInset;
    return;
  }
  const available = manifest?.behaviors ?? [
    { action: "idle" as Action, duration: 3, weight: 2, speedScale: 0 },
    { action: "walk" as Action, duration: 5, weight: 4, speedScale: 1 },
  ];
  // Elimination is scheduled by the main process, never by the random idle loop.
  const choices = available.filter(item => !["pee", "poop"].includes(item.action)
    && (hungerLevel >= 25 || !["run", "pounce", "hop", "dig", "roll"].includes(item.action))).map(item => ({ ...item,
    weight: (item.speedScale ? item.weight * energy : item.weight * (2 - energy)) * (hungerLevel<45 && item.action==="sniff" ? 4 : 1),
    duration: item.speedScale ? item.duration * Math.max(.5, energy) : item.duration * (1 + (1 - energy) * 1.5),
  }));
  let roll = Math.random() * choices.reduce((sum, item) => sum + item.weight, 0);
  mode = choices.find(item => (roll -= item.weight) < 0) ?? choices[0];
  modeTimer = mode.duration;
  if (mode.speedScale && Math.random() < .3) direction *= -1;
}
function tick(timestamp: number): void {
  const dt = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, .1) : 0;
  lastTimestamp = timestamp;
  speechTimer = Math.max(0, speechTimer - dt);
  if (!speechTimer) speech.classList.remove("visible");
  if (manifest) {
    const previousX=x, previousY=y;
    for (let i=foods.length-1;i>=0;i--) {
      if (foods[i].served) { foods[i].remaining-=dt;if(foods[i].remaining<=0) {foods[i].element.remove();foods.splice(i,1);} }
    }
    const foodTarget=foods.find(food=>food.petId===manifest!.id&&!food.served);
    if (playingToy) {
      toyCursor.style.left = `${placingToy?Math.max(15, Math.min(window.innerWidth-15, pointerX)):toyX}px`;
      toyCursor.style.top = `${placingToy?Math.max(15, Math.min(window.innerHeight-15, pointerY)):toyY}px`;
    }
    if (!dragging && !held) {
      const wasOverridden = overrideTime > 0;
      overrideTime = Math.max(0, overrideTime - dt);
      if (wasOverridden && !overrideTime && pendingWaste) {
        makeWaste(pendingWaste); pendingWaste = null;
      }
      if (!overrideTime && !foodTarget && !playingToy && queuedActions.length) receiveAction(queuedActions.shift()!);
      const reminding = currentReminder && !foodTarget && !placingFood && !playingToy;
      // Food pursuit takes priority over hover, focused controls and placing another meal.
      const editing = !foodTarget && !playingToy && (reminding || placingFood || petTools.contains(document.activeElement)
        || toolsOpen || hovering);
      if (foodTarget && !overrideTime && !editing) {
        const goalX=Math.max(0,Math.min(window.innerWidth-petWidth,foodTarget.x-petWidth/2));
        const goalY=Math.max(0,Math.min(window.innerHeight-petWidth,foodTarget.y-petWidth*.80));
        const dx=goalX-x,dy=goalY-y,distance=Math.hypot(dx,dy);
        const run=manifest.behaviors?.find(b=>b.action==="run");
        const speed=movementSpeed(run?.speedScale??1);
        if (distance<=Math.max(3,speed*dt)) {
          x=goalX;y=goalY;foodTarget.served=true;api.interact("feed");
        } else {
          if(Math.abs(dx)>1)direction=dx>0?1:-1;
          x+=dx/distance*speed*dt;y+=dy/distance*speed*dt;setAction(run?"run":"walk");
        }
      }
      if (playingToy && placingToy && !foodTarget && !overrideTime) setAction("idle");
      if (playingToy && !placingToy && !foodTarget && !overrideTime) {
        const goalX = Math.max(0, Math.min(window.innerWidth-petWidth, toyX-petWidth/2));
        const goalY = Math.max(0, Math.min(window.innerHeight-petWidth, toyY-petWidth*.8));
        const dx = goalX-x, dy = goalY-y, distance = Math.hypot(dx,dy);
        const run = manifest.behaviors?.find(b => b.action === "run");
        const speed = movementSpeed((run?.speedScale ?? 1) * 1.6);
        const caught = distance < 7;
        toyCursor.classList.toggle("caught", caught);
        if (caught) {
          const reactions: Record<string, Action> = {dog:"wiggle",cat:"pounce",rabbit:"hop",pig:"wiggle",fish:"twirl"};
          setAction(reactions[manifest.id] ?? "react");
          if (timestamp-toyRewardAt > 8000) { toyRewardAt=timestamp;api.interact("pet"); }
          toyPlayRemaining-=dt;
          if (toyPlayRemaining<=0) stopToy();
        } else {
          if (Math.abs(dx)>1) direction = dx>0?1:-1;
          const step = Math.min(distance,speed*dt);x+=dx/distance*step;y+=dy/distance*step;
          setAction(run && energy>.45 ? "run" : "walk");
        }
      }
      if (!overrideTime && editing) setAction(reminding ? currentReminder === "stretch" ? "stretch" : "react" : "idle");
      if (!overrideTime && !editing && !foodTarget && !playingToy && restPhase !== "none") {
        if (restPhase === "approach") {
          direction = restTarget > x ? 1 : -1;
          const step = movementSpeed() * dt;
          if (Math.abs(restTarget-x) <= step+1) {
            x=restTarget;restPhase="sleep";restRemaining=manifest.rest?.sleepSeconds ?? 25;setAction("sleep");speak("Zzz…",3);
          } else { x += direction*step;setAction("walk"); }
        } else {
          setAction("sleep");restRemaining-=dt;
          if (restRemaining<=0) { restPhase="none";movingSeconds=0;modeTimer=0; }
        }
      }
      if (!overrideTime && !editing && !foodTarget && !playingToy && restPhase === "none") {
        modeTimer -= dt;
        if (modeTimer <= 0) chooseBehavior();
        if (restPhase === "none") setAction(mode.action);
        if (mode.speedScale && restPhase === "none") {
          movingSeconds += dt / Math.max(.4, energy);
          x += direction * movementSpeed(mode.speedScale) * dt; clampPosition();
          if (x <= 0) direction = 1;
          else if (x >= window.innerWidth - petWidth) direction = -1;
        }
      }
    }
    if (dragging) setAction("drag");
    const exerting = !held && !dragging && ["walk","run","hop","pounce","wiggle","twirl","dig"].includes(action);
    stamina = Math.max(0, Math.min(100, stamina + dt * (action === "sleep" ? 2.5 : exerting ? (playingToy ? -.8 : -.4) : .12)));
    energy = energyForHunger(hungerLevel) * (.4 + .6 * stamina / 100);
    const animatedEnergy = ["drag", "eat", "react", "rub", "wiggle", "grumpy", "poop", "vomit", "pee"].includes(action) ? 1 : energy;
    const previousActionTime=actionTime;
    if (!(held && action==="dig")) actionTime += dt * animatedEnergy * (playingToy && ["walk","run"].includes(action) ? 1.6 : 1);
    if (action === "pee" && actionTime >= 1.2 && !specialProduced) { makeWaste("pee");specialProduced=true; }
    effectTime += dt;
    if (action === "dig" && !held && !dragging) {
      const dig=manifest.animations.dig!;
      const cycle=dig.frames.length/dig.fps;
      // Front paws scrape alternately at 1/4 and 3/4 of the loop.
      const stroke=Math.floor(actionTime/cycle*2-.5);
      if (stroke>Math.floor(previousActionTime/cycle*2-.5)) digDust(stroke%2===0?0:1);
    }
    if (action === "bubbles" && effectTime > .38) { effectTime=0;particle("bubble"); }
    const animation = manifest.animations[action] ?? manifest.animations.idle!;
    // Contact feet move backward by exactly the distance the character travels.
    // Hunger, stamina and toy acceleration cannot make the feet moonwalk.
    if (animation.stride && !dragging && !held) {
      const stride=animation.stride*(petWidth/256)*bodyWidth;
      gaitPhase=(gaitPhase+Math.hypot(x-previousX,y-previousY)/stride)%1;
    }
    const raw = animation.stride ? Math.floor(gaitPhase*animation.frames.length) : Math.floor(actionTime * animation.fps);
    const index = animation.loop ? raw % animation.frames.length : Math.min(raw, animation.frames.length - 1);
    const src = `../assets/pets/${manifest.id}/${animation.frames[index]}`;
    if (src !== displayedFrame) { sprite.src = src; displayedFrame = src; }
    const lift = dragging || held || action === "sleep" ? 0 : manifest.motion === "float" ? 6 + Math.sin(timestamp / 500) * 4 : manifest.motion === "hop" && action === "walk" ? Math.abs(Math.sin(timestamp / 110)) * 8 : 0;
    if (!toolsOpen || dragging || held) visualLift = lift;
    pet.style.transform = `translate(${x}px, ${Math.max(0, y - visualLift)}px)`;
    petTools.style.left = `${Math.max(-x, Math.min((petWidth - TOOL_WIDTH) / 2, window.innerWidth - x - TOOL_WIDTH))}px`;
    pet.classList.toggle("tools-below", y < 140);
    positionPetOverlays();
    pet.classList.toggle("facing-left", direction === -1);
  }
  syncSleepButton();
  syncVitals();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function cleanWaste(): void {
  const version = loadVersion;
  const items = Array.from(document.querySelectorAll<HTMLButtonElement>(".waste"));
  void Promise.all(items.map(sweepWaste)).then(results => {
    if (version === loadVersion && results.some(Boolean)) api.interact("clean");
  });
}
interface SweepJob { waste: HTMLButtonElement; resolve(removed: boolean): void }
const sweepQueue: SweepJob[] = [];
let activeSweep: SweepJob | null = null;
let sweepTimer: number | undefined;
function sweepWaste(waste: HTMLButtonElement): Promise<boolean> {
  if (!waste.isConnected || waste.disabled) return Promise.resolve(false);
  waste.disabled = true;
  return new Promise(resolve => { sweepQueue.push({ waste, resolve }); runNextSweep(); });
}
function runNextSweep(): void {
  if (activeSweep) return;
  const job = sweepQueue.shift();
  if (!job) return;
  if (!job.waste.isConnected) { job.resolve(false);runNextSweep();return; }
  activeSweep = job;
  const waste = job.waste;
  waste.classList.add("cleaning");
  const broom = document.createElement("span");
  broom.className = "sweep-broom"; broom.innerHTML = ui.icon("clean"); waste.appendChild(broom);
  // Keep the mess at its deposited position throughout the sweep.
  sweepTimer = window.setTimeout(() => {
    const stillPresent = waste.isConnected;
    waste.remove(); job.resolve(stillPresent);
    activeSweep = null; sweepTimer = undefined; runNextSweep();
  }, 850);
}
function cancelSweeps(): void {
  window.clearTimeout(sweepTimer); sweepTimer = undefined;
  activeSweep?.resolve(false); activeSweep = null;
  sweepQueue.splice(0).forEach(job => job.resolve(false));
}
function particle(kind: "dust" | "bubble"): void {
  const dot=document.createElement("i");dot.className=`pet-particle ${kind}`;
  dot.style.left=`${x+petWidth*(direction===1?.72:.28)}px`;dot.style.top=`${y+petWidth*(kind==="dust"?.84:.5)}px`;
  dot.style.setProperty("--drift",`${(kind==="dust"?-direction:1)*(15+Math.random()*20)}px`);
  dot.addEventListener("animationend",()=>dot.remove());stage.appendChild(dot);
}
function digDust(pawIndex:0|1): void {
  const scale=petWidth/256;
  for (const paw of [[{x:146,y:214},{x:198,y:214}][pawIndex]]) {
    const localX=(paw.x-128)*bodyWidth+128;
    const originX=x+(direction===1?localX:256-localX)*scale;
    const originY=y-visualLift+paw.y*scale;
    for (let i=0;i<3;i++) {
      const dot=document.createElement("i");dot.className="pet-particle dig-dust";
      dot.dataset.paw=String(pawIndex);
      dot.style.left=`${originX}px`;dot.style.top=`${originY}px`;
      const size=Math.max(1.5,(4+i)*scale);
      dot.style.width=dot.style.height=`${size}px`;
      dot.style.setProperty("--drift",`${-direction*(28+i*18)*scale}px`);
      dot.style.setProperty("--rise",`${-(12+i*8)*scale}px`);
      dot.addEventListener("animationend",()=>dot.remove());stage.appendChild(dot);
    }
  }
}
function makeWaste(kind: "poop" | "vomit" | "pee"): void {
  const items = document.querySelectorAll(".waste");
  if (items.length >= 20) items[0].remove();
  const waste = document.createElement("button");
  waste.className = `waste ${kind}`; waste.type = "button";
  waste.setAttribute("aria-label", ui.t("clean"));
  waste.title = waste.getAttribute("aria-label")!;
  waste.innerHTML = kind === "poop" ? '<i></i><i></i><i></i>' : kind === "pee" ? '<i></i>' : '<i></i><i></i><i></i><i></i>';
  // Use the visible sprite at emission time, including its transparent padding,
  // facing direction and floating/dragged screen position.
  const rect = sprite.getBoundingClientRect();
  let bounds = { left: .2, right: .8, bottom: .82 };
  if (sprite.complete && sprite.naturalWidth) {
    const canvas = document.createElement("canvas");
    canvas.width = sprite.naturalWidth; canvas.height = sprite.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(sprite, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, right = 0, bottom = 0;
    for (let row = 0; row < canvas.height; row++) {
      for (let col = 0; col < canvas.width; col++) {
        if (pixels[(row * canvas.width + col) * 4 + 3] < 64) continue;
        left = Math.min(left, col); right = Math.max(right, col + 1); bottom = row + 1;
      }
    }
    if (bottom) bounds = { left: left / canvas.width, right: right / canvas.width, bottom: bottom / canvas.height };
  }
  const alongBody = kind === "vomit" ? .82 : .32;
  let anchor = bounds.left + (bounds.right - bounds.left) * alongBody;
  if (pet.classList.contains("facing-left")) anchor = 1 - anchor;
  waste.style.left = `${Math.max(0, Math.min(window.innerWidth - 46, rect.left + rect.width * anchor - 23))}px`;
  waste.style.top = `${Math.max(0, Math.min(window.innerHeight - 28, rect.top + rect.height * bounds.bottom - 28))}px`;
  waste.addEventListener("click", () => {
    const version = loadVersion;
    void sweepWaste(waste).then(removed => { if (removed && version === loadVersion) api.interact("clean"); });
  });
  stage.appendChild(waste);
}
function spawnHeart(): void {
  const heart = document.createElement("div"); heart.className = "heart"; heart.textContent = "♥";
  heart.style.left = `${x + petWidth / 2}px`; heart.style.top = `${Math.max(30, y)}px`;
  heart.style.setProperty("--drift", `${(Math.random() - .5) * 30}px`);
  stage.appendChild(heart); heart.addEventListener("animationend", () => heart.remove());
}
function receiveAction(next: IncomingAction): void {
  if (next === "place-food") { startFoodPlacement();return; }
  if (next === "clean") { cleanWaste(); return; }
  if (next === "sleep") stopToy();
  if (playingToy && ["react","rub","wiggle"].includes(next)) { spawnHeart(); return; }
  if (manifest && foods.some(food => food.petId === manifest!.id && !food.served)
      && !["eat", "poop", "vomit"].includes(next)) {
    if (["react", "rub", "wiggle"].includes(next)) spawnHeart();
    else if (!queuedActions.includes(next) && queuedActions.length < 8) queuedActions.push(next);
    return;
  }
  if (!manifest || held || dragging || pendingWaste) {
    if (queuedActions.length < 8) queuedActions.push(next);
    return;
  }
  if (!["poop", "pee", "vomit"].includes(next)) { restPhase="none";movingSeconds=0; }
  setAction(next); actionTime = 0;
  overrideTime = next === "sleep" ? 20 : next === "poop" || next === "pee" ? 2.4 : next === "vomit" ? 1.8 : next === "eat" ? 1.4 : 1.2;
  if (next === "poop" || next === "vomit") pendingWaste = next;
  const phrases: Partial<Record<IncomingAction, string>> = {
    eat: "啊嗚！", react: "好喜歡你！", sleep: "Zzz…", rub: "好舒服～",
    wiggle: "嘿嘿，好癢！", grumpy: "哼，再搓就生氣囉！", poop: "嗯……", vomit: "吃太多了……呃！",
  };
  speak(phrases[next] ?? "", overrideTime);
  if (["react", "rub", "wiggle"].includes(next)) spawnHeart();
}
api.onAction(receiveAction);

function wake(): void {
  overrideTime = 0; restPhase = "none"; movingSeconds = 0; modeTimer = 0;
  setAction("idle"); actionTime = 0; speak("");
}
function toggleSleep(): void {
  stopToy();
  if (action === "sleep") wake(); else receiveAction("sleep");
}
function syncSleepButton(): void {
  const sleeping = action === "sleep";
  if (sleepButton.dataset.sleeping === String(sleeping)) return;
  sleepButton.dataset.sleeping = String(sleeping);
  sleepButton.innerHTML = ui.icon(sleeping ? "wake" : "sleep");
  const label = ui.t(sleeping ? "wake" : "sleep");
  sleepButton.title = label; sleepButton.setAttribute("aria-label", label);
}

pet.addEventListener("mouseenter", event => {
  if(!document.elementFromPoint(event.clientX,event.clientY)?.closest("#reminder-card")) { hovering=true;openTools(); }
  api.setIgnoreMouseEvents(false);
});
petTools.addEventListener("focusin", openTools);
pet.addEventListener("mouseleave", () => {
  hovering = false; rubDistance = 0; rubTurns = 0; lastRubSign = 0;
  if (!held) delayCloseTools();
});
pet.addEventListener("pointerdown", event => {
  if (event.button !== 0 || (event.target as Element).closest("#pet-tools, #reminder-card") || !manifest) return;
  event.preventDefault();
  held = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - x, offsetY: event.clientY - y };
  pet.setPointerCapture(event.pointerId); api.setIgnoreMouseEvents(false);
});
document.addEventListener("pointermove", event => {
  pointerX=event.clientX;pointerY=event.clientY;
  if (held) {
    if (!dragging && Math.hypot(event.clientX - held.startX, event.clientY - held.startY) >= 6) {
      dragging = true; pet.classList.add("dragging");
      stopToy();
      closeTools();
      restPhase="none";movingSeconds=0;
      if (pendingWaste) { queuedActions.unshift(pendingWaste); pendingWaste = null; }
      overrideTime = 0; setAction("drag"); speak("嗚哇～被抓起來了！");
    }
    if (dragging) { x = event.clientX - held.offsetX; y = event.clientY - held.offsetY; clampPosition(); }
    return;
  }
  if (!(event.target as Element).closest("#pet") || event.buttons || (event.target as Element).closest("#pet-tools, #reminder-card") || performance.now() < rubCooldown) return;
  const now = performance.now();
  if (now - lastRubAt > 600) { rubDistance = 0; rubTurns = 0; lastRubSign = 0; }
  const dx = event.clientX - lastRubX;
  if (Math.abs(dx) > 2 && now - lastRubAt < 600) {
    const sign = Math.sign(dx);
    if (lastRubSign && sign !== lastRubSign) rubTurns++;
    lastRubSign = sign; rubDistance += Math.abs(dx);
  }
  lastRubX = event.clientX; lastRubAt = now;
  if (rubDistance > 110 && rubTurns >= 3) {
    api.interact("rub"); rubCooldown = now + 1600; rubDistance = 0; rubTurns = 0;
  }
});
function finishDrag(): void {
  if (!held) return;
  const pointer = held.pointer; held = null;
  if (pet.hasPointerCapture(pointer)) pet.releasePointerCapture(pointer);
  if (dragging) {
    dragging = false; pet.classList.remove("dragging"); suppressClickUntil = performance.now() + 300;
    setAction("react"); actionTime = 0; overrideTime = .65; modeTimer = 2; speak("降落成功！", 1.2);
  }
}
document.addEventListener("pointerup", finishDrag);
document.addEventListener("pointercancel", finishDrag);
pet.addEventListener("lostpointercapture", finishDrag);
window.addEventListener("blur", () => { finishDrag(); if(placingToy)stopToy(); });
pet.addEventListener("click", () => { if (performance.now() >= suppressClickUntil) api.interact("pet"); });
pet.addEventListener("contextmenu", event => { event.preventDefault(); api.showContextMenu(); });
petTools.addEventListener("click", event => event.stopPropagation());
petTools.addEventListener("contextmenu", event => { event.preventDefault(); event.stopPropagation(); });
document.getElementById("feed-pet")!.addEventListener("click", startFoodPlacement);
toyButton.addEventListener("click", toggleToy);
document.addEventListener("pointerdown",event=>{
  if(placingToy && event.button===0 && !(event.target as Element).closest("#pet-tools")) {
    event.preventDefault();event.stopImmediatePropagation();
    suppressClickUntil=performance.now()+500;
  }
},true);
toyCursor.addEventListener("pointerdown", event => {
  if (!playingToy || event.button!==0) return;
  event.preventDefault();event.stopPropagation();
  placingToy=true;toyCursor.classList.remove("placed","caught");
  toyCursor.setPointerCapture(event.pointerId);api.setIgnoreMouseEvents(false);
});
document.addEventListener("pointerup",event=>{
  if(event.button===0 && placingToy && !(event.target as Element).closest("#pet-tools")) {
    pointerX=event.clientX;pointerY=event.clientY;placeToy();
    if(toyCursor.hasPointerCapture(event.pointerId))toyCursor.releasePointerCapture(event.pointerId);
  }
});
document.getElementById("clean-pet")!.addEventListener("click", cleanWaste);
sleepButton.addEventListener("click", toggleSleep);
document.getElementById("settings-pet")!.addEventListener("click", () => { stopToy(); api.openPicker(); });
document.addEventListener("pointerdown", event => { if (!(event.target as Element).closest("#pet")) closeTools(); });
document.addEventListener("mousemove", event => {
  pointerX=event.clientX;pointerY=event.clientY;
  if (placingFood || placingToy) { api.setIgnoreMouseEvents(false);return; }
  if (held || dragging) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if(target?.closest("#reminder-card")) {
    // Approaching a reminder must not open the toolbar and move its buttons.
    window.clearTimeout(toolsCloseTimer);toolsCloseTimer=undefined;
    api.setIgnoreMouseEvents(false);return;
  }
  const safeArea = inToolsArea(event.clientX, event.clientY);
  if (safeArea || target?.closest("#pet")) openTools(); else if (toolsOpen) delayCloseTools();
  api.setIgnoreMouseEvents(!(safeArea || target?.closest("#pet, .waste, #reminder-card, #toy-cursor")));
});
document.addEventListener("mouseleave", () => { if(placingToy)stopToy();if (!held && !placingFood) { delayCloseTools();api.setIgnoreMouseEvents(true); } });
document.addEventListener("pointerdown", event => {
  if (!placingFood || event.button!==0 || (event.target as Element).closest("#pet-tools")) return;
  event.preventDefault();event.stopImmediatePropagation();placeFood(event.clientX,event.clientY);suppressClickUntil=performance.now()+300;
},true);
document.addEventListener("keydown",event=>{if(event.key==="Escape"){stopToy();if(placingFood){cancelFoodPlacement();speechTimer=0;}}});
window.addEventListener("resize", clampPosition);
api.onResetPosition(() => { if (!held) { x = (window.innerWidth - petWidth) / 2; y = window.innerHeight - petWidth - 24; clampPosition(); } });
async function renderState(state: PetState): Promise<void> {
  happiness = state.mood;
  bodyWidth = .84 + Math.max(0, Math.min(100, state.weight ?? 50)) * .0032;
  pet.style.setProperty("--body-width", String(bodyWidth));
  growth=Math.max(0,Math.min(100,state.growth??0));
  hungerLevel = state.hunger; energy = energyForHunger(hungerLevel);
  pet.classList.toggle("low-energy", hungerLevel < 25);
  pet.classList.toggle("hungry", hungerLevel < 45);
  if (hungerLevel < 25 && ["run", "pounce", "hop", "dig", "roll"].includes(mode.action)) modeTimer = 0;
  moodBadge.classList.toggle("low", state.mood < 30 || state.hunger < 45);
  moodBadge.innerHTML = state.hunger < 45 ? ui.icon(`${state.petId}food`) : state.mood < 30 ? ui.icon("pet") : "";
  const need = ui.t(state.hunger < 45 ? "hungry" : "affection");
  moodBadge.title = need; moodBadge.setAttribute("aria-label", need);
  const nameChanged = petName !== (state.name || "");
  petName = state.name || "";
  if (selectedId === state.petId) {
    resizePet();
    if (nameChanged && manifest) { sprite.alt = displayName(manifest.id); pet.title = `${displayName(manifest.id)} · ${ui.t("hint")}`; }
    return;
  }
  savedStamina.set(selectedId, stamina); stamina = savedStamina.get(state.petId) ?? 100;
  stopToy();
  selectedId = state.petId; const version = ++loadVersion;
  cancelSweeps();
  // Clear the previous pet immediately, before asynchronous asset loading.
  // An interrupted elimination must not leave new waste after the switch.
  pendingWaste = null; queuedActions.length = 0;
  finishDrag(); overrideTime = 0; manifest = null;
  foods.splice(0).forEach(food => food.element.remove());
  document.querySelectorAll(".waste, .heart, .pet-particle").forEach(item => item.remove());
  if (placingFood) cancelFoodPlacement();
  speak("");
  try {
    const next = await loadPet(state.petId);
    if (version !== loadVersion) return;
    finishDrag(); manifest = next;resizePet();
    if(placingFood)cancelFoodPlacement();
    pet.style.width = pet.style.height = `${petWidth}px`;
    sprite.alt = displayName(next.id); pet.title = `${displayName(next.id)} · ${ui.t("hint")}`;
    mode = { action: "idle", duration: 2, weight: 1, speedScale: 0 }; modeTimer = 2;
    overrideTime = 0; actionTime = 0; gaitPhase=0; setAction("idle"); displayedFrame = ""; clampPosition();
    queuedActions.length = 0;
    restPhase="none";movingSeconds=0;
  } catch (error) {
    if (version === loadVersion) { selectedId = ""; pet.title = "素材載入失敗，請重新切換寵物"; }
    console.error("Pet asset load failed", error);
  }
}
api.getState().then(renderState).catch(console.error);
api.onStateUpdate(state => { void renderState(state); });
window.addEventListener("pet-language-changed",()=>{
  syncToyButton(); syncVitals();
  delete sleepButton.dataset.sleeping;
  if(manifest){sprite.alt=displayName(manifest.id);pet.title=`${displayName(manifest.id)} · ${ui.t("hint")}`;}
  for(const food of foods)food.element.setAttribute("aria-label",ui.t(`${food.petId}food`));
  moodBadge.title=ui.t(hungerLevel<45?"hungry":"affection");
  if(currentReminder)document.getElementById("reminder-text")!.textContent=ui.prompt(currentReminder, currentPromptIndex).text;
});
const reminderCard=document.getElementById("reminder-card")!;
let currentReminder: "water" | "stretch" | null = null;
let currentPromptIndex = 0;
const reminderQueue: ("water" | "stretch")[]=[];
function positionPetOverlays(): void {
  const margin=12,gap=12,p=pet.getBoundingClientRect();
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
  if(moodBadge.classList.contains("low")) {
    // Leave room for the hungry badge's pulse, including at the screen edges.
    const width=moodBadge.offsetWidth,height=moodBadge.offsetHeight;
    moodBadge.style.right="auto";
    moodBadge.style.left=`${clamp(p.right-width+6,margin,innerWidth-margin-width)-p.left}px`;
    moodBadge.style.top=`${clamp(p.top-14,margin+4,innerHeight-margin-height)-p.top}px`;
  }
  if(!currentReminder || reminderCard.hidden)return;
  const width=reminderCard.offsetWidth,height=reminderCard.offsetHeight;
  const tool=toolsOpen?petTools.getBoundingClientRect():null;
  const centerX=p.left+p.width/2,centerY=p.top+p.height/2;
  const groupTop=tool?Math.min(p.top,tool.top):p.top,groupBottom=tool?Math.max(p.bottom,tool.bottom):p.bottom;
  const candidates=[
    {left:p.right+gap,top:centerY-height/2},
    {left:p.left-gap-width,top:centerY-height/2},
    {left:centerX-width/2,top:groupTop-gap-height},
    {left:centerX-width/2,top:groupBottom+gap},
  ];
  if(tool)candidates.push(
    {left:Math.max(p.right,tool.right)+gap,top:centerY-height/2},
    {left:Math.min(p.left,tool.left)-gap-width,top:centerY-height/2},
  );
  const overlap=(left:number,top:number,rect:DOMRect)=>
    Math.max(0,Math.min(left+width,rect.right+6)-Math.max(left,rect.left-6))
    *Math.max(0,Math.min(top+height,rect.bottom+6)-Math.max(top,rect.top-6));
  // Measure the actual translated text and pick a position that keeps both
  // buttons visible and avoids covering the pet or its open toolbar.
  const choices=candidates.map((candidate,index)=>{
    const left=clamp(candidate.left,margin,innerWidth-margin-width);
    const top=clamp(candidate.top,margin,innerHeight-margin-height);
    const distance=Math.hypot(centerX-clamp(centerX,left,left+width),centerY-clamp(centerY,top,top+height));
    return {left,top,score:(overlap(left,top,p)+(tool?overlap(left,top,tool):0))*1000+distance+index*.01};
  });
  choices.sort((a,b)=>a.score-b.score);
  const {left,top}=choices[0];
  reminderCard.style.left=`${left-p.left}px`;reminderCard.style.top=`${top-p.top}px`;
  let side:string;
  if(left+width<=p.left)side="right";
  else if(left>=p.right)side="left";
  else side=top+height<=centerY?"bottom":"top";
  reminderCard.dataset.tail=side;
  const tail=side==="left"||side==="right"
    ?clamp(centerY-top-7,18,height-32):clamp(centerX-left-7,18,width-32);
  reminderCard.style.setProperty("--tail-offset",`${tail}px`);
}
function showReminder(kind: "water" | "stretch"): void {
  if (currentReminder) { if (currentReminder !== kind && !reminderQueue.includes(kind)) reminderQueue.push(kind);return; }
  currentReminder=kind;document.getElementById("reminder-symbol")!.innerHTML=ui.icon(kind);
  const picked = ui.prompt(kind); currentPromptIndex = picked.index;
  document.getElementById("reminder-text")!.textContent=picked.text;reminderCard.hidden=false;
  pet.classList.add("reminding");
  positionPetOverlays();
  if (action === "sleep" && !held && !pendingWaste) { overrideTime=0;restPhase="none"; }
}
function dismissReminder(snooze: boolean): void {
  if (!currentReminder) return;
  api.acknowledgeReminder(currentReminder,snooze);currentReminder=null;reminderCard.hidden=true;
  pet.classList.remove("reminding");
  const next=reminderQueue.shift();if(next)showReminder(next);
}
api.onReminder(showReminder);
reminderCard.addEventListener("click", event => event.stopPropagation());
reminderCard.addEventListener("pointerdown", event => event.stopPropagation());
document.getElementById("reminder-done")!.addEventListener("click",()=>dismissReminder(false));
document.getElementById("reminder-later")!.addEventListener("click",()=>dismissReminder(true));
