/**
 * Page media scanner.
 *
 * This function is serialized by `chrome.scripting.executeScript`, so it must
 * stay self-contained: no imports, module constants, or outer helpers.
 */

import type { OneShotMediaCandidate, PageScanResult } from '../shared/extension-runtime';

export function scanPageForMedia(): PageScanResult {
  const MIN_DIMENSION = 128;
  const MAX_CANDIDATES = 300;
  const candidates: OneShotMediaCandidate[] = [];
  const seen = new Set<string>();
  let totalFound = 0;
  let skippedSmall = 0;
  let skippedSvg = 0;
  let capped = 0;

  const pageUrl = location.href;
  const baseUrl = document.baseURI || pageUrl;

  const resolve = (raw: string): string => {
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return '';
    }
  };

  const isSvg = (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.startsWith('data:image/svg+xml') || /\.svg(?:[?#]|$)/i.test(lower);
  };

  const add = (candidate: OneShotMediaCandidate): void => {
    if (!candidate.url || seen.has(candidate.url)) return;
    seen.add(candidate.url);
    candidates.push(candidate);
  };

  const largestFromSrcset = (srcset: string): string => {
    if (!srcset) return '';
    let best = '';
    let bestWidth = -1;
    for (const entry of srcset.split(',')) {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      if (!url) continue;
      const descriptor = parts[1] || '';
      const width = descriptor.endsWith('w') ? Number.parseInt(descriptor, 10) : 0;
      if (width >= bestWidth) {
        bestWidth = width;
        best = url;
      }
    }
    return best;
  };

  // <img> and <picture> (currentSrc already reflects the chosen source).
  for (const img of Array.from(document.images)) {
    const raw = img.currentSrc || largestFromSrcset(img.getAttribute('srcset') || '') || img.src;
    if (!raw) continue;
    totalFound += 1;
    const url = resolve(raw);
    if (!url) continue;
    if (isSvg(url)) {
      skippedSvg += 1;
      continue;
    }
    const width = img.naturalWidth > 0 ? img.naturalWidth : undefined;
    const height = img.naturalHeight > 0 ? img.naturalHeight : undefined;
    if (
      (width !== undefined && width < MIN_DIMENSION) ||
      (height !== undefined && height < MIN_DIMENSION)
    ) {
      skippedSmall += 1;
      continue;
    }
    add({
      id: `img:${url}`,
      kind: 'img',
      url,
      pageUrl,
      width,
      height,
      label: img.alt || undefined,
    });
  }

  // CSS background images.
  const elements = Array.from(document.querySelectorAll<HTMLElement>('*'));
  for (const element of elements) {
    const background = getComputedStyle(element).backgroundImage;
    if (!background || background === 'none' || !background.includes('url(')) continue;

    const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(background)) !== null) {
      const raw = match[2];
      if (!raw) continue;
      totalFound += 1;
      const url = resolve(raw);
      if (!url) continue;
      if (isSvg(url)) {
        skippedSvg += 1;
        continue;
      }
      add({
        id: `background:${url}`,
        kind: 'background',
        url,
        pageUrl,
        label: element.getAttribute('aria-label') || undefined,
      });
    }
  }

  // Video posters (direct video sources remain out of scope).
  for (const video of Array.from(document.querySelectorAll('video'))) {
    const raw = video.poster;
    if (!raw) continue;
    totalFound += 1;
    const url = resolve(raw);
    if (!url) continue;
    if (isSvg(url)) {
      skippedSvg += 1;
      continue;
    }
    add({
      id: `poster:${url}`,
      kind: 'poster',
      url,
      pageUrl,
      label: video.getAttribute('title') || undefined,
    });
  }

  const sorted = candidates.sort((a, b) => {
    const areaA = (a.width ?? 0) * (a.height ?? 0);
    const areaB = (b.width ?? 0) * (b.height ?? 0);
    return areaB - areaA;
  });
  const kept = sorted.slice(0, MAX_CANDIDATES);
  capped = sorted.length - kept.length;

  return {
    candidates: kept,
    totalFound,
    skippedSmall,
    skippedSvg,
    skippedIframes: document.querySelectorAll('iframe').length,
    capped,
  };
}
