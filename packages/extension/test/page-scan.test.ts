// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanPageForMedia } from '../src/background/page-scan';

function addImage(options: {
  src: string;
  currentSrc?: string;
  srcset?: string;
  width?: number;
  height?: number;
  alt?: string;
}): HTMLImageElement {
  const img = document.createElement('img');
  img.src = options.src;
  img.alt = options.alt ?? '';
  if (options.srcset) img.setAttribute('srcset', options.srcset);
  Object.defineProperty(img, 'currentSrc', {
    configurable: true,
    value: options.currentSrc ?? img.src,
  });
  Object.defineProperty(img, 'naturalWidth', {
    configurable: true,
    value: options.width ?? 800,
  });
  Object.defineProperty(img, 'naturalHeight', {
    configurable: true,
    value: options.height ?? 600,
  });
  document.body.appendChild(img);
  return img;
}

describe('scanPageForMedia', () => {
  beforeEach(() => {
    document.head.innerHTML = '<base href="https://example.com/gallery/">';
    document.body.innerHTML = '';
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = (element as HTMLElement).style;
      return { backgroundImage: style?.backgroundImage || 'none' } as CSSStyleDeclaration;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('collects images, backgrounds, posters, and srcset fallbacks', () => {
    addImage({ src: '/large.jpg', width: 800, height: 600, alt: 'large' });
    addImage({
      src: '',
      currentSrc: '',
      srcset: 'small.jpg 100w, hero@2x.jpg 1600w',
      width: 1200,
      height: 800,
    });

    const background = document.createElement('div');
    background.style.backgroundImage = 'url("https://cdn.example.com/hero.jpg")';
    document.body.appendChild(background);

    const video = document.createElement('video');
    video.poster = 'https://cdn.example.com/poster.jpg';
    document.body.appendChild(video);

    const result = scanPageForMedia();
    const urls = result.candidates.map((candidate) => candidate.url);

    expect(urls).toContain('https://example.com/large.jpg');
    expect(urls).toContain('https://example.com/gallery/hero@2x.jpg');
    expect(urls).toContain('https://cdn.example.com/hero.jpg');
    expect(urls).toContain('https://cdn.example.com/poster.jpg');
    expect(result.candidates.some((candidate) => candidate.kind === 'background')).toBe(true);
    expect(result.candidates.some((candidate) => candidate.kind === 'poster')).toBe(true);
  });

  it('skips small images and SVG icons', () => {
    addImage({ src: '/tiny.png', width: 64, height: 64 });
    addImage({ src: '/icon.svg', width: 512, height: 512 });

    const result = scanPageForMedia();

    expect(result.candidates).toHaveLength(0);
    expect(result.skippedSmall).toBe(1);
    expect(result.skippedSvg).toBe(1);
  });

  it('deduplicates URLs', () => {
    addImage({ src: '/same.jpg', width: 800, height: 600 });
    addImage({ src: '/same.jpg', width: 800, height: 600 });

    const result = scanPageForMedia();

    expect(result.candidates).toHaveLength(1);
    expect(result.totalFound).toBe(2);
  });

  it('reports cross-origin iframes and caps the candidate list', () => {
    for (let index = 0; index < 305; index += 1) {
      addImage({ src: `/image-${index}.jpg`, width: 800, height: 600 });
    }
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    const result = scanPageForMedia();

    expect(result.candidates).toHaveLength(300);
    expect(result.capped).toBe(5);
    expect(result.skippedIframes).toBe(1);
  });
});
