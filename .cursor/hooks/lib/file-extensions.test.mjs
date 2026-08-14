import { describe, expect, it } from 'vitest';
import {
  FORMAT_EXTENSIONS,
  hasExtension,
  OXLINT_EXTENSIONS,
  TYPECHECK_EXTENSIONS,
} from './file-extensions.mjs';

describe('file-extensions', () => {
  it('includes html and css families in format targets', () => {
    expect(hasExtension('src/App.tsx', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('index.html', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('styles/main.scss', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('README.md', FORMAT_EXTENSIONS)).toBe(true);
  });

  it('includes data families in format targets', () => {
    expect(hasExtension('config.yaml', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('schema.graphql', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('pyproject.toml', FORMAT_EXTENSIONS)).toBe(true);
  });

  it('uses oxlint only for js/ts families', () => {
    expect(hasExtension('src/App.tsx', OXLINT_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.mts', OXLINT_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.cts', OXLINT_EXTENSIONS)).toBe(true);
    expect(hasExtension('index.html', OXLINT_EXTENSIONS)).toBe(false);
    expect(hasExtension('styles/main.css', OXLINT_EXTENSIONS)).toBe(false);
  });

  it('typechecks all js/ts families', () => {
    expect(hasExtension('src/App.ts', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('src/App.tsx', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.mjs', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.cjs', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.mts', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('lib/util.cts', TYPECHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('index.html', TYPECHECK_EXTENSIONS)).toBe(false);
  });
});
