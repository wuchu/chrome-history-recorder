import express, { Router, Request, Response } from 'express';
import { getLogs, logger, isDebugEnabled } from '../logger.js';

const router: Router = express.Router();

// 重启状态追踪
let restartCount = 0;
let lastRestart = new Date().toISOString();
let restartReason = 'initial-start';

// 更新重启状态
export function updateRestartStatus(reason: string): void {
  restartCount++;
  lastRestart = new Date().toISOString();
  restartReason = reason;
  logger.info(`Restart triggered: ${reason}`, { restartCount, lastRestart });
}

// 获取调试状态
export function getDebugStatus(): {
  mode: string;
  uptime: number;
  restartCount: number;
  lastRestart: string;
  restartReason: string;
} {
  return {
    mode: isDebugEnabled() ? 'debug' : 'production',
    uptime: Math.floor(process.uptime()),
    restartCount,
    lastRestart,
    restartReason,
  };
}

// /debug/status - 服务状态端点
router.get('/status', (req: Request, res: Response) => {
  if (!isDebugEnabled()) {
    return res.status(404).json({ error: 'Debug mode not enabled' });
  }

  res.json({
    ...getDebugStatus(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
  });
});

// /debug/logs - 日志端点
router.get('/logs', (req: Request, res: Response) => {
  if (!isDebugEnabled()) {
    return res.status(404).json({ error: 'Debug mode not enabled' });
  }

  const limitParam = req.query.limit;
  const limit = limitParam ? parseInt(limitParam as string, 10) : null;
  const logs = getLogs(limit);

  res.json({
    total: logs.length,
    logs,
  });
});

// /debug/restart - 手动重启端点
router.post('/restart', (req: Request, res: Response) => {
  if (!isDebugEnabled()) {
    return res.status(404).json({ error: 'Debug mode not enabled' });
  }

  logger.info('Manual restart triggered via /debug/restart');

  res.json({
    message: 'Restart triggered',
    reason: 'manual',
  });

  // 设置延迟后退出，允许响应发送
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

export default router;
