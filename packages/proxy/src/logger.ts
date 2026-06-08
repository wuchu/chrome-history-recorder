import pino, { Logger } from 'pino';
import { Request, Response, NextFunction } from 'express';

// 日志级别优先级
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

interface LogEntry {
  level: string;
  timestamp: string;
  message: string;
  context: Record<string, unknown>;
}

// 内存日志缓存（环形队列）
class LogBuffer {
  private maxSize: number;
  private buffer: LogEntry[];
  private index: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.index = 0;
  }

  push(log: LogEntry) {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(log);
    } else {
      this.buffer[this.index] = log;
      this.index = (this.index + 1) % this.maxSize;
    }
  }

  getAll(limit: number | null = null): LogEntry[] {
    if (limit) {
      return this.buffer.slice(-limit);
    }
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
    this.index = 0;
  }
}

// 创建 pino logger
const createLogger = (level = 'INFO'): Logger => {
  const isDebugMode = process.env.DEBUG_MODE === 'true';

  return pino({
    level: level.toLowerCase(),
    transport: isDebugMode
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
};

// 日志管理器
class LogManager {
  public logger: Logger;
  private buffer: LogBuffer;
  private isDebugMode: boolean;

  constructor() {
    const level = process.env.LOG_LEVEL || 'INFO';
    this.logger = createLogger(level);
    this.buffer = new LogBuffer(100);
    this.isDebugMode = process.env.DEBUG_MODE === 'true';

    // 包装 logger 方法，同时写入缓存
    this.wrapLogger();
  }

  wrapLogger() {
    const original = {
      debug: this.logger.debug.bind(this.logger),
      info: this.logger.info.bind(this.logger),
      warn: this.logger.warn.bind(this.logger),
      error: this.logger.error.bind(this.logger),
    };

    for (const level of LOG_LEVELS) {
      const levelKey = level.toLowerCase();
      // Cast to unknown first to avoid type error
      (
        this.logger as unknown as Record<
          string,
          (msg: string, context?: Record<string, unknown>) => void
        >
      )[levelKey] = (msg: string, context: Record<string, unknown> = {}) => {
        const logEntry: LogEntry = {
          level,
          timestamp: new Date().toISOString(),
          message: msg,
          context,
        };

        this.buffer.push(logEntry);
        original[levelKey](context, msg);
      };
    }
  }

  getLogs(limit: number | null = null): LogEntry[] {
    return this.buffer.getAll(limit);
  }

  clearLogs() {
    this.buffer.clear();
  }

  isDebugEnabled(): boolean {
    return this.isDebugMode;
  }
}

// 导出单例
const logManager = new LogManager();

export const logger = logManager.logger;
export const getLogs = logManager.getLogs.bind(logManager);
export const clearLogs = logManager.clearLogs.bind(logManager);
export const isDebugEnabled = logManager.isDebugEnabled.bind(logManager);

// 请求日志中间件
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // 记录请求
  logger.info(`Request started: ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
  });

  // 记录响应
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`Request completed: ${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}

export default logManager;
