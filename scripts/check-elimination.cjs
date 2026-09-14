const assert = require('node:assert/strict');
const { PetStateManager } = require('../dist/main/petState.js');
const minute = 60_000;

function checkElimination() {
  for (const id of ['dog', 'cat', 'rabbit', 'pig', 'fish']) {
    const pet = new PetStateManager();
    pet.select(id);
    assert.equal(pet.feedReaction(0), 'eat');
    // Additional meals neither queue extra waste nor indefinitely postpone it.
    assert.equal(pet.feedReaction(minute), 'eat');
    assert.equal(pet.feedReaction(2 * minute), 'eat');
    assert.equal(pet.nextAutonomousAction(45_000), null, `${id}: no old 45-second poop`);
    assert.equal(pet.nextAutonomousAction(20 * minute - 1), null);
    assert.equal(pet.nextAutonomousAction(20 * minute), 'poop');
    assert.equal(pet.nextAutonomousAction(20 * minute + 1), null);
    pet.clean();
    pet.select(id === 'dog' ? 'cat' : 'dog');
    pet.select(id);
    assert.equal(pet.nextAutonomousAction(40 * minute - 1), null, `${id}: cleaning/switching preserves cooldown`);
    assert.equal(pet.nextAutonomousAction(40 * minute), id === 'dog' ? 'pee' : null);
  }

  const dog = new PetStateManager();
  assert.equal(dog.nextAutonomousAction(0), null);
  assert.equal(dog.nextAutonomousAction(20 * minute - 1), null);
  assert.equal(dog.nextAutonomousAction(20 * minute), 'pee');
  assert.equal(dog.nextAutonomousAction(20 * minute + 1), null);
  dog.feedReaction(30 * minute);
  assert.equal(dog.nextAutonomousAction(40 * minute), null, 'Pending digestion prevents pee just before poop');
  assert.equal(dog.nextAutonomousAction(50 * minute), 'poop');
  assert.equal(dog.nextAutonomousAction(70 * minute - 1), null);
  assert.equal(dog.nextAutonomousAction(70 * minute), 'pee');
  assert.equal(dog.nextAutonomousAction(6 * 60 * minute), 'pee');
  assert.equal(dog.nextAutonomousAction(6 * 60 * minute + 1), null, 'No burst of missed events after inactivity');

  const overfed = new PetStateManager();
  assert.equal(overfed.feedReaction(0), 'eat');
  assert.equal(overfed.feedReaction(1000), 'eat');
  assert.equal(overfed.feedReaction(2000), 'vomit');
  assert.equal(overfed.nextAutonomousAction(20 * minute), 'pee', 'Vomiting cancels the pending poop');
  console.log('PASS all five pets: slower digestion, merged meals, shared poop/pee cooldown, cleaning/switching and no catch-up bursts');
}

module.exports = checkElimination;
if (require.main === module) checkElimination();
