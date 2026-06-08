/**
 * AI Classify - Result Card UI
 */

import boxen from 'boxen';
import { COLORS, ICONS } from './styles.js';
import { truncate, formatSize, confidenceBar, formatConfidence } from './utils.js';
import type { ClassificationResult } from '../types.js';

interface ResultData {
  sourcePath: string;
  hash: string;
  classification: ClassificationResult;
  outputPath: string;
  size: number;
  mimeType: string;
  url?: string;
}

/**
 * Display result card after classification
 */
export function displayResultCard(result: ResultData): void {
  const { sourcePath, hash, classification, outputPath, size, mimeType, url } = result;

  const lines: string[] = [];

  lines.push(COLORS.success.bold('  RESULT'));
  lines.push('');

  // Source
  lines.push(COLORS.muted('  Source'));
  lines.push(`  ${truncate(sourcePath, 50)}`);
  lines.push('');

  // Classification result
  lines.push(COLORS.muted('  Classification'));
  lines.push(`  Category:     ${COLORS.highlight(classification.category)}`);
  lines.push(`  Filename:     ${COLORS.highlight(classification.suggestedName)}`);

  // Confidence bar
  const confidenceDisplay =
    confidenceBar(classification.confidence, 20) +
    '  ' +
    formatConfidence(classification.confidence);
  const confidenceColor =
    classification.confidence >= 0.9
      ? COLORS.success(confidenceDisplay)
      : classification.confidence >= 0.7
        ? COLORS.warning(confidenceDisplay)
        : COLORS.error(confidenceDisplay);

  lines.push(`  Confidence:   ${confidenceColor}`);
  lines.push('');

  // Output
  lines.push(COLORS.muted('  Output'));
  lines.push(`  ${truncate(outputPath, 50)}`);
  lines.push('');

  // Tags
  if (classification.tags && classification.tags.length > 0) {
    lines.push(COLORS.muted('  Tags'));
    const tagsDisplay = classification.tags.map((t) => COLORS.info(`#${t}`)).join(' ');
    lines.push(`  ${tagsDisplay}`);
    lines.push('');
  }

  // File info
  lines.push(COLORS.muted('  File Info'));
  lines.push(`  Hash: ${hash}`);
  lines.push(`  Size: ${formatSize(size)}`);
  lines.push(`  Type: ${mimeType}`);

  if (url) {
    lines.push('');
    lines.push(COLORS.muted('  Source URL'));
    lines.push(`  ${truncate(url, 50)}`);
  }

  // Determine border color based on confidence
  const borderColor =
    classification.confidence >= 0.9
      ? 'green'
      : classification.confidence >= 0.7
        ? 'yellow'
        : 'red';

  const card = boxen(lines.join('\n'), {
    borderStyle: 'round',
    padding: 1,
    borderColor,
  });

  console.log('');
  console.log(card);
  console.log('');
}

/**
 * Display batch result summary
 */
export function displayBatchSummary(results: ResultData[]): void {
  const successCount = results.filter((r) => r.classification.confidence >= 0.7).length;
  const lowConfidenceCount = results.filter((r) => r.classification.confidence < 0.7).length;
  const failedCount = results.filter((r) => !r.classification).length;

  const lines: string[] = [];

  lines.push(COLORS.info.bold('  Batch Summary'));
  lines.push('');

  lines.push(`  ${ICONS.success}  High Confidence  ${COLORS.success(String(successCount))}`);
  lines.push(`  ${ICONS.warning}  Low Confidence   ${COLORS.warning(String(lowConfidenceCount))}`);
  lines.push(`  ${ICONS.error}  Failed          ${COLORS.error(String(failedCount))}`);
  lines.push('');

  // Total stats
  const totalSize = results.reduce((sum, r) => sum + r.size, 0);
  const avgConfidence =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.classification.confidence, 0) / results.length
      : 0;

  lines.push(COLORS.muted('  Statistics'));
  lines.push(`  Total processed:  ${results.length}`);
  lines.push(`  Total size:       ${formatSize(totalSize)}`);
  lines.push(`  Avg confidence:   ${formatConfidence(avgConfidence)}`);

  const summary = boxen(lines.join('\n'), {
    borderStyle: 'round',
    padding: 1,
    borderColor: 'blue',
  });

  console.log(summary);
}

/**
 * Display simple result line (for quiet mode)
 */
export function displayResultLine(result: ResultData): void {
  const filename = truncate(result.classification.suggestedName, 30);
  const confidence = formatConfidence(result.classification.confidence);
  const category = result.classification.category;

  console.log(
    COLORS.success(`${ICONS.success} `) +
      COLORS.muted(result.hash) +
      ' → ' +
      COLORS.highlight(`${category}/${filename}`) +
      ' ' +
      COLORS.muted(`(${confidence})`)
  );
}
