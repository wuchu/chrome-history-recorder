<template>
  <div class="image-recorder-panel">
    <!-- Status indicators -->
    <div class="status-bar">
      <div class="service-status">
        <div :class="['status-dot', serviceOnline ? 'online' : 'offline']"></div>
        <span>{{ serviceOnline ? '服务已连接' : '服务离线' }}</span>
      </div>
      <div class="capture-status">
        <button @click="toggleCapture" :class="{ active: isCapturing }" :disabled="!serviceOnline">
          {{ isCapturing ? '停止捕获' : '开始捕获' }}
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats-section">
      <div class="stat-item">
        <span class="label">已捕获:</span>
        <span class="value">{{ captureCount }}</span>
      </div>
      <div class="stat-item">
        <span class="label">跳过SVG:</span>
        <span class="value">{{ skippedSvgCount }}</span>
      </div>
      <div class="stat-item">
        <span class="label">失败:</span>
        <span class="value failed">{{ failedCount }}</span>
      </div>
      <div class="stat-item">
        <span class="label">总大小:</span>
        <span class="value">{{ formatSize(totalSize) }}</span>
      </div>
    </div>

    <!-- Image list -->
    <div class="image-list-header">
      <span>捕获的图片 ({{ images.length }})</span>
      <button v-if="images.length > 0" @click="clearImages" class="clear-btn">清空列表</button>
    </div>
    <div class="image-list">
      <div v-for="image in images" :key="image.url" class="image-item">
        <div class="image-info">
          <div class="image-url" :title="image.url">{{ truncateUrl(image.url) }}</div>
          <div class="image-meta">
            <span>{{ formatSize(image.size) }}</span>
            <span class="separator">|</span>
            <span>{{ image.mimeType }}</span>
            <span v-if="image.request?.filename" class="separator">|</span>
            <span v-if="image.request?.filename" class="filename">{{ image.request.filename }}</span>
          </div>
        </div>
        <div class="image-status success">✓</div>
      </div>
      <div v-if="images.length === 0" class="no-images">
        <p>暂无捕获的图片</p>
        <p>点击"开始捕获"按钮开始监听网络请求</p>
      </div>
    </div>

    <!-- Configuration -->
    <div class="config-section">
      <h3>配置选项</h3>
      <div class="config-item">
        <label>存储路径:</label>
        <input v-model="storagePath" type="text" placeholder="~/Downloads/chrome-history">
        <button @click="saveStoragePath" :disabled="!serviceOnline">保存</button>
      </div>
      <div class="config-item">
        <label>代理端点:</label>
        <input v-model="proxyEndpoint" type="text" placeholder="http://localhost:3777">
        <button @click="saveProxyEndpoint">应用</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { NetworkListener, type ImageRequest } from '../../utils/networkListener';

const serviceOnline = ref(false);
const isCapturing = ref(false);
const captureCount = ref(0);
const skippedSvgCount = ref(0);
const failedCount = ref(0);
const totalSize = ref(0);
const images = ref<ImageRequest[]>([]);
const storagePath = ref('~/Downloads/chrome-history');
const proxyEndpoint = ref('http://localhost:3777');

let currentTabId: number | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let statsUpdateInterval: ReturnType<typeof setInterval> | null = null;
let networkListener: NetworkListener | null = null;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const truncateUrl = (url: string) => {
  return url.length > 50 ? url.substring(0, 50) + '...' : url;
};

const checkServiceHealth = async () => {
  try {
    const response = await fetch(`${proxyEndpoint.value}/health`);
    serviceOnline.value = response.ok;
  } catch (error) {
    serviceOnline.value = false;
  }
};

const updateStats = () => {
  if (!networkListener) return;

  const stats = networkListener.getStats();
  captureCount.value = stats.capturedCount;
  skippedSvgCount.value = stats.skippedSvgCount;
  failedCount.value = stats.failedCount;
  totalSize.value = stats.totalSize;
  images.value = networkListener.getCapturedImages();
};

