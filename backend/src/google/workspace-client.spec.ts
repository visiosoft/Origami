import { GoogleService } from './google.service';
import { SettingsService } from '../settings/settings.service';

/** The company connection may use its own (Internal) OAuth client; sign-in never does. */
function service(values: Record<string, string>) {
  const settings = { get: async (k: string) => values[k] ?? null, baseUrl: async () => 'https://x.test' } as unknown as SettingsService;
  return new GoogleService(settings);
}

const MAIN = { 'google.clientId': 'main-id', 'google.clientSecret': 'main-secret', 'app.baseUrl': 'https://x.test' };

describe('GoogleService workspace client', () => {
  it('uses the main client for everything when no company client is set', async () => {
    const g = service(MAIN);
    expect((await g.credentials('workspace')).clientId).toBe('main-id');
    expect((await g.credentials('public')).clientId).toBe('main-id');
  });

  it('uses the company client for the workspace connection only', async () => {
    const g = service({ ...MAIN, 'google.workspaceClientId': 'ws-id', 'google.workspaceClientSecret': 'ws-secret' });
    expect(await g.credentials('workspace')).toMatchObject({ clientId: 'ws-id', clientSecret: 'ws-secret' });
    expect((await g.credentials('public')).clientId).toBe('main-id');
    expect(await g.consentUrl('connect', 's')).toContain('client_id=ws-id');
    expect(await g.consentUrl('login', 's')).toContain('client_id=main-id');
  });

  it('ignores a company client with no secret', async () => {
    const g = service({ ...MAIN, 'google.workspaceClientId': 'ws-id' });
    expect((await g.credentials('workspace')).clientId).toBe('main-id');
  });
});
