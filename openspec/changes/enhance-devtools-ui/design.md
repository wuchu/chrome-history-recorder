# DevTools UI Enhancement Design

## Overview

DevTools UI 升级包含三个主要部分：
1. **Proxy 增强** - 缩略图生成 API + WebSocket 服务
2. **Extension 改造** - 缩略图网格 UI + WebSocket 客户端 + 实时状态

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Enhanced DevTools UI                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │                           Proxy Server                                    │ │
│   │                                                                           │ │
│   │   NEW APIs:                                                               │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │ GET /images/:hash/thumbnail?size=100                                 ││ │
│   │   │     → 返回缩略图（sharp/ffmpeg 生成）                                  ││ │
│   │   │     → 缓存到 .thumbnails/ 目录                                        ││ │
│   │   │                                                                       ││ │
│   │   │ GET /images?includeThumbnails=true                                   ││ │
│   │   │     → 返回列表包含 thumbnailUrl 字段                                  ││ │
│   │   │                                                                       ││ │
│   │   │ GET /images/search?q=cat&type=image&date=today                       ││ │
│   │   │     → 搜索过滤 API                                                    ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   │   WebSocket Server:                                                       │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │ ws://localhost:3777/events                                            ││ │
│   │   │     → 推送 file:captured 事件                                         ││ │
│   │   │     → 推送 classify:started/complete/failed 事件                     ││ │
│   │   │     → 支持订阅过滤                                                    ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                         │
│                                      │ WebSocket + HTTP                        │
│                                      ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐ │
│   │                         DevTools Panel                                    │ │
│   │                                                                           │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │  状态栏                                                               ││ │
│   │   │  ● Proxy:在线  ● AI:运行中  [开始捕获]                                ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │  实时捕获流                                                今日 156   ││ │
│   │   │  ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐                                ││ │
│   │   │  │ 🖼 ││ 🖼 ││ 🎬 ││ 🖼 ││ 🖼 │  ← 缩略图                           ││ │
│   │   │  │ ✓  ││ ◉  ││ ○  ││ ✓  ││ ✓  │  ← 分类状态                        ││ │
│   │   │  └─────┘└─────┘└─────┘└─────┘└─────┘                                ││ │
│   │   │  [查看更多历史...]                                                    ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │  历史分类结果                            过滤: [分类▼] [类型▼] [搜索] ││ │
│   │   │                                                                       ││ │
│   │   │  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐           ││ │
│   │   │  │ 缩略图   ││ 缩略图   ││ 缩略图   ││ 缩略图   ││ 缩略图   │           ││ │
│   │   │  ├─────────┤├─────────┤├─────────┤├─────────┤├─────────┤           ││ │
│   │   │  │慵懒猫咪  ││活泼小狗  ││美味午餐  ││户外运动  ││夕阳海滩  │           ││ │
│   │   │  │cat·92% ││dog·88% ││food·95%││person  ││photo   │           ││ │
│   │   │  └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘           ││ │
│   │   │                                                                       ││ │
│   │   │  [加载更多...]                                                        ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   │   ┌─────────────────────────────────────────────────────────────────────┐│ │
│   │   │  [配置] ▼                                                            ││ │
│   │   └─────────────────────────────────────────────────────────────────────┘│ │
│   │                                                                           │ │
│   └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Proxy Thumbnail API

