"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeopleService = void 0;
const common_1 = require("@nestjs/common");
const staff_directory_sync_1 = require("../manpower/staff-directory.sync");
const contractor_directory_sync_1 = require("../manpower/contractor-directory.sync");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const contact_status_1 = require("./contact-status");
const attachments_service_1 = require("../google/attachments.service");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const crypto_util_1 = require("../auth/crypto.util");
const business_card_1 = require("./business-card");
const CARD_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let PeopleService = class PeopleService {
    constructor(repo, staff, subs, attachments, google, settings) {
        this.repo = repo;
        this.staff = staff;
        this.subs = subs;
        this.attachments = attachments;
        this.google = google;
        this.settings = settings;
    }
    async findAll(project) {
        const all = await this.repo.find({ order: { id: 'ASC' } });
        return project ? all.filter((p) => (p.projects ?? []).includes(project)) : all;
    }
    async findOne(id) {
        const person = await this.repo.findOneBy({ id: Number(id) });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        return person;
    }
    async isClientOnProject(email, projectName) {
        if (!email || !projectName)
            return false;
        const person = await this.repo
            .createQueryBuilder('p')
            .where('LOWER(p.email) = :email', { email: email.trim().toLowerCase() })
            .andWhere('p.tier = :tier', { tier: 'Client' })
            .getOne();
        return !!person?.projects?.includes(projectName);
    }
    async linkToProject(email, name, tier, projectName) {
        const clean = (email || '').trim().toLowerCase();
        const existing = await this.repo
            .createQueryBuilder('p')
            .where('LOWER(p.email) = :email', { email: clean })
            .getOne();
        if (existing) {
            if (!(existing.projects || []).includes(projectName)) {
                existing.projects = [...(existing.projects || []), projectName];
                await this.repo.save(existing);
            }
            return existing;
        }
        const id = await this.nextId();
        const person = this.repo.create({
            id, name: name || clean, email: clean, tier, kind: tier, company: '', phone: '',
            projects: [projectName], openTasks: 0, since: new Date().toISOString().slice(0, 10), comply: null, last: 'Guest invited',
        });
        return this.repo.save(person);
    }
    async nextId() {
        const rows = await this.repo.find();
        return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    }
    async scanCard(files, actor) {
        if (!this.attachments || !this.google || !this.settings)
            throw new common_1.BadRequestException('Card scanning needs Google connected (Settings → Integrations).');
        const sides = ['front', 'back'].filter((s) => files[s]);
        const uploaded = await this.attachments.upload(sides.map((s) => files[s]), 'Business cards', actor);
        const cards = {};
        sides.forEach((s, i) => { cards[s] = uploaded[i]; });
        const texts = [];
        let readError = '';
        for (const s of sides) {
            try {
                texts.push(await this.google.imageToText(files[s].buffer, files[s].mimetype, `card-${s}`));
            }
            catch (e) {
                readError = e.message || 'Could not read the card';
            }
        }
        const text = texts.join('\n').trim();
        const cardToken = (0, crypto_util_1.signState)({ mode: 'business-card', cards }, await this.settings.jwtSecret());
        return { cardToken, front: cards.front || null, back: cards.back || null, text, fields: (0, business_card_1.parseBusinessCard)(text), readError: text ? '' : readError };
    }
    async cardsFromToken(token) {
        if (!token || !this.settings)
            return null;
        const st = (0, crypto_util_1.readState)(String(token), await this.settings.jwtSecret(), CARD_TOKEN_MAX_AGE_MS);
        return st?.mode === 'business-card' && st.cards && typeof st.cards === 'object' ? st.cards : null;
    }
    async applyCardToken(dto, current) {
        const cards = await this.cardsFromToken(dto.businessCardToken);
        delete dto.businessCardToken;
        delete dto.businessCards;
        if (cards)
            dto.businessCards = { ...(current?.businessCards || {}), ...cards };
    }
    async addCardPhotos(id, files, actor) {
        if (!this.attachments)
            throw new common_1.BadRequestException('Uploads need Google connected (Settings → Integrations).');
        const person = await this.repo.findOneBy({ id: Number(id) });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        const sides = ['front', 'back'].filter((s) => files[s]);
        if (!sides.length)
            throw new common_1.BadRequestException('Add a photo of the card.');
        const uploaded = await this.attachments.upload(sides.map((s) => files[s]), 'Business cards', actor);
        const cards = { ...(person.businessCards || {}) };
        for (const [i, s] of sides.entries()) {
            await this.attachments.discard(cards[s] || undefined);
            cards[s] = uploaded[i];
        }
        await this.repo.update({ id: person.id }, { businessCards: cards });
        return { ...person, businessCards: cards };
    }
    async removeCardPhoto(id, side) {
        const person = await this.repo.findOneBy({ id: Number(id) });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        const cards = { ...(person.businessCards || {}) };
        await this.attachments?.discard(cards[side] || undefined);
        cards[side] = null;
        await this.repo.update({ id: person.id }, { businessCards: cards });
        return { ...person, businessCards: cards };
    }
    async cardPhoto(id, side) {
        const person = await this.repo.findOneBy({ id: Number(id) });
        const att = person?.businessCards?.[side];
        if (!att)
            throw new common_1.NotFoundException('No card photo.');
        return att;
    }
    async create(dto) {
        dto = { ...dto };
        await this.applyCardToken(dto);
        const id = Number(dto.id) || (await this.nextId());
        const now = new Date().toISOString();
        const person = { projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added', ...dto, id, contactStatus: 'active', contactStatusAt: now, lastActivityAt: now };
        const saved = await this.repo.save(this.repo.create(person));
        if (saved.kind === 'Staff' && !saved.employeeId && this.staff)
            await this.staff.employeeForPerson(saved);
        if ((0, contractor_directory_sync_1.isSubCompany)(saved) && this.subs)
            await this.subs.contractorForPerson(saved);
        return saved;
    }
    async update(id, dto) {
        const numId = Number(id);
        const person = await this.repo.findOneBy({ id: numId });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        const now = new Date().toISOString();
        const patch = { ...dto };
        delete patch.lastActivityAt;
        await this.applyCardToken(patch, person);
        if ('contactStatus' in patch) {
            const next = String(patch.contactStatus || 'active').toLowerCase();
            if (!contact_status_1.CONTACT_STATUSES.includes(next))
                throw new common_1.BadRequestException('Status is Active, Review or Expired.');
            if (next !== (person.contactStatus || 'active'))
                Object.assign(patch, { contactStatus: next, contactStatusAt: now, contactStatusReason: String(patch.contactStatusReason || '').trim().slice(0, 300) || null });
            else
                delete patch.contactStatusReason;
            if (next === 'active')
                patch.lastActivityAt = now;
        }
        if (Object.keys(dto).some((k) => !k.startsWith('contactStatus')))
            patch.lastActivityAt = now;
        Object.assign(person, patch, { id: numId });
        const saved = await this.repo.save(person);
        await this.staff?.personChanged(saved, dto);
        await this.subs?.personChanged(saved, dto);
        return saved;
    }
    async remove(id) {
        const numId = Number(id);
        const person = await this.repo.findOneBy({ id: numId });
        if (person?.employeeId) {
            throw new common_1.BadRequestException(`${person.name} is also an employee -- end or remove them in Manpower -> Employees and this entry follows.`);
        }
        if (person?.contractorId)
            await this.subs?.removeForPerson(person);
        if (person)
            await this.repo.remove(person);
        return { id: numId, deleted: true };
    }
};
exports.PeopleService = PeopleService;
exports.PeopleService = PeopleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        staff_directory_sync_1.StaffDirectorySync,
        contractor_directory_sync_1.ContractorDirectorySync,
        attachments_service_1.AttachmentsService,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], PeopleService);
//# sourceMappingURL=people.service.js.map