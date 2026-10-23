// Condensed checklists. Each transfer gets a flat list of
// { text, checked, remark } items built from these.
const ELECTRICAL_ITEMS = [
  'Physically intact — no cracks, dents, exposed parts, or burn/melt marks',
  'Wiring and connections secure — no fraying, loose terminals, or damaged insulation',
  'Proper earthing — no leakage current or short circuit',
  'Protection devices (fuse/MCB/RCCB) and emergency stop functional',
  'Starts, runs and stops normally — no abnormal noise, heat, or tripping',
  'Switches, relays, motors, sensors and indicators work correctly',
  'No moisture, dust, or chemical ingress affecting components',
  'No sparking, burning smell, or repeated trips during operation',
  'Voltage/current/load within rated limits',
  'Maintenance, inspection and calibration records up to date',
];

const MECHANICAL_ITEMS = [
  'Physically intact — no cracks, fractures, deformation or missing parts',
  'No excessive wear, corrosion, or surface damage',
  'Dimensions and alignment within tolerance',
  'Fasteners, joints and welds secure and properly torqued',
  'Bearings, shafts and gears rotate smoothly — no abnormal noise/play',
  'Belts, chains and couplings correctly tensioned and aligned',
  'Seals intact, no leakage; lubrication adequate',
  'Hydraulic/pneumatic lines and moving parts free of leaks or jams',
  'Normal vibration, noise and operating temperature',
  'Guards and safety covers intact and securely fitted',
  'No overload — starts, operates and stops as intended',
  'Maintenance up to date, no overdue critical service',
];

const MECHANICAL_STATUS_OPTIONS = [
  'Good', 'Serviceable', 'Worn', 'Damaged', 'Faulty', 'Unsafe', 'Under Maintenance', 'Decommissioned',
];

const instantiate = (items) => items.map((text) => ({ text, checked: false, remark: '' }));

module.exports = { ELECTRICAL_ITEMS, MECHANICAL_ITEMS, MECHANICAL_STATUS_OPTIONS, instantiate };