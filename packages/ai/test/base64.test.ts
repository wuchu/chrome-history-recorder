import { describe, expect, it } from 'vitest';
import { bytesToBase64Chunked, encodeBase64Async } from '../src/base64';

/** Reference implementation — whole-buffer encoding. */
function referenceBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fillDeterministic(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = (i * 131 + 7) % 256;
  }
  return bytes;
}

describe('bytesToBase64Chunked', () => {
  it.each([0, 1, 2, 3, 4, 24575, 24576, 24577])(
    'matches reference encoding for %i bytes',
    (length) => {
      const bytes = fillDeterministic(length);
      expect(bytesToBase64Chunked(bytes)).toBe(referenceBase64(bytes));
    }
  );

  it('matches reference encoding for a large multi-chunk buffer', () => {
    const bytes = fillDeterministic(300000);
    expect(bytesToBase64Chunked(bytes)).toBe(referenceBase64(bytes));
  });
});

describe('encodeBase64Async', () => {
  it('returns the same result as bytesToBase64Chunked for a small buffer', async () => {
    const bytes = fillDeterministic(1024);
    expect(await encodeBase64Async(bytes)).toBe(bytesToBase64Chunked(bytes));
  });

  it('yields to the event loop between chunks for a large buffer', async () => {
    const bytes = new Uint8Array(512 * 1024).fill(65);
    let macrotaskRan = false;
    const encodePromise = encodeBase64Async(bytes);
    setTimeout(() => {
      macrotaskRan = true;
    }, 0);
    const result = await encodePromise;
    expect(macrotaskRan).toBe(true);
    expect(result).toBe(referenceBase64(bytes));
  });
});
