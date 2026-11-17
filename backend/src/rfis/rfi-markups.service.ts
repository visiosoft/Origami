import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarkupLayerEntity, PdfMarkupEntity, RfiEntity } from '../database/entities';
import { layerKey } from '../file-room/markups';
import { canPublish, numberCallouts, rfiDraftLayer, rfiPublishedLayer } from './rfi-markups';

type Actor = { name: string; id?: string };

@Injectable()
export class RfiMarkupsService {
  constructor(
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    @InjectRepository(PdfMarkupEntity) private readonly markups: Repository<PdfMarkupEntity>,
    @InjectRepository(MarkupLayerEntity) private readonly layers: Repository<MarkupLayerEntity>,
  ) {}

  private async rfi(id: string) {
    const r = await this.rfis.findOneBy({ id });
    if (!r) throw new NotFoundException('RFI not found');
    return r;
  }

  /** Make sure the RFI's draft layer on this drawing exists and is internal-only; returns its name. */
  async draftLayer(id: string, fileId: string, actor: Actor) {
    const r = await this.rfi(id);
    if (!fileId) throw new BadRequestException('Pick a drawing.');
    const layer = rfiDraftLayer(r.number);
    const key = layerKey({ layer });
    await this.layers.save(this.layers.create({ id: `${fileId}|${key}`, fileId, layerKey: key, audience: 'internal', people: null, updatedBy: actor.name, updatedAt: new Date().toISOString() }));
    return { layer, rfiId: r.id, number: r.number, published: false };
  }

  /** The RFI's callouts on every drawing, numbered, with where they sit. */
  async callouts(id: string) {
    const r = await this.rfi(id);
    const rows = await this.markups.find({ where: { linkType: 'rfi', linkId: r.id } });
    const draft = layerKey({ layer: rfiDraftLayer(r.number) });
    return numberCallouts(rows).map((m) => ({
      id: m.id, n: m.n, fileId: m.fileId, page: m.page, kind: m.kind, note: (m.data as any)?.note || (m.data as any)?.text || '',
      authorName: m.authorName, draft: layerKey(m) === draft,
    }));
  }

  /** Move the RFI's draft markups onto a layer everyone sees (staff, once answered or closed). */
  async publish(id: string, actor: Actor) {
    const r = await this.rfi(id);
    if (!canPublish(r.status)) throw new BadRequestException('Publish once the RFI is answered (or closed), so only vetted markups reach the drawing set.');
    const draft = layerKey({ layer: rfiDraftLayer(r.number) });
    const rows = (await this.markups.find({ where: { linkType: 'rfi', linkId: r.id } })).filter((m) => layerKey(m) === draft);
    if (!rows.length) throw new BadRequestException('There are no draft markups to publish.');
    const to = rfiPublishedLayer(r.number);
    const at = new Date().toISOString();
    for (const m of rows) { m.layer = to; m.private = false; m.updatedAt = at; }
    await this.markups.save(rows);
    // The published layer is seen by everyone on the drawing (no rule = everyone); the draft rules go.
    for (const fileId of new Set(rows.map((m) => m.fileId))) {
      await this.layers.delete({ id: `${fileId}|${draft}` });
      await this.layers.delete({ id: `${fileId}|${layerKey({ layer: to })}` });
    }
    r.history = [...(r.history || []), { at, by: actor.name, action: 'published markups', note: `${rows.length} markup${rows.length === 1 ? '' : 's'} moved to the drawing set (layer “${to}”)` } as any];
    await this.rfis.save(r);
    return { published: rows.length, layer: to };
  }
}
