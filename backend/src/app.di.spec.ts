import { Test } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';

/**
 * Every provider in the app can be built: a module that injects something it
 * doesn't import fails here instead of stopping the server on deploy. The
 * database is a stand-in -- nothing is queried while the graph is built.
 */
describe('app wiring', () => {
  it('builds every module and provider', async () => {
    // Not a thenable: Nest awaits providers, and a 'then' here would never resolve.
    const repo = new Proxy({}, { get: (_t, k) => (k === 'then' ? undefined : jest.fn(async () => [])) });
    const manager = { getRepository: () => repo, transaction: jest.fn() };
    const dataSource = { options: { type: 'mssql' }, entityMetadatas: [], isInitialized: true, manager, getRepository: () => repo, getMetadata: () => ({}), destroy: jest.fn() };
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken()).useValue(dataSource)
      .overrideProvider(getEntityManagerToken()).useValue(manager)
      .compile();
    expect(mod).toBeDefined();
    await mod.close().catch(() => undefined);
  }, 60_000);
});
