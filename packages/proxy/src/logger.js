import pino from 'pino';

// 日志级别优先级
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// 内存日志缓存（环形队列）
class LogBuffer {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.index = 0;
  }

  push(log) {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(log);
    } else {
      this.buffer[this.index] = log;
      this.index = (this.index + 1) % this.maxSize;
    }
  }

  getAll(limit = null) {
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
const createLogger = (level = 'INFO') => {
  const isDebugMode = process.env.DEBUG_MODE === 'true';

  return pino({
    level: level.toLowerCase(),
    transport: isDebugMode ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    } : undefined
  });
};

// 日志管理器
class LogManager {
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
      error: this.logger.error.bind(this.logger)
    };

    for (const level of LOG_LEVELS) {
      this.logger[level.toLowerCase()] = (msg, context = {}) => {
        const logEntry = {
          level,
          timestamp: new Date().toISOString(),
          message: msg,
          context
        };

        this.buffer.push(logEntry);
        original[level.toLowerCase()](context, msg);
      };
    }
  }

  getLogs(limit = null) {
    return this.buffer.getAll(limit);
  }

  clearLogs() {
    this.buffer.clear();
  }

  isDebugEnabled() {
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
export function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // 记录请求
  logger.info(`Request started: ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query
  });

  // 记录响应
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`Request completed: ${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration
    });
  });

  next();
}

export default logManager;// test comment