```typescript
// proxy/src/routes/thumbnail.ts

import sharp from 'sharp';
import { execAsync } from '../utils/exec.js';
import fs from 'fs-extra';
import path from 'path';

const THUMBNAIL_DIR = '.thumbnails';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export async function getThumbnail(req: Request, res: Response) {
  const { hash } = req.params;
  const size = parseInt(req.query.size as string) || 100;
  
  // 限制最大尺寸
  const maxSize = Math.min(size, 800);
  
  // 检查缓存
  const cachePath = path.join(storagePath, THUMBNAIL_DIR, `${hash}_${maxSize}.webp`);
  if (await fs.exists(cachePath)) {
    const stat = await fs.stat(cachePath);
    // 缓存未过期
    if (Date.now() - stat.mtimeMs < CACHE_EXPIRY) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(cachePath).pipe(res);
    }
  }
  
  // 找到原始文件
  const originalFile = await findFileByHash(hash);
  if (!originalFile) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // 生成缩略图
  let thumbnailBuffer: Buffer;
  
  if (isImage(originalFile.mimeType)) {
    // 图片：使用 sharp
    thumbnailBuffer = await sharp(originalFile.path)
      .resize(maxSize, maxSize, { fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();
  } else if (isVideo(originalFile.mimeType)) {
    // 视频：使用 ffmpeg 提取第一帧
    const framePath = `/tmp/${hash}_frame.png`;
    await execAsync(`ffmpeg -i "${originalFile.path}" -vf "scale=${maxSize}:-1" -frames:v 1 -y "${framePath}"`);
    
    thumbnailBuffer = await sharp(framePath)
      .webp({ quality: 80 })
      .toBuffer();
    
    await fs.unlink(framePath);
  } else {
    return res.status(400).json({ error: 'Unsupported media type' });
  }
  
  // 缓存缩略图
  await fs.ensureDir(path.dirname(cachePath));
  await fs.writeFile(cachePath, thumbnailBuffer);
  
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('ETag', `${hash}_${maxSize}`);
  res.send(thumbnailBuffer);
}
```

## Proxy WebSocket Server

```typescript
// proxy/src/websocket/server.ts

import WebSocket from 'ws';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket>;
  
  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ server, path: '/events' });
    this.clients = new Set();
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      
      // 发送服务启动事件
      this.sendToClient(ws, {
        event: 'service:started',
        data: { version: VERSION, plugins: getPluginNames() },
        timestamp: new Date().toISOString(),
      });
      
      // 心跳
      const heartbeatInterval = setInterval(() => {
        this.sendToClient(ws, { event: 'heartbeat' });
      }, 30000);
      
      ws.on('close', () => {
        this.clients.delete(ws);
        clearInterval(heartbeatInterval);
      });
      
      // 处理订阅消息
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.action === 'subscribe') {
            ws.subscribedEvents = msg.events;
          }
        } catch {
          // 忽略无效消息
        }
      });
    });
  }
  
  broadcast(event: string, data: unknown): void {
    const message = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    
    for (const client of this.clients) {
      // 检查订阅过滤
      if (client.subscribedEvents && !client.subscribedEvents.includes(event)) {
        continue;
      }
      
      this.sendToClient(client, message);
    }
  }
  
  private sendToClient(ws: WebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
```

## Extension WebSocket Client

```typescript
// extension/src/hooks/useWebSocket.ts

import { useEffect, useRef, useState } from 'react';

export function useWebSocket(endpoint: string) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const connect = () => {
      const wsUrl = endpoint.replace('http', 'ws') + '/events';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setConnected(true);
        
        // 订阅事件
        ws.send(JSON.stringify({
          action: 'subscribe',
          events: ['file:captured', 'classify:started', 'classify:complete', 'classify:failed'],
        }));
      };
      
      ws.onclose = () => {
        setConnected(false);
        // 5秒后重连
        setTimeout(connect, 5000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event !== 'heartbeat') {
            setEvents(prev => [...prev.slice(-50), data]);
          }
        } catch {
          // 忽略无效消息
        }
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      wsRef.current?.close();
    };
  }, [endpoint]);
  
  return { connected, events };
}
```

## Extension Grid Components

```typescript
// extension/src/components/MediaGrid.tsx

import { useState, useEffect } from 'react';
import styles from './MediaGrid.module.css';

interface MediaItemProps {
  hash: string;
  thumbnailUrl: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  category?: string;
  filename?: string;
  confidence?: number;
  size: number;
  mimeType: string;
  onClick: () => void;
}

function MediaItem({ hash, thumbnailUrl, status, category, filename, confidence, onClick }: MediaItemProps) {
  const statusIcon = {
    completed: '✓',
    processing: '◉',
    pending: '○',
    failed: '✗',
  }[status];
  
  const statusColor = {
    completed: styles.completed,
    processing: styles.processing,
    pending: styles.pending,
    failed: styles.failed,
  }[status];
  
  return (
    <div className={styles.mediaItem} onClick={onClick}>
      <img 
        src={thumbnailUrl} 
        alt={filename || hash}
        className={styles.thumbnail}
        loading="lazy"
      />
      <div className={`${styles.statusIcon} ${statusColor}`}>
        {statusIcon}
      </div>
      {filename && (
        <div className={styles.info}>
          <div className={styles.filename}>{truncate(filename, 15)}</div>
          {category && (
            <div className={styles.category}>
              {category} · {confidence && Math.round(confidence * 100)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaGrid({ items, onItemClick }: MediaGridProps) {
  return (
    <div className={styles.grid}>
      {items.map(item => (
        <MediaItem 
          key={item.hash}
          {...item}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  );
}
```

