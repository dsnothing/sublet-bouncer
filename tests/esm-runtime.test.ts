import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('loads separately emitted API modules in native Node ESM and serves offline analysis', () => {
  const root = mkdtempSync(join(tmpdir(), 'sublet-esm-'));
  try {
    // Match Vercel's per-file emission: no bundler or TS runtime to repair imports.
    function emit(dir: string) {
      mkdirSync(join(root, dir), { recursive: true });
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) emit(file);
        else if (file.endsWith('.ts')) {
          const result = ts.transpileModule(readFileSync(file, 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
          });
          writeFileSync(join(root, file.replace(/\.ts$/, '.js')), result.outputText);
        }
      }
    }
    emit('core');
    emit('api');
    cpSync('data', join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { createServer } from 'node:http';
      import { once } from 'node:events';
      import health from './api/health.js';
      import analyze from './api/analyze.js';
      const server = createServer((req, res) => req.url === '/health' ? health(req, res) : analyze(req, res));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const url = 'http://127.0.0.1:' + server.address().port;
        const health = await fetch(url + '/health');
        const result = await fetch(url + '/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
          listing:'Room at 203 Lester Street. Rent $850/month. Viewing available. Owner does not live here.',
          profile:{termStart:'2027-01-01',termEnd:'2027-04-30',campus:'UW',classStart:'08:30'}, mode:'offline'
        })});
        console.log(JSON.stringify({health:health.status, status:result.status, mode:(await result.json()).mode}));
      } finally { server.closeAllConnections(); server.close(); }
    `], { cwd: root, encoding: 'utf8', timeout: 15000 });
    expect(JSON.parse(output)).toEqual({ health: 200, status: 200, mode: 'offline' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
