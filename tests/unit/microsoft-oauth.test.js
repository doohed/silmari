import { describe, it, expect, beforeAll } from 'vitest';
import {
  isMicrosoftConfigured,
  microsoftRedirectUri,
  microsoftConsentUrl,
} from '@/lib/auth/oauth/microsoft';

describe('Microsoft OAuth · configuración y URLs', () => {
  beforeAll(() => {
    process.env.MICROSOFT_CLIENT_ID = 'test-client';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-secret';
  });

  it('isMicrosoftConfigured refleja las credenciales', () => {
    expect(isMicrosoftConfigured()).toBe(true);
  });

  it('deriva el redirect URI del origen', () => {
    expect(microsoftRedirectUri('https://app.example.com/')).toBe(
      'https://app.example.com/api/auth/microsoft/callback',
    );
  });

  it('la URL de consentimiento lleva client_id, scope, state y redirect_uri', () => {
    const url = new URL(
      microsoftConsentUrl({ state: 'abc123', redirectUri: 'https://a/cb' }),
    );
    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('abc123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://a/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('email');
  });
});
