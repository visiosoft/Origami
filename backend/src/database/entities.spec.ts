import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import './entities';

/**
 * A column typed `string | null` (or any union) with no explicit `type` is
 * reflected as Object, which SQL Server rejects -- and the whole app then fails
 * to start (Oct 21: notification_items.url took staging down). Give such
 * columns an explicit type, e.g. { type: 'nvarchar', length: 500, nullable: true }.
 */
describe('entities', () => {
  it('every column has a database type (no union-typed column left as Object)', () => {
    const bad = getMetadataArgsStorage().columns
      .filter((c) => (c.options.type as unknown) === Object)
      .map((c) => `${(c.target as any).name}.${c.propertyName}`);
    expect(bad).toEqual([]);
  });
});
