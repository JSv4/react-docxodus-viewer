import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Adapt scheduling, never page-flow decisions. Refuse dependency drift so a
// Docxodus upgrade requires an explicit review and native differential tests.
const root = new URL('../', import.meta.url);
const dist = new URL('node_modules/docxodus/dist/', root);
const target = new URL('src/rendering/cooperativePagination.generated.js', root);
const { version } = JSON.parse(await readFile(new URL('../package.json', dist), 'utf8'));
// Every module whose code is copied; drift in any of them needs the same review.
// Reviewed state: only per-document measurement caches, harmless to duplicate.
const reviewed = {
  'exact-row-text.js': '039f035806b4e7d0a9fa0a5bc6b09815e96fc4a170d3608d84af0e6453ec51a3',
  'line-metrics.js': '7f763a5deb580f79e047d86958d097f03e70eb800e46e347566b50334b0e7401',
  'markup-balloons.js': '980a55d61ec82c9600b08492fa310e8414315affc41f942d9b4a1127feeab4a3',
  'pagination.js': '5a734fb8c998e4c134d14664ec284de7307502dde582c090b744e45e34b23f8f',
  'word-text.js': 'c91878943d7e10faa7e14fabb9a14c056bc993f85978e08771ddefb9d97ff862',
};
// Methods with document-sized loops become async; everything else stays native.
const names = new Set(['paginate', 'paginatePass', 'flowToPages', 'measureBlocks', 'measureSafeEndnoteBlocks', 'buildColumnBlocks',
  'normalizePageMapFragmentIdentities', 'normalizeVisiblePageFragments', 'materializePageMap', 'qualifyPageFragments', 'collectExpectedSourceAnchors']);
// Module helpers the viewer applies to a re-rendered live block (see liveBlocks.ts).
const exposed = { 'line-metrics.js': ['applyUnroundedNormalLineHeights', 'prepareMixedLineHeights'] };

const modules = new Map();
async function load(file) {
  if (modules.has(file)) return modules.get(file);
  const text = await readFile(new URL(file, dist), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declared = new Map(), imported = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const from = statement.moduleSpecifier.text;
      if (!/^\.\/[\w-]+\.js$/.test(from) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) throw new Error(`Review the import of ${from} in ${file}.`);
      for (const element of statement.importClause.namedBindings.elements) imported.set(element.name.text, { file: from.slice(2), name: (element.propertyName ?? element.name).text });
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) declared.set(statement.name.text, statement);
    else if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) declared.set(declaration.name.getText(source), statement);
    // A side effect at module scope would run twice: once in core and once in the copy.
    else if (!ts.isExportDeclaration(statement)) throw new Error(`Review the module-level code in ${file}: ${statement.getText(source).slice(0, 80)}`);
  }
  const module = { file, text, source, declared, imported, needed: new Set(), statements: new Set() };
  modules.set(file, module);
  return module;
}

// Prefer the public binding wherever core re-exports the same declaration.
const core = new Map(), coreImports = new Set();
const coreSource = ts.createSourceFile('core.js', await readFile(new URL('core.js', dist), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
for (const statement of coreSource.statements) {
  if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
  for (const element of statement.exportClause.elements) {
    if (element.isTypeOnly || (element.propertyName && element.propertyName.text !== element.name.text)) continue;
    core.set(`${statement.moduleSpecifier.text.slice(2)}:${element.name.text}`, element.name.text);
  }
}

/** Identifiers a node may read from module scope. Shadowed names only widen the closure. */
function references(node) {
  const found = new Set();
  const visit = child => {
    if (ts.isIdentifier(child)) {
      const parent = child.parent;
      const property = (ts.isPropertyAccessExpression(parent) && parent.name === child) ||
        ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === child);
      if (!property) found.add(child.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
const edges = new Map();
async function need(file, name) {
  const module = await load(file);
  if (module.needed.has(name)) return;
  module.needed.add(name);
  const statement = module.declared.get(name);
  if (!statement) throw new Error(`${file} no longer declares ${name}.`);
  if (module.statements.has(statement)) return;
  module.statements.add(statement);
  await close(module, statement);
}
async function close(module, node) {
  for (const name of references(node)) {
    if (module.declared.has(name)) await need(module.file, name);
    else if (module.imported.has(name)) {
      const origin = module.imported.get(name);
      const shared = core.get(`${origin.file}:${origin.name}`);
      if (shared && shared === name) { coreImports.add(shared); continue; }
      await need(origin.file, origin.name);
      const links = edges.get(module.file) ?? new Map();
      links.set(name, origin); edges.set(module.file, links);
    }
  }
}

const pagination = await load('pagination.js');
const engine = pagination.declared.get('PaginationEngine');
const methods = engine.members.filter(node => names.has(node.name?.getText(pagination.source)));
const missing = [...names].filter(name => !methods.some(node => node.name.getText(pagination.source) === name));
if (missing.length) throw new Error(`PaginationEngine no longer declares ${missing.join(', ')}.`);
// The adapter extends the native engine; a helper must never construct or copy it.
pagination.declared.delete('PaginationEngine');
for (const method of methods) await close(pagination, method);
for (const [file, list] of Object.entries(exposed)) for (const name of list) {
  await need(file, name);
  edges.set('pagination.js', (edges.get('pagination.js') ?? new Map()).set(name, { file, name }));
}
const digests = Object.fromEntries([...modules.values()].filter(module => module.statements.size).map(module => [module.file, createHash('sha256').update(module.text).digest('hex')]).sort());
if (JSON.stringify(digests) !== JSON.stringify(reviewed)) throw new Error(`Review the cooperative adapter for Docxodus ${version} before regenerating.\nReviewed sources are now:\n${JSON.stringify(digests, null, 2)}`);

const f = ts.factory;
const pause = f.createBlock([
  f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration('pending', undefined, undefined, f.createCallExpression(f.createIdentifier('checkpoint'), undefined, []))], ts.NodeFlags.Const)),
  f.createIfStatement(f.createIdentifier('pending'), f.createExpressionStatement(f.createAwaitExpression(f.createIdentifier('pending')))),
], true);
const adapted = ts.transform(pagination.source, [context => {
  const visit = node => {
    // Local helpers remain synchronous; their enclosing page/block loop yields.
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return node;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && names.has(node.expression.name.text)) {
      return f.createAwaitExpression(f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('cooperative'), node.expression.name.text), undefined, node.arguments.map(arg => ts.visitNode(arg, visit))));
    }
    let next = ts.visitEachChild(node, visit, context);
    if (ts.isForStatement(next) || ts.isForOfStatement(next) || ts.isForInStatement(next) || ts.isWhileStatement(next) || ts.isDoStatement(next)) {
      const body = f.createBlock([pause, ...(ts.isBlock(next.statement) ? next.statement.statements : [next.statement])], true);
      if (ts.isForStatement(next)) next = f.updateForStatement(next, next.initializer, next.condition, next.incrementor, body);
      else if (ts.isForOfStatement(next)) next = f.updateForOfStatement(next, next.awaitModifier, next.initializer, next.expression, body);
      else if (ts.isForInStatement(next)) next = f.updateForInStatement(next, next.initializer, next.expression, body);
      else if (ts.isWhileStatement(next)) next = f.updateWhileStatement(next, next.expression, body);
      else next = f.updateDoStatement(next, body, next.expression);
    }
    return next;
  };
  return () => f.createObjectLiteralExpression(methods.map(node =>
    f.updateMethodDeclaration(node, [f.createModifier(ts.SyntaxKind.AsyncKeyword)], node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type,
      ts.visitNode(node.body, visit))), true);
}]);
const print = node => ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printNode(ts.EmitHint.Unspecified, node, pagination.source);