## Extension Detail Panel

```typescript
// extension/src/components/MediaDetail.tsx

import { useState } from 'react';
import styles from './MediaDetail.module.css';

export function MediaDetail({ item, onClose }: MediaDetailProps) {
  const [reprocessing, setReprocessing] = useState(false);
  
  const handleReprocess = async () => {
    setReprocessing(true);
    await fetch(`${proxyEndpoint}/classify/reprocess/${item.hash}`, { method: 'POST' });
    setReprocessing(false);
  };
  
  return (
    <div className={styles.panel}>
      <button className={styles.closeBtn} onClick={onClose}>×</button>
      
      <div className={styles.content}>
        <div className={styles.preview}>
          <img 
            src={`${proxyEndpoint}/images/${item.hash}?size=400`}
            alt={item.filename}
            className={styles.largeImage}
          />
        </div>
        
        <div className={styles.info}>
          <h3>分类结果</h3>
          <div className={styles.field}>
            <span className={styles.label}>Category:</span>
            <span className={styles.value}>{item.category}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Filename:</span>
            <span className={styles.value}>{item.filename}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Confidence:</span>
            <div className={styles.confidenceBar}>
              <div 
                className={styles.confidenceFill}
                style={{ width: `${item.confidence * 100}%` }}
              />
            </div>
          </div>
          
          <h3>文件信息</h3>
          <div className={styles.field}>
            <span className={styles.label}>Hash:</span>
            <span className={styles.value}>{item.hash}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Size:</span>
            <span className={styles.value}>{formatSize(item.size)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Type:</span>
            <span className={styles.value}>{item.mimeType}</span>
          </div>
          
          <h3>来源</h3>
          <div className={styles.field}>
            <a href={item.url} target="_blank">查看原页面</a>
          </div>
          
          {item.tags && (
            <div className={styles.tags}>
              {item.tags.map(tag => (
                <span key={tag} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.actions}>
        <button onClick={handleReprocess} disabled={reprocessing}>
          重新分类
        </button>
        <button onClick={() => deleteItem(item.hash)}>删除</button>
        <button onClick={() => copyFilename(item.filename)}>复制文件名</button>
      </div>
    </div>
  );
}
```

## File Structure

```
packages/proxy/src/
├── routes/
│   └── thumbnail.ts       # 缩略图 API（新增）
│   └── search.ts          # 搜索 API（新增）
│   └── websocket.ts       # WebSocket 路由（新增）
│
├── websocket/
│   ├── server.ts          # WebSocket 服务（新增）
│   └── events.ts          # 事件发射（新增）
│
└── utils/
    └── thumbnail-cache.ts # 缩略图缓存（新增）

packages/extension/src/entrypoints/devtools-panel/
├── components/
│   ├── MediaGrid.tsx      # 缩略图网格（新增）
│   ├── MediaGrid.module.css
│   ├── MediaDetail.tsx    # 详情面板（新增）
│   ├── MediaDetail.module.css
│   ├── CaptureStream.tsx  # 实时捕获流（新增）
│   ├── CaptureStream.module.css
│   ├── FilterBar.tsx      # 过滤条（新增）
│   ├── FilterBar.module.css
│   ├── StatusBar.tsx      # 状态栏（改造）
│   └── ConfigSection.tsx  # 配置面板（改造为可折叠）
│
├── hooks/
│   ├── useWebSocket.ts    # WebSocket 客户端（新增）
│   ├── useMediaList.ts    # 媒体列表（新增）
│   ├── useClassifyStatus.ts # 分类状态（新增）
│   └── useSearch.ts       # 搜索功能（新增）
│
└── App.tsx                # 主应用（改造）
```

## Dependencies to Add

Proxy:
```json
{
  "dependencies": {
    "ws": "^8.16.0",
    "sharp": "^0.33.2"
  }
}
```

Extension:
```json
{
  "dependencies": {
    // 无新增依赖，React 已有
  }
}
```