import { describe, it, expect } from 'vitest';
import { hasBeenProcessed, addProcessedRecord } from '../src/hashIndex.js';
import type { HashIndex, IndexRecord } from '../src/types.js';

describe('hashIndex', () => {
  describe('hasBeenProcessed', () => {
    it('should return false for empty index', () => {
      const index: HashIndex = { processed: {} };
      expect(hasBeenProcessed(index, 'abc123')).toBe(false);
    });

    it('should return true for existing hash', () => {
      const record: IndexRecord = {
        outputPath: '/output/test.jpg',
        processedAt: new Date().toISOString(),
        category: 'photo',
        originalPath: '/input/test.jpg',
      };
      const index: HashIndex = { processed: { abc123: record } };

      expect(hasBeenProcessed(index, 'abc123')).toBe(true);
    });
  });

  describe('addProcessedRecord', () => {
    it('should add record to index', () => {
      const index: HashIndex = { processed: {} };
      const record: IndexRecord = {
        outputPath: '/output/test.jpg',
        processedAt: new Date().toISOString(),
        category: 'photo',
        originalPath: '/input/test.jpg',
      };

      const result = addProcessedRecord(index, 'abc123', record);

      expect(result.processed['abc123']).toEqual(record);
    });
  });
});
