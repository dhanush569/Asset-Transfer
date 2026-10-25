// Short keyword checklists. Each transfer gets a flat list of
// { text, checked, remark } items built from these. Providers can also add custom items.
const ELECTRICAL_ITEMS = [
  'Physical condition',
  'Wiring & connections',
  'Earthing',
  'Protection devices & E-stop',
  'Start / run / stop',
  'Switches, relays & sensors',
  'Moisture & dust',
  'Sparking / burning smell',
  'Voltage & load',
  'Maintenance records',
];

const MECHANICAL_ITEMS = [
  'Physical condition',
  'Wear & corrosion',
  'Dimensions & alignment',
  'Fasteners & welds',
  'Bearings, shafts & gears',
  'Belts, chains & couplings',
  'Seals & lubrication',
  'Hydraulic / pneumatic',
  'Vibration, noise & heat',
  'Guards & safety covers',
  'Overload & operation',
  'Maintenance records',
];

const MECHANICAL_STATUS_OPTIONS = [
  'Good', 'Serviceable', 'Worn', 'Damaged', 'Faulty', 'Unsafe', 'Under Maintenance', 'Decommissioned',
];

const instantiate = (items) => items.map((text) => ({ text, checked: false, remark: '', custom: false }));

module.exports = { ELECTRICAL_ITEMS, MECHANICAL_ITEMS, MECHANICAL_STATUS_OPTIONS, instantiate };