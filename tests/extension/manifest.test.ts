import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('extension manifest', () => {
  it('keeps the Chrome extension version aligned with the package version', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      version?: string;
    };
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      version?: string;
    };

    expect(manifest.version).toBe(packageJson.version);
  });

  it('builds generated extension files before running tests that inspect dist', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: { test?: string };
    };

    expect(packageJson.scripts?.test).toMatch(/\bbuild\b/);
  });

  it('registers a toolbar popup for customization', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      action?: { default_popup?: string };
    };

    expect(manifest.action?.default_popup).toBe('popup/index.html');
  });

  it('emits a self-contained popup bundle that can access extension storage', () => {
    const popupScript = readFileSync('dist/popup/index.js', 'utf8');

    expect(popupScript).not.toMatch(/^\s*import\s.+from\s+['"]/m);
    expect(popupScript).not.toMatch(/^\s*export\s/m);
    expect(popupScript).toContain('chrome.storage.sync');
  });

  it('registers the Lichess paste importer content script and logo resource', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      host_permissions?: string[];
      content_scripts?: Array<{ matches?: string[]; js?: string[] }>;
      web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
    };

    expect(manifest.host_permissions).toContain('https://lichess.org/*');
    expect(manifest.content_scripts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        matches: ['https://lichess.org/paste*'],
        js: ['dist/content/lichessPasteImport.js']
      })
    ]));
    expect(manifest.web_accessible_resources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resources: expect.arrayContaining(['lichess-svgrepo-com.svg']),
        matches: expect.arrayContaining(['https://www.chess.com/*'])
      })
    ]));
  });

  it('does not expose the removed local test harness', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      host_permissions?: string[];
      content_scripts?: Array<{ matches?: string[]; js?: string[] }>;
      web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
    };
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.host_permissions ?? []).not.toEqual(expect.arrayContaining([
      'http://localhost/*',
      'http://127.0.0.1/*'
    ]));

    const contentMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const resourceMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(contentMatches).not.toEqual(expect.arrayContaining(['http://localhost/*', 'http://127.0.0.1/*']));
    expect(resourceMatches).not.toEqual(expect.arrayContaining(['http://localhost/*', 'http://127.0.0.1/*']));
    expect(packageJson.scripts).not.toHaveProperty('serve:test-site');
  });

  it('exposes the local Stockfish worker to Chess.com pages', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
    };

    expect(manifest.web_accessible_resources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resources: expect.arrayContaining(['vendor/stockfish/stockfish.js', 'vendor/stockfish/stockfish.wasm']),
        matches: expect.arrayContaining(['https://www.chess.com/*'])
      })
    ]));
  });

  it('emits content scripts without module imports for Chrome content script loading', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      content_scripts?: Array<{ js?: string[] }>;
    };
    const contentScriptPaths = manifest.content_scripts?.flatMap((script) => script.js ?? []) ?? [];

    expect(contentScriptPaths).not.toHaveLength(0);
    for (const scriptPath of contentScriptPaths) {
      const script = readFileSync(scriptPath, 'utf8');

      expect(script).not.toMatch(/^\s*import\s.+from\s+['"]/m);
      expect(script).not.toMatch(/^\s*export\s/m);
    }
  });

  it('does not let TypeScript emit over bundled content script outputs', () => {
    const buildConfig = JSON.parse(readFileSync('tsconfig.build.json', 'utf8')) as {
      include?: string[];
    };

    expect(buildConfig.include ?? []).not.toContain('src');
    expect(buildConfig.include ?? []).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^src\/content(?:\/|\*|$)/)
    ]));
  });
});
