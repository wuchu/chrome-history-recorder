import { describe, expect, it } from 'vitest';
import { getDecodableImageMimeTypes } from '../src/thumbnail';

describe('thumbnail decoder capabilities', () => {
  it('reports the formats the bundled decoder can read', () => {
    const mimeTypes = getDecodableImageMimeTypes();

    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff']) {
      expect(mimeTypes).toContain(mimeType);
    }
  });

  it('excludes formats the bundled build cannot decode', () => {
    const mimeTypes = getDecodableImageMimeTypes();

    expect(mimeTypes).not.toContain('image/x-icon');
    expect(mimeTypes).not.toContain('image/vnd.microsoft.icon');
    expect(mimeTypes).not.toContain('image/bmp');
  });

  it('returns a copy so callers cannot mutate the cache', () => {
    const first = getDecodableImageMimeTypes();
    first.push('image/x-icon');

    expect(getDecodableImageMimeTypes()).not.toContain('image/x-icon');
  });
});
