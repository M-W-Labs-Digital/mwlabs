import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { getSessionCookie } from 'better-auth/cookies';
import { toNextJsHandler } from 'better-auth/next-js';

async function load(path, preamble = '') {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(preamble + source.replace(/^import .*;\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { getAuthConfig } = await load('../src/lib/auth-config.ts');

test('production auth uses a public canonical origin and the mounted API path', () => {
  for (const value of [undefined, '', 'not-a-url', 'http://localhost:3000', 'https://localhost:3000', 'https://127.0.0.1', 'http://mwlabs.digital']) {
    assert.deepEqual(getAuthConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: value }), {
      baseURL: 'https://mwlabs.digital', basePath: '/api/auth', trustedOrigins: ['https://mwlabs.digital'],
    });
  }
  assert.equal(getAuthConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://www.mwlabs.digital/api/auth' }).baseURL, 'https://mwlabs.digital');
  assert.equal(getAuthConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SITE_URL: 'https://staging.example.com/' }).baseURL, 'https://staging.example.com');
  assert.equal(getAuthConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://command.example.com/wrong/path' }).baseURL, 'https://command.example.com');
  assert.equal(getAuthConfig({ NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3100' }).baseURL, 'http://localhost:3100');
});

test('production login, session cookies, recovery and OAuth work behind an internal HTTP host', async () => {
  let recovery;
  const auth = betterAuth({
    ...getAuthConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'http://localhost:3000' }),
    secret: 'test-only-auth-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (value) => { recovery = value; },
    },
    socialProviders: { google: { clientId: 'test-client', clientSecret: 'test-secret' } },
    advanced: { useSecureCookies: true, cookiePrefix: 'mwlabscmd' },
    rateLimit: { enabled: false },
    logger: { level: 'error' },
  });
  const handlers = toNextJsHandler(auth);
  const request = (path, body, origin = 'https://mwlabs.digital') => handlers.POST(new Request(`http://localhost:3000/api/auth/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
  }));
  const credentials = { email: 'auth-test@example.com', password: 'test-login-password-123' };
  assert.equal((await request('sign-up/email', { ...credentials, name: 'Auth Test' })).status, 200);
  const signIn = await request('sign-in/email', { ...credentials, callbackURL: '/app/tasks?view=mine' });
  assert.equal(signIn.status, 200);
  const setCookie = signIn.headers.get('set-cookie');
  assert.match(setCookie, /__Secure-mwlabscmd\.session_token=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.match(/(__Secure-mwlabscmd\.session_token=[^;]+)/)[1];
  assert.ok(getSessionCookie(new Headers({ cookie }), { cookiePrefix: 'mwlabscmd' }));
  const sessionRequest = () => handlers.GET(new Request('http://localhost:3000/api/auth/get-session?disableCookieCache=true', { headers: { cookie } }));
  assert.equal((await (await sessionRequest()).json()).user.email, credentials.email);
  const wrongOrigin = await request('sign-in/email', credentials, 'https://attacker.example');
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json()).code, 'INVALID_ORIGIN');
  assert.equal((await request('sign-in/email', { ...credentials, callbackURL: 'https://attacker.example/app' })).status, 403);
  assert.equal((await request('sign-in/email', { ...credentials, password: 'incorrect' })).status, 401);

  assert.equal((await request('request-password-reset', { email: credentials.email, redirectTo: '/reset-password' })).status, 200);
  assert.equal(new URL(recovery.url).origin, 'https://mwlabs.digital');
  assert.ok(new URL(recovery.url).pathname.startsWith('/api/auth/reset-password/'));
  const resetLink = await handlers.GET(new Request(recovery.url));
  const resetDestination = new URL(resetLink.headers.get('location'), 'https://mwlabs.digital');
  assert.equal(resetDestination.pathname, '/reset-password');
  assert.equal(resetDestination.searchParams.get('token'), recovery.token);
  const newPassword = 'updated-test-password-456';
  assert.equal((await request('reset-password', { token: recovery.token, newPassword })).status, 200);
  assert.equal(await (await sessionRequest()).json(), null);
  assert.equal((await request('sign-in/email', credentials)).status, 401);
  assert.equal((await request('sign-in/email', { ...credentials, password: newPassword })).status, 200);

  const social = await request('sign-in/social', { provider: 'google', callbackURL: '/auth/continue' });
  assert.equal(social.status, 200);
  const authorization = new URL((await social.json()).url);
  assert.equal(authorization.searchParams.get('redirect_uri'), 'https://mwlabs.digital/api/auth/callback/google');
});

test('proxy sends unauthenticated production requests to the public login with their destination', async () => {
  const { proxy } = await load('../src/proxy.ts', `
    import { NextRequest, NextResponse } from ${JSON.stringify(import.meta.resolve('next/server.js'))};
    import { getSessionCookie } from ${JSON.stringify(import.meta.resolve('better-auth/cookies'))};
    const authCookiePrefix = 'mwlabscmd';
    const getAuthConfig = () => ({ baseURL: 'https://mwlabs.digital' });
    const safePostAuthPath = (value) => value;
  `);
  const { NextRequest } = await import('next/server.js');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = proxy(new NextRequest('http://localhost:3000/app/tasks?view=mine'));
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.origin, 'https://mwlabs.digital');
    assert.equal(destination.pathname, '/sign-in');
    assert.equal(destination.searchParams.get('next'), '/app/tasks?view=mine');
    assert.equal(proxy(new NextRequest('http://localhost:3000/app', { headers: { cookie: '__Secure-mwlabscmd.session_token=present' } })).headers.get('location'), null);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('authenticated mutations trust the public origin behind Hostinger and reject cross-site requests', async () => {
  const source = await readFile(new URL('../src/lib/dal.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('dal.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'hasTrustedMutationOrigin');
  const configSource = await readFile(new URL('../src/lib/auth-config.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(`
    ${configSource}
    ${declaration.getText(parsed)}
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  const { hasTrustedMutationOrigin } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const request = (headers) => new Request('http://localhost:3000/api/registrations/owner', { method: 'POST', headers });
    assert.equal(hasTrustedMutationOrigin(request({ origin: 'https://mwlabs.digital', 'sec-fetch-site': 'same-origin' })), true);
    assert.equal(hasTrustedMutationOrigin(request({ origin: 'https://attacker.example' })), false);
    assert.equal(hasTrustedMutationOrigin(request({ origin: 'https://mwlabs.digital', 'sec-fetch-site': 'cross-site' })), false);
    assert.equal(hasTrustedMutationOrigin(request({ 'x-forwarded-host': 'attacker.example' })), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
