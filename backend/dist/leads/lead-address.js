"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadStreetAddress = leadStreetAddress;
function leadStreetAddress(l) {
    if (!l)
        return '';
    const clean = (v) => { const t = (v || '').trim(); return /^(n\/?a|none|-+|—)$/i.test(t) ? '' : t; };
    const number = clean(l.projectStreetAddress);
    const street = clean(l.projectStreetName);
    const line1 = number && street && !number.toLowerCase().includes(street.toLowerCase()) ? `${number} ${street}` : number || street;
    if (!line1)
        return '';
    return [line1, clean(l.projectAddress2), clean(l.projectCity), clean(l.projectZipCode)].filter(Boolean).join(', ');
}
//# sourceMappingURL=lead-address.js.map