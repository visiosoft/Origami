import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MAX_FOLLOW_UPS, PipelineService } from './pipeline.service';
import { DealEntity, LeadEntity } from '../database/entities';
import { ProjectsService } from '../projects/projects.service';

function mockRepo<T extends object>() {
    return {
        findOneBy: jest.fn(),
        findBy: jest.fn().mockResolvedValue([]),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((x) => x),
        save: jest.fn((x) => Promise.resolve(x)),
        remove: jest.fn((x) => Promise.resolve(x)),
    } as unknown as jest.Mocked<Repository<T>>;
}

describe('PipelineService', () => {
    let dealsRepo: jest.Mocked<Repository<DealEntity>>;
    let leadsRepo: jest.Mocked<Repository<LeadEntity>>;
    let projects: jest.Mocked<ProjectsService>;
    let service: PipelineService;

    beforeEach(() => {
        dealsRepo = mockRepo<DealEntity>();
        leadsRepo = mockRepo<LeadEntity>();
        projects = { ensureForLead: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ProjectsService>;
        service = new PipelineService(dealsRepo, leadsRepo, projects);
    });

    describe('create', () => {
        it('rejects a supplied id that already exists instead of silently upserting onto it', async () => {
            // Regression test: creating a new lead used to silently merge its
            // data onto an unrelated existing deal whenever the client-minted id
            // collided, because save() upserts by primary key.
            dealsRepo.findOneBy.mockResolvedValue({ id: 'PL-1004' } as DealEntity);
            await expect(service.create({ id: 'PL-1004', name: 'Neon Project' })).rejects.toBeInstanceOf(ConflictException);
            expect(dealsRepo.save).not.toHaveBeenCalled();
        });

        it('creates the deal and ensures a Kickoff-stage project for it', async () => {
            dealsRepo.findOneBy.mockResolvedValue(null);
            const deal = await service.create({ id: 'PL-2000', name: 'Neon Project' });
            expect(deal).toEqual(expect.objectContaining({ id: 'PL-2000' }));
            expect(projects.ensureForLead).toHaveBeenCalledWith(expect.objectContaining({ id: 'PL-2000' }));
        });

        it('still returns the saved deal if ensuring its project fails', async () => {
            dealsRepo.findOneBy.mockResolvedValue(null);
            projects.ensureForLead.mockRejectedValue(new Error('boom'));
            const deal = await service.create({ id: 'PL-2001', name: 'Neon Project' });
            expect(deal).toEqual(expect.objectContaining({ id: 'PL-2001' }));
        });
    });

    describe('findOne', () => {
        it('throws NotFoundException when the deal does not exist', async () => {
            dealsRepo.findOneBy.mockResolvedValue(null);
            await expect(service.findOne('PL-404')).rejects.toBeInstanceOf(NotFoundException);
        });

        it("merges in the lead's name/client/phone/email -- DealEntity no longer stores its own copy", async () => {
            // Regression test for the "Kellen Davies" / "Qamaria Coffee" / "Neon
            // Project" drift bug: these fields used to live on the deal row too,
            // written once at creation and never kept in sync with later lead
            // edits. DealEntity no longer has these columns at all -- the lead is
            // the only place they're stored.
            dealsRepo.findOneBy.mockResolvedValue({ id: 'PL-1004' } as DealEntity);
            leadsRepo.findOneBy.mockResolvedValue({
                id: 'PL-1004', leadName: 'Qamaria Coffee', businessName: '', phone: '4083481867', email: 'shaquib@example.com',
            } as LeadEntity);
            const deal = await service.findOne('PL-1004');
            expect(deal.name).toBe('Qamaria Coffee');
            expect(deal.client).toBe('Qamaria Coffee');
            expect(deal.phone).toBe('4083481867');
            expect(deal.email).toBe('shaquib@example.com');
        });

        it('prefers businessName for client when the lead has one', async () => {
            dealsRepo.findOneBy.mockResolvedValue({ id: 'PL-1' } as DealEntity);
            leadsRepo.findOneBy.mockResolvedValue({ id: 'PL-1', leadName: 'Shaquib Rahimi', businessName: 'Qamaria Coffee', phone: '', email: '' } as LeadEntity);
            const deal = await service.findOne('PL-1');
            expect(deal.name).toBe('Shaquib Rahimi');
            expect(deal.client).toBe('Qamaria Coffee');
        });

        it('returns blank name/client/phone/email rather than erroring when a deal has no matching lead', async () => {
            dealsRepo.findOneBy.mockResolvedValue({ id: 'PL-9' } as DealEntity);
            leadsRepo.findOneBy.mockResolvedValue(null);
            const deal = await service.findOne('PL-9');
            expect(deal).toEqual(expect.objectContaining({ name: '', client: '', phone: '', email: '' }));
        });
    });

    describe('findAll', () => {
        it('merges each deal with its matching lead in one batch lookup', async () => {
            dealsRepo.find.mockResolvedValue([
                { id: 'PL-1', archived: false } as DealEntity,
                { id: 'PL-2', archived: false } as DealEntity,
            ]);
            leadsRepo.findBy.mockResolvedValue([
                { id: 'PL-1', leadName: 'Fresh Name', businessName: '', phone: '', email: '' } as LeadEntity,
            ]);
            const deals = await service.findAll();
            expect(deals.find((d) => d.id === 'PL-1')?.name).toBe('Fresh Name');
            expect(deals.find((d) => d.id === 'PL-2')?.name).toBe('');
        });
    });

    describe('updateStage', () => {
        it('keeps the referral fields when moving a referred deal onto its own monitoring stage', async () => {
            const deal = {
                id: 'PL-1', stage: 'project_fit', stageIdx: 4, timeline: [],
                rejectionType: 'referred', rejectionReason: '', referredToName: 'Jane Doe', referredToCompany: 'Acme Design Co.', referredToContact: 'jane@acme.com',
            } as unknown as DealEntity;
            dealsRepo.findOneBy.mockResolvedValue(deal);
            leadsRepo.findOneBy.mockResolvedValue(null);
            const saved = await service.updateStage('PL-1', 'referred_monitoring');
            expect(saved.rejectionType).toBe('referred');
            expect(saved.referredToName).toBe('Jane Doe');
        });

        it('clears the rejection fields when a referred deal is moved back into the active pipeline', async () => {
            const deal = {
                id: 'PL-1', stage: 'referred_monitoring', stageIdx: 16, timeline: [],
                rejectionType: 'referred', rejectionReason: '', referredToName: 'Jane Doe', referredToCompany: 'Acme Design Co.', referredToContact: 'jane@acme.com',
            } as unknown as DealEntity;
            dealsRepo.findOneBy.mockResolvedValue(deal);
            leadsRepo.findOneBy.mockResolvedValue(null);
            const saved = await service.updateStage('PL-1', 'client_approval');
            expect(saved.rejectionType).toBe('');
            expect(saved.referredToName).toBe('');
        });
    });

    describe('logFollowUp', () => {
        const baseDeal = () => ({ id: 'PL-1', name: 'Neon Project', client: 'Neon Project', followUps: [], timeline: [] }) as unknown as DealEntity;

        it('records an outbound attempt and numbers it', async () => {
            dealsRepo.findOneBy.mockResolvedValue(baseDeal());
            const saved = await service.logFollowUp('PL-1', { method: 'Phone', outcome: 'No answer' });
            expect((saved.followUps as any[])[0]).toEqual(expect.objectContaining({ direction: 'out', attempt: 1 }));
        });

        it(`blocks a ${MAX_FOLLOW_UPS + 1}th outbound attempt`, async () => {
            const deal = baseDeal();
            deal.followUps = Array.from({ length: MAX_FOLLOW_UPS }, (_, i) => ({ direction: 'out', attempt: i + 1 }));
            dealsRepo.findOneBy.mockResolvedValue(deal);
            await expect(service.logFollowUp('PL-1', { method: 'Phone', outcome: 'No answer' })).rejects.toBeInstanceOf(BadRequestException);
            expect(dealsRepo.save).not.toHaveBeenCalled();
        });

        it('does not count an inbound contact against the outbound limit', async () => {
            const deal = baseDeal();
            deal.followUps = Array.from({ length: MAX_FOLLOW_UPS }, (_, i) => ({ direction: 'out', attempt: i + 1 }));
            dealsRepo.findOneBy.mockResolvedValue(deal);
            const saved = await service.logFollowUp('PL-1', { method: 'Phone', outcome: 'Reached them', direction: 'in' });
            expect(saved.followUps).toHaveLength(MAX_FOLLOW_UPS + 1);
        });

        it('hands the deal to the assignee after the final attempt', async () => {
            const deal = baseDeal();
            deal.followUps = Array.from({ length: MAX_FOLLOW_UPS - 1 }, (_, i) => ({ direction: 'out', attempt: i + 1 }));
            dealsRepo.findOneBy.mockResolvedValue(deal);
            const saved = await service.logFollowUp('PL-1', { method: 'Email', outcome: 'No response', assignToName: 'Priya Shah', assignToId: 'U-9' });
            expect(saved.assignee).toBe('Priya Shah');
            expect(saved.status).toBe('awaiting_pm');
        });
    });

    describe('setRejection', () => {
        const baseDeal = () => ({ id: 'PL-1', name: 'Neon Project', client: 'Neon Project', timeline: [] }) as unknown as DealEntity;

        it('records an internal rejection with the right fields and timeline text', async () => {
            dealsRepo.findOneBy.mockResolvedValue(baseDeal());
            const saved = await service.setRejection('PL-1', { rejectionType: 'internal' });
            expect(saved.rejectionType).toBe('internal');
            expect((saved.timeline as any[])[0].action).toBe('Rejected — not a fit for us');
        });

        it('records a client rejection with an optional reason folded into the timeline text', async () => {
            dealsRepo.findOneBy.mockResolvedValue(baseDeal());
            const saved = await service.setRejection('PL-1', { rejectionType: 'client', rejectionReason: 'Went with another firm' });
            expect(saved.rejectionType).toBe('client');
            expect((saved.timeline as any[])[0].action).toBe('Rejected — client declined: Went with another firm');
        });

        it('records a referral with the referred-to contact fields and a matching timeline entry', async () => {
            dealsRepo.findOneBy.mockResolvedValue(baseDeal());
            const saved = await service.setRejection('PL-1', {
                rejectionType: 'referred', referredToName: 'Jane Doe', referredToCompany: 'Acme Design Co.', referredToContact: 'jane@acme.com',
            });
            expect(saved.rejectionType).toBe('referred');
            expect(saved.referredToName).toBe('Jane Doe');
            expect(saved.referredToCompany).toBe('Acme Design Co.');
            expect(saved.referredToContact).toBe('jane@acme.com');
            expect((saved.timeline as any[])[0].action).toBe('Referred to Jane Doe, Acme Design Co. (jane@acme.com)');
        });
    });
});
