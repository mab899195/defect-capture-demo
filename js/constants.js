// Fixed lists used across the app. Keys match the values stored in data/*.json.

// Defect types, based on the AASHTO element framework for reinforced concrete.
export const DEFECT_TYPES = [
  { id: 'cracking', label: 'Cracking' },
  { id: 'delamination', label: 'Delamination' },
  { id: 'spalling', label: 'Spalling' },
  { id: 'efflorescence', label: 'Efflorescence' },
  { id: 'exposed_rebar', label: 'Exposed rebar' },
];

// Condition states 1 (good) to 4 (severe). `text` is the readable text colour
// on top of `color`; the number is always shown next to the colour.
export const CONDITION_STATES = {
  1: { label: 'Good', color: '#6BAF92', text: '#15191E' },
  2: { label: 'Fair', color: '#E3B341', text: '#15191E' },
  3: { label: 'Poor', color: '#E07A2E', text: '#15191E' },
  4: { label: 'Severe', color: '#B3261E', text: '#FFFFFF' },
};

// Engineer decisions. `null` in the data means "not reviewed yet".
export const ENGINEER_STATUSES = [
  { id: 'no_action', label: 'No action' },
  { id: 'repair', label: 'Repair' },
  { id: 'reinforce', label: 'Reinforce' },
  { id: 'revisit', label: 'Revisit' },
];

export const typeLabel = (id) => DEFECT_TYPES.find((t) => t.id === id)?.label ?? id;
export const statusLabel = (id) => ENGINEER_STATUSES.find((s) => s.id === id)?.label ?? 'Not yet reviewed';
export const csLabel = (cs) => CONDITION_STATES[cs]?.label ?? '';
