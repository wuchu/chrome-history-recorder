/**
 * 默认值常量 - 提取到模块级别避免每次渲染创建新对象
 * 规则: rerender-memo-with-default-value
 */
export const DEFAULT_VIDEO_TYPES = {
  mp4: true,
  webm: true,
  mov: false,
  avi: false,
} as const;
export const DEFAULT_MIN_IMAGE_SIZE_KB = 10;
export const DEFAULT_MIN_VIDEO_SIZE_MB = 1;
