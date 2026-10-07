import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

async function factory(path, parameters, returned, preamble = '') {
  const source = (await read(path)).replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  const { outputText } = ts.transpileModule(`${preamble}
    export function create(${parameters}) {
      const console = { error() {} };
      ${source}
      return ${returned};
    }
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)).create;
}

const createReader = await factory('src/lib/registration-page.ts', 'db, getCurrentAuthSession', 'getRegistrationPageState');
const session = { user: { id: 'customer', name: 'Customer', email: 'customer@example.com' } };
function database({ workspace = { id: 'workspace' }, membership = null, lead = null, user = null } = {}) {
  return {
    organization: { findUnique: async () => workspace },
    member: { findFirst: async () => membership },
    lead: { findFirst: async () => lead },
    user: { findUnique: async () => user },
  };
}

test('registration renders for visitors and retains customer profile and redirect behavior', async () => {
  assert.deepEqual(await createReader(database(), async () => null)(), { status: 'form', workspaceReady: true, profileOnly: false });
  assert.equal((await createReader(database({ workspace: null }), async () => null)()).workspaceReady, false);
  const customer = await createReader(database({ user: { company: 'Company' } }), async () => session)();
  assert.equal(customer.profileOnly, true);
  assert.equal(customer.defaults.name, 'Customer');
  assert.equal(customer.defaults.email, 'customer@example.com');
  assert.equal(customer.defaults.company, 'Company');
  for (const values of [{ membership: { id: 'member' } }, { lead: { id: 'lead' } }]) {
    assert.deepEqual(await createReader(database(values), async () => session)(), { status: 'redirect', destination: '/app' });
  }
  assert.equal((await createReader(database({ lead: { id: 'lead' } }), async () => session)(true)).newRequest, true);
});

test('workspace, session and profile failures recover without treating a failed session as anonymous', async () => {
  const fail = async () => { throw new Error('Database unavailable'); };
  const unavailable = { status: 'unavailable' };
  const db = database();
  db.organization.findUnique = fail;
  assert.deepEqual(await createReader(db, async () => null)(), unavailable);
  assert.deepEqual(await createReader(database(), fail)(), unavailable);
  const profileDb = database();
  profileDb.user.findUnique = fail;
  assert.deepEqual(await createReader(profileDb, async () => session)(), unavailable);
});

test('health detects missing registration tables even when SELECT 1 succeeds', async () => {
  const createHealth = await factory('src/app/api/health/route.ts', 'db', 'GET');
  const db = { $queryRaw: async () => [{ 1: 1 }], organization: { findFirst: async () => null } };
  assert.equal((await createHealth(db)()).status, 200);
  db.organization.findFirst = async () => { throw new Error('Table does not exist'); };
  assert.equal((await createHealth(db)()).status, 503);
});

test('registration API returns a recoverable error without leaking database details', async () => {
  const createHandler = await factory('src/app/api/registrations/lead/route.ts',
    '{ db, getAuthSessionFromHeaders, hasTrustedMutationOrigin, assessPublicSubmission, registerLeadProfile }', 'POST',
    `import { z } from ${JSON.stringify(import.meta.resolve('zod'))};`);
  const dependencies = {
    db: database(),
    hasTrustedMutationOrigin: () => true,
    getAuthSessionFromHeaders: async () => { throw new Error('Private database error'); },
  };
  const request = () => new Request('https://mwlabs.digital/api/registrations/lead', { method: 'POST', body: '{}' });
  const response = await createHandler(dependencies)(request());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /retry or sign in/);
  assert.ok(!body.error.includes('Private'));
  assert.equal((await createHandler({ ...dependencies, hasTrustedMutationOrigin: () => false })(request())).status, 403);
  assert.equal((await createHandler({ ...dependencies, getAuthSessionFromHeaders: async () => null })(request())).status, 401);
});

test('Prisma generator, runtime and adapter versions stay aligned', async () => {
  const configuration = JSON.parse(await read('package.json'));
  const runtime = configuration.dependencies['@prisma/client'];
  assert.match(runtime, /^\d+\.\d+\.\d+$/);
  assert.equal(configuration.dependencies['@prisma/adapter-mariadb'], runtime);
  assert.equal(configuration.devDependencies.prisma, runtime);
});

test('retrying a project submission after signup does not create the account again', async () => {
  const source = await read('src/components/auth/lead-registration-form.tsx');
  const parsed = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'LeadRegistrationForm');
  const handler = component.body.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'handleSubmit');
  const { outputText } = ts.transpileModule(`
    export function create() {
      let completingProfile = false, signups = 0, submissions = 0, destination;
      const workspaceReady = true, newRequest = false, formStartedAt = '1', password = 'SecurePassword123';
      const setPending = () => {};
      const setAccountCreated = (value) => { completingProfile = value; };
      const toast = { error() {}, success() {} };
      const router = { push: (value) => { destination = value; }, refresh() {} };
      const authClient = { signUp: { email: async () => { signups++; return { data: { user: { id: 'created' } } }; } } };
      const fetch = async () => {
        submissions++;
        return { ok: submissions > 1, json: async () => ({ error: 'Temporary outage' }) };
      };
      const FormData = class { constructor(value) { this.value = value; } get(key) { return this.value[key]; } };
      ${handler.getText(parsed)}
      return { submit: handleSubmit, result: () => ({ signups, submissions, destination }) };
    }
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  const { create } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const form = create();
  const event = { preventDefault() {}, currentTarget: {
    name: 'Customer', company: 'Company', email: 'customer@example.com',
    serviceInterest: 'Development', budgetRange: '£5,000', projectBrief: 'A website development project', confirmPassword: 'SecurePassword123',
  } };
  await form.submit(event);
  assert.equal(form.result().destination, undefined);
  await form.submit(event);
  assert.deepEqual(form.result(), { signups: 1, submissions: 2, destination: '/app' });
});
