import { describe, expect, it } from 'vitest';
import {
  FORMAT_CHECK_EXTENSIONS,
  FORMAT_EXTENSIONS,
  hasExtension,
  OXLINT_EXTENSIONS,
} from './file-extensions.mjs';

describe('file-extensions', () => {
  it('includes html and css families in format targets', () => {
    expect(hasExtension('src/App.tsx', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('index.html', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('styles/main.scss', FORMAT_EXTENSIONS)).toBe(true);
    expect(hasExtension('README.md', FORMAT_EXTENSIONS)).toBe(true);
  });

  it('uses oxlint only for js/ts families', () => {
    expect(hasExtension('src/App.tsx', OXLINT_EXTENSIONS)).toBe(true);
    expect(hasExtension('index.html', OXLINT_EXTENSIONS)).toBe(false);
    expect(hasExtension('styles/main.css', OXLINT_EXTENSIONS)).toBe(false);
  });

  it('checks html and css families with oxfmt at stop', () => {
    expect(hasExtension('index.html', FORMAT_CHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('styles/main.less', FORMAT_CHECK_EXTENSIONS)).toBe(true);
    expect(hasExtension('src/App.tsx', FORMAT_CHECK_EXTENSIONS)).toBe(false);
  });
});
