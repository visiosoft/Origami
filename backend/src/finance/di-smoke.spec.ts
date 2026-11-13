import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FinanceModule } from './finance.module';
import { ProjectAccessModule } from '../auth/project-access.service';
import { EstimateLetterService } from './estimate-letter.service';

const fakeDs = { options: { type: 'mssql' }, entityMetadatas: [], getRepository: () => ({}), manager: {}, transaction: async () => undefined };
@Global() @Module({ providers: [{ provide: getDataSourceToken(), useValue: fakeDs }, { provide: 'DataSource', useValue: fakeDs }], exports: [getDataSourceToken(), 'DataSource'] })
class FakeDb {}

it('the finance module wires up with the estimate letter service', async () => {
  const m = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true }), FakeDb, ProjectAccessModule, FinanceModule] }).compile();
  expect(m.get(EstimateLetterService)).toBeDefined();
}, 60000);
