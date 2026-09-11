const pickerAPI = window.petAPI;
const cards = document.getElementById('pets');
const nameInput = document.getElementById('pet-name');
function markSelected(state) {
  for (const card of cards.children) {
    const selected = card.dataset.id === state.petId;
    card.setAttribute('aria-pressed', String(selected));
    if (selected) document.getElementById('status').textContent = `♥ ${state.name || card.textContent}`;
  }
  if (document.activeElement !== nameInput) nameInput.value = state.name || '';
}
nameInput.addEventListener('change', () => pickerAPI.renamePet(nameInput.value));
pickerAPI.getCatalog().then(async catalog => {
  for (const pet of catalog) {
    const card = document.createElement('button'); card.className = 'card'; card.dataset.id = pet.id;
    const image = document.createElement('img'); image.src = `../assets/pets/${pet.id}/idle-00.png`; image.alt = window.PetUI.t(pet.id);
    const label = document.createElement('span');label.dataset.label=pet.id;label.textContent = window.PetUI.t(pet.id);
    card.append(image, label); card.addEventListener('click', () => pickerAPI.selectPet(pet.id)); cards.append(card);
  }
  markSelected(await pickerAPI.getState());
}).catch(error => { document.getElementById('status').textContent = window.PetUI.t('loaderror'); console.error(error); });
pickerAPI.onStateUpdate(markSelected);
window.addEventListener('pet-language-changed',()=>{
  for(const card of cards.children)card.querySelector('img').alt=window.PetUI.t(card.dataset.id);
  pickerAPI.getState().then(markSelected).catch(console.error);
});
document.getElementById('language-choice').addEventListener('change',event=>{
  pickerAPI.setLanguage(event.target.value).catch(console.error);
});
document.getElementById('reveal').addEventListener('click', () => pickerAPI.revealPet());
const petVisible=document.getElementById('pet-visible');
pickerAPI.getPetVisible().then(visible=>{petVisible.checked=visible;}).catch(console.error);
petVisible.addEventListener('change',()=>pickerAPI.setPetVisible(petVisible.checked));
pickerAPI.onPetVisibleChange(visible=>{petVisible.checked=visible;});
const enabled=document.getElementById('reminders-enabled');
const stretch=document.getElementById('stretch-minutes');
const water=document.getElementById('water-minutes');
function showSettings(settings) {
  enabled.checked=settings.enabled;
  for(const [select,value] of [[stretch,settings.stretchMinutes],[water,settings.waterMinutes]]) {
    if(![...select.options].some(o=>o.value===String(value)))select.add(new Option(String(value),String(value)));
    select.value=String(value);select.disabled=!settings.enabled;
  }
}
pickerAPI.getReminders().then(showSettings).catch(console.error);
for(const control of [enabled,stretch,water])control.addEventListener('change',()=>{
  pickerAPI.setReminders({enabled:enabled.checked,stretchMinutes:Number(stretch.value),waterMinutes:Number(water.value)}).then(showSettings).catch(console.error);
});
