/**
 * AI Classify - UI Utility Functions
 */

/**
 * Truncate string to specified length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format timestamp to locale string
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return Math.round(confidence * 100) + '%';
}

/**
 * Create confidence progress bar string
 */
export function confidenceBar(confidence: number, width: number = 20): string {
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format task status line
 */
export function formatTaskStatus(
  status: 'pending' | 'processing' | 'completed' | 'failed'
): string {
  const statusMap = {
    pending: '○ 等待中',
    processing: '◉ 分类中...',
    completed: '✓ 已完成',
    failed: '✗ 失败',
  };
  return statusMap[status];
}

/**
 * Pad string to fixed width (for alignment)
 */
export function padRight(str: string, width: number): string {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Create simple spinner frames
 */
export const SPINNER_FRAMES = ['◐', '◑', '◒', '◓', '○', '●'];

/**
 * Get next spinner frame
 */
export function nextSpinnerFrame(index: number): string {
  return SPINNER_FRAMES[index % SPINNER_FRAMES.length];
}
