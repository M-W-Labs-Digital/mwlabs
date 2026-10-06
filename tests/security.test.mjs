import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const permissions = await loadSource('../src/lib/permissions.ts');
const { safePostAuthPath } = await loadSource('../src/lib/auth-shared.ts');
const { assessPublicSubmission } = await loadSource('../src/lib/anti-spam.ts');
const { readRequestBytes, RequestBodyTooLargeError } = await loadSource('../src/lib/request-body.ts');

test('members cannot read commercial records or write leads; unknown roles fail closed', () => {
  for (const resource of ['leads', 'invoices', 'payments', 'invoice-items', 'proposals', 'contracts', 'expenses', 'retainers', 'automations']) {
    assert.equal(permissions.canReadResource('member', resource), false, resource);
    assert.equal(permissions.canWriteResource('member', resource), false, resource);
    assert.equal(permissions.canReadResource('owner', resource), true);
  }
  for (const role of ['customer', '', 'unexpected', 'owner,member']) {
    assert.equal(permissions.canWriteResource(role, 'tasks'), false);
    assert.equal(permissions.canReadResource(role, 'tasks'), false);
    assert.equal(permissions.canAccessModule(role, 'ai'), false);
  }
  assert.equal(permissions.canReadResource('member', 'projects'), true);
  assert.equal(permissions.canWriteResource('member', 'tasks'), true);
});

test('post-auth redirects reject external and encoded host tricks', () => {
  for (const path of ['//evil.example', '/\\evil.example', 'https://evil.example', '/app/../../evil', '/app-malicious']) {
    assert.equal(safePostAuthPath(path), '/auth/continue', path);
  }
  assert.equal(safePostAuthPath('/app/tasks?view=mine'), '/app/tasks?view=mine');
  for (const path of ['/portal', '/book/manage?booking=signed-token', '/invite/invitation-id']) {
    assert.equal(safePostAuthPath(path), path);
  }
  for (const path of ['/portal-malicious', '/invite/../../sign-in', '/book/../../evil', '/invite/\\evil.example']) {
    assert.equal(safePostAuthPath(path), '/auth/continue', path);
  }
});

test('failed submissions can retry, successful duplicates report a conflict', () => {
  const request = new Request('http://localhost/api/enquiries');
  const values = { email: 'person@example.com', message: 'A project request', formStartedAt: '' };
  const options = { bucket: crypto.randomUUID(), limit: 10 };
  const first = assessPublicSubmission(request, values, options);
  assert.equal(first.allowed, true, 'an omitted timer must not silently discard a request');
  assert.equal(assessPublicSubmission(request, values, options).allowed, true, 'a failed save must remain retryable');
  first.commit();
  const duplicate = assessPublicSubmission(request, values, options);
  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.status, 409);
});

test('honeypots and fast forms are rejected', () => {
  const request = new Request('http://localhost');
  assert.equal(assessPublicSubmission(request, { honeypot: 'bot' }, { bucket: crypto.randomUUID(), limit: 10 }).allowed, false);
  assert.equal(assessPublicSubmission(request, { formStartedAt: String(Date.now()) }, { bucket: crypto.randomUUID(), limit: 10 }).allowed, false);
});

test('request body limits cover chunked bodies and cancel oversized streams', async () => {
  let canceled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(6)); }, cancel() { canceled = true; } });
  const request = new Request('http://localhost', { method: 'POST', body: stream, duplex: 'half' });
  await assert.rejects(readRequestBytes(request, 10), RequestBodyTooLargeError);
  assert.equal(canceled, true);
  assert.equal(request.body.locked, false);
  const exact = new Request('http://localhost', { method: 'POST', body: '1234567890' });
  assert.equal(new TextDecoder().decode(await readRequestBytes(exact, 10)), '1234567890');
  const declared = new Request('http://localhost', { method: 'POST', headers: { 'content-length': '11' }, body: 'a' });
  await assert.rejects(readRequestBytes(declared, 10), RequestBodyTooLargeError);
});

test('rate limiter bounds unique visitor memory and rejects excess requests', async () => {
  const { createRateLimiter } = await loadSource('../src/lib/rate-limit.ts');
  const allow = createRateLimiter(2);
  assert.equal(allow('a', 1, 60_000), true);
  assert.equal(allow('a', 1, 60_000), false);
  assert.equal(allow('b', 1, 60_000), true);
  assert.equal(allow('c', 1, 60_000), false);
});