const toggleCapture = async () => {
  if (!networkListener) return;

  isCapturing.value = !isCapturing.value;

  if (isCapturing.value) {
    networkListener.startListening();
    console.log('Started capturing images');
  } else {
    networkListener.stopListening();
    console.log('Stopped capturing images');
  }

  // Notify background script about state change
  if (currentTabId) {
    await chrome.runtime.sendMessage({
      type: 'setCaptureEnabled',
      tabId: currentTabId,
      enabled: isCapturing.value
    });
  }
};

const clearImages = () => {
  if (!networkListener) return;
  networkListener.clearImages();
  updateStats();
};

const saveStoragePath = async () => {
  await chrome.storage.local.set({ storagePath: storagePath.value });
  try {
    await fetch(`${proxyEndpoint.value}/config/storage-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: storagePath.value })
    });
    alert('路径配置已保存');
  } catch (error) {
    alert('无法连接到代理服务');
  }
};

const saveProxyEndpoint = () => {
  chrome.storage.local.set({ proxyEndpoint: proxyEndpoint.value });
  if (networkListener) {
    networkListener.setProxyEndpoint(proxyEndpoint.value);
  }
};

onMounted(async () => {
  // Get current tab ID
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id ?? null;

  // Load saved settings
  const saved = await chrome.storage.local.get(['storagePath', 'proxyEndpoint']);
  if (saved.storagePath) storagePath.value = saved.storagePath;
  if (saved.proxyEndpoint) proxyEndpoint.value = saved.proxyEndpoint;

  // Initialize NetworkListener
  networkListener = new NetworkListener();
  networkListener.setProxyEndpoint(proxyEndpoint.value);

  // Check service health
  await checkServiceHealth();
  healthCheckInterval = setInterval(checkServiceHealth, 5000);

  // Update stats periodically
  statsUpdateInterval = setInterval(updateStats, 1000);

  // Notify background that DevTools is open
  if (currentTabId) {
    await chrome.runtime.sendMessage({
      type: 'devToolsOpened',
      tabId: currentTabId
    });
  }

  console.log('Image Recorder panel initialized');
});

onUnmounted(() => {
  // Stop capturing if active
  if (networkListener && isCapturing.value) {
    networkListener.stopListening();
  }

  // Clear intervals
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (statsUpdateInterval) clearInterval(statsUpdateInterval);

  // Notify background that DevTools is closed
  if (currentTabId) {
    chrome.runtime.sendMessage({
      type: 'devToolsClosed',
      tabId: currentTabId
    });
  }
});
</script>

<style scoped>
.image-recorder-panel {
  padding: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 16px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}

.status-dot.online { background: #4caf50; }
.status-dot.offline { background: #f44336; }

.service-status {
  display: flex;
  align-items: center;
}

.capture-status button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #e0e0e0;
  font-weight: bold;
  transition: all 0.2s ease;
}

.capture-status button:hover:not(:disabled) {
  background: #d0d0d0;
}

.capture-status button.active {
  background: #4caf50;
  color: white;
}

.capture-status button.active:hover {
  background: #45a049;
}

.capture-status button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-section {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  gap: 8px;
}

.stat-item .label { color: #666; }
.stat-item .value { font-weight: bold; }
.stat-item .value.failed { color: #f44336; }

.image-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: bold;
}

.clear-btn {
  padding: 4px 12px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-btn:hover {
  background: #f57c00;
}

.image-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.image-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  transition: background 0.2s ease;
}

.image-item:hover {
  background: #f9f9f9;
}

.image-item:last-child {
  border-bottom: none;
}

.image-info {
  flex: 1;
  overflow: hidden;
}

.image-url {
  color: #333;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-meta {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.image-meta .separator {
  margin: 0 6px;
  color: #ccc;
}

.image-meta .filename {
  color: #4caf50;
  font-weight: 500;
}

.image-status {
  margin-left: 12px;
  font-size: 16px;
}

.image-status.success {
  color: #4caf50;
}

.no-images {
  padding: 32px;
  text-align: center;
  color: #999;
}

.no-images p {
  margin: 4px 0;
}

.config-section {
  margin-top: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 4px;
}

.config-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
}

.config-item {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-item label {
  font-weight: bold;
  min-width: 80px;
}

.config-item input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.config-item input:focus {
  outline: none;
  border-color: #4caf50;
}

.config-item button {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.config-item button:hover:not(:disabled) {
  background: #45a049;
}

.config-item button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>