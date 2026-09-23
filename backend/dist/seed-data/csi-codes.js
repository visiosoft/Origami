"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CSI_CODES = void 0;
exports.DEFAULT_CSI_CODES = [
    { code: '01 00 00', division: 'General Requirements' },
    { code: '02 00 00', division: 'Existing Conditions' },
    { code: '03 00 00', division: 'Concrete' },
    { code: '04 00 00', division: 'Masonry' },
    { code: '05 00 00', division: 'Metals' },
    { code: '06 00 00', division: 'Wood, Plastics, and Composites' },
    { code: '07 00 00', division: 'Thermal and Moisture Protection' },
    { code: '08 00 00', division: 'Openings' },
    { code: '09 00 00', division: 'Finishes' },
    { code: '10 00 00', division: 'Specialties' },
    { code: '11 00 00', division: 'Equipment' },
    { code: '12 00 00', division: 'Furnishings' },
    { code: '13 00 00', division: 'Special Construction' },
    { code: '14 00 00', division: 'Conveying Equipment' },
    { code: '21 00 00', division: 'Fire Suppression' },
    { code: '22 00 00', division: 'Plumbing' },
    { code: '23 00 00', division: 'Heating, Ventilating, and Air Conditioning (HVAC)' },
    { code: '26 00 00', division: 'Electrical' },
    { code: '27 00 00', division: 'Communications' },
    { code: '28 00 00', division: 'Electronic Safety and Security' },
    { code: '31 00 00', division: 'Earthwork' },
    { code: '32 00 00', division: 'Exterior Improvements' },
    { code: '33 00 00', division: 'Utilities' },
].map((c, i) => ({ id: 'CSI-' + c.code.slice(0, 2), ...c, description: '', active: true, order: i }));
//# sourceMappingURL=csi-codes.js.map