// One closed scope per upstream module keeps same-named private constants apart.
const identifier = file => file.replace(/\.js$/, '').replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
const link = (local, { file, name }) => {
  const module = modules.get(file);
  // Scopes are plain objects, so the type check below cannot see a missing member.
  if (!module?.needed.has(name) || !module.statements.has(module.declared.get(name))) throw new Error(`The cooperative adapter does not include ${name} from ${file}.`);
  return `const ${local} = ${identifier(file)}.${name};`;
};
const body = module => [
  ...[...edges.get(module.file) ?? []].map(([local, origin]) => link(local, origin)),
  ...module.source.statements.filter(statement => module.statements.has(statement)).map(statement => statement.getText(module.source).replace(/^export /, '')),
].join('\n');
const emitted = new Set(), scopes = [];
function emit(file, trail = []) {
  if (emitted.has(file) || file === 'pagination.js') return;
  if (trail.includes(file)) throw new Error(`Review the import cycle ${[...trail, file].join(' -> ')}.`);
  for (const origin of edges.get(file)?.values() ?? []) emit(origin.file, [...trail, file]);
  emitted.add(file);
  const module = modules.get(file);
  scopes.push(`// docxodus/dist/${file}\nconst ${identifier(file)} = (() => {\n${body(module)}\nreturn { ${[...module.needed].filter(name => module.declared.has(name)).sort().join(', ')} };\n})();`);
}
for (const module of modules.values()) if (module.statements.size) emit(module.file);

const license = await readFile(new URL('../LICENSE', dist), 'utf8');
const output = `/*!\n${license.trim()}\n*/\n// Generated by scripts/generate-cooperative-pagination.mjs. Do not edit.
// Docxodus ${version} sources (SHA-256):\n${Object.entries(digests).map(([file, hash]) => `//   ${file} ${hash}`).join('\n')}
// Only async calls and cooperative loop checkpoints differ from upstream.
import { ${[...coreImports].sort().join(', ')} } from 'docxodus/core';
${scopes.join('\n')}\n// docxodus/dist/pagination.js\n${body(pagination)}
export { ${Object.values(exposed).flat().join(', ')} };
export function createCooperativePagination(engine, checkpoint) {\nconst cooperative = ${print(adapted.transformed[0])};\nfor (const name of Object.keys(cooperative)) cooperative[name] = cooperative[name].bind(engine);\nreturn cooperative;\n}\n`;
adapted.dispose();

// A helper missing from the closure would only fail on the documents that reach
// it. Resolve every identifier now, against the DOM library and core's exports.
const path = fileURLToPath(target);
const options = { allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [] };
const host = ts.createCompilerHost(options);
const { getSourceFile, fileExists, readFile: readHost } = host;
host.getSourceFile = (name, ...rest) => name === path ? ts.createSourceFile(name, output, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS) : getSourceFile.call(host, name, ...rest);
host.fileExists = name => name === path || fileExists.call(host, name);
host.readFile = name => name === path ? output : readHost.call(host, name);
const program = ts.createProgram([path], options, host);
const generated = program.getSourceFile(path);
const unresolved = [...program.getSyntacticDiagnostics(generated),
  // Cannot find name (and its spelling/library variants), missing module or export, missing shorthand
  // value, and duplicate declarations.
  ...program.getSemanticDiagnostics(generated).filter(({ code }) => [2304, 2305, 2307, 2503, 2552, 2580, 2584, 2592, 2614, 2693, 2724, 18004, 2300, 2451].includes(code))];
if (unresolved.length) throw new Error(`The cooperative adapter has unresolved names:\n${unresolved.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n')).join('\n')}`);

if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== output) throw new Error('Regenerate the cooperative pagination adapter.');
} else await writeFile(target, output);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${path}`);
