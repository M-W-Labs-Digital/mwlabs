import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

async function load(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('every agency navigation link has an implemented module', async () => {
  const { agencyModules } = await load(await read('src/lib/module-config.ts'));
  const source = await read('src/components/agency/agency-shell.tsx');
  for (const [, module] of source.matchAll(/href: "\/app\/([a-z-]+)"/g)) {
    assert.ok(module === 'ai' || agencyModules.includes(module), module);
  }
});

test('SEO slugs reserve every root route and metadata endpoint', async () => {
  const source = await read('src/lib/crud-server.ts');
  const declaration = source.match(/const reservedPageSlugs = new Set\(\[[\s\S]*?\]\);/)[0];
  const { reservedPageSlugs } = await load(`${declaration}\nexport { reservedPageSlugs };`);
  for (const directory of ['src/app', 'src/app/(marketing)', 'src/app/(agency)']) {
    for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
      if (entry.isDirectory() && !/^[([.]/.test(entry.name)) {
        assert.ok(reservedPageSlugs.has(entry.name), `Unreserved route: ${entry.name}`);
      }
    }
  }
  for (const slug of ['robots.txt', 'sitemap.xml', '_next']) assert.ok(reservedPageSlugs.has(slug));
});

test('homepage fragment links resolve to real targets', async () => {
  const files = ['src/app/(marketing)/page.tsx', 'src/app/layout.tsx',
    'src/components/marketing/marketing-header.tsx', 'src/components/marketing/marketing-footer.tsx',
    'src/components/marketing/marketing-hero.tsx'];
  const sources = await Promise.all(files.map(read));
  const ids = new Set(sources.flatMap((source) => [...source.matchAll(/id="([\w-]+)"/g)].map((match) => match[1])));
  for (const source of sources) {
    for (const [, target] of source.matchAll(/(?:href=|href: )"\/?#([\w-]+)"/g)) {
      assert.ok(ids.has(target), `Missing fragment: #${target}`);
    }
  }
});

test('archive pagination handles malformed and out-of-range requests', async () => {
  const source = await read('src/lib/public-content.ts');
  const parsed = ts.createSourceFile('public-content.ts', source, ts.ScriptTarget.Latest, true);
  const functions = parsed.statements.filter((statement) => ts.isFunctionDeclaration(statement)
    && ['getPublishedBlogPosts', 'getPublishedWorkPosts'].includes(statement.name?.text));
  const contentModule = await load(`
    let lastQuery;
    const delegate = { count: async () => 37, findMany: async (query) => { lastQuery = query; return []; } };
    const db = { blogPost: delegate, workPost: delegate };
    const publishedAtOrBeforeNow = () => ({});
    const withContentFallback = (_scope, query) => query();
    export const query = () => lastQuery;
    ${functions.map((statement) => statement.getText(parsed)).join('\n')}
  `);
  for (const method of [contentModule.getPublishedBlogPosts, contentModule.getPublishedWorkPosts]) {
    for (const input of [NaN, Infinity, -1, 0, 1.5, Number.MAX_VALUE]) {
      assert.equal((await method(input, 12)).page, 1);
      assert.equal(contentModule.query().skip, 0);
    }
    const last = await method(999, 12);
    assert.equal(last.page, 4);
    assert.equal(last.pages, 4);
    assert.equal(contentModule.query().skip, 36);
    assert.equal((await method(2, 12)).page, 2);
    assert.equal(contentModule.query().skip, 12);
  }
});

test('sitemap index lists every generated segment with escaped absolute URLs', async () => {
  const source = (await read('src/app/sitemap.xml/route.ts')).replace(/^import .*;\n/gm, '');
  const { GET } = await load(`
    const generateSitemaps = async () => [{ id: 0 }, { id: 1 }];
    const siteUrl = new URL('https://example.com');
    ${source}
  `);
  const response = await GET();
  assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
  const xml = await response.text();
  assert.ok(xml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  for (const id of [0, 1]) assert.ok(xml.includes(`<loc>https://example.com/sitemap/${id}.xml</loc>`));
});
