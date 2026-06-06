<template>
  <div class="media-recorder-panel">
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
      <div class="stats-group">
        <div class="stats-title">图片</div>
        <div class="stat-item">
          <span class="label">已捕获:</span>
          <span class="value">{{ imageCaptureCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">跳过:</span>
          <span class="value">{{ skippedSvgCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">失败:</span>
          <span class="value failed">{{ failedImageCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">大小:</span>
          <span class="value">{{ formatSize(totalImageSize) }}</span>
        </div>
      </div>
      <div class="stats-group">
        <div class="stats-title">视频</div>
        <div class="stat-item">
          <span class="label">已捕获:</span>
          <span class="value">{{ videoCaptureCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">跳过:</span>
          <span class="value">{{ skippedVideoCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">失败:</span>
          <span class="value failed">{{ failedVideoCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">大小:</span>
          <span class="value">{{ formatSize(totalVideoSize) }}</span>
        </div>
      </div>
    </div>

    <!-- Media list with tabs -->
    <div class="media-tabs">
      <button :class="{ active: activeTab === 'images' }" @click="activeTab = 'images'">
        图片 {{ images.length }}
      </button>
      <button :class="{ active: activeTab === 'videos' }" @click="activeTab = 'videos'">
        视频 {{ videos.length }}
      </button>
    </div>

    <!-- Image list -->
    <div v-show="activeTab === 'images'" class="media-list-header">
      <span>捕获的图片</span>
      <button v-if="images.length > 0" @click="clearImages" class="clear-btn">清空</button>
    </div>
    <div v-show="activeTab === 'images'" class="media-list">
      <div v-for="image in images" :key="image.url" class="media-item">
        <div class="media-info">
          <div class="media-url" :title="image.url">{{ truncateUrl(image.url) }}</div>
          <div class="media-meta">
            <span>{{ formatSize(image.size) }}</span>
            <span class="separator">|</span>
            <span>{{ image.mimeType }}</span>
            <span v-if="image.request?.filename" class="separator">|</span>
            <span v-if="image.request?.filename" class="filename">{{ image.request.filename }}</span>
          </div>
        </div>
        <div class="media-status success">✓</div>
      </div>
      <div v-if="images.length === 0" class="no-media">
        <p>暂无捕获的图片</p>
      </div>
    </div>

    <!-- Video list -->
    <div v-show="activeTab === 'videos'" class="media-list-header">
      <span>捕获的视频</span>
      <button v-if="videos.length > 0" @click="clearVideos" class="clear-btn">清空</button>
    </div>
    <div v-show="activeTab === 'videos'" class="media-list">
      <div v-for="video in videos" :key="video.url" class="media-item video-item">
        <div class="media-info">
          <div class="media-url" :title="video.url">{{ truncateUrl(video.url) }}</div>
          <div class="media-meta">
            <span>{{ formatSize(video.size) }}</span>
            <span class="separator">|</span>
            <span>{{ video.mimeType }}</span>
            <span v-if="video.request?.filename" class="separator">|</span>
            <span v-if="video.request?.filename" class="filename">{{ video.request.filename }}</span>
          </div>
        </div>
        <div class="media-status success">✓</div>
      </div>
      <div v-if="videos.length === 0" class="no-media">
        <p>暂无捕获的视频</p>
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

      <h4>图片过滤</h4>
      <div class="config-item">
        <label>最小大小:</label>
        <input v-model.number="minImageSizeKB" type="number" placeholder="10" min="1">
        <span class="unit">KB</span>
        <button @click="saveImageFilters">应用</button>
      </div>

      <h4>视频过滤</h4>
      <div class="config-item">
        <label>最小大小:</label>
        <input v-model.number="minVideoSizeMB" type="number" placeholder="1" min="0.1" step="0.1">
        <span class="unit">MB</span>
        <button @click="saveVideoFilters">应用</button>
      </div>
      <div class="config-item video-types">
        <label>视频类型:</label>
        <div class="checkbox-group">
          <label><input type="checkbox" v-model="videoTypes.mp4"> MP4</label>
          <label><input type="checkbox" v-model="videoTypes.webm"> WebM</label>
          <label><input type="checkbox" v-model="videoTypes.mov"> MOV</label>
          <label><input type="checkbox" v-model="videoTypes.avi"> AVI</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { NetworkListener, type MediaRequest } from '../../utils/networkListener';

const serviceOnline = ref(false);
const isCapturing = ref(false);
const activeTab = ref<'images' | 'videos'>('images');

// Image stats
const imageCaptureCount = ref(0);
const skippedSvgCount = ref(0);
const failedImageCount = ref(0);
const totalImageSize = ref(0);
const images = ref<MediaRequest[]>([]);

// Video stats
const videoCaptureCount = ref(0);
const skippedVideoCount = ref(0);
const failedVideoCount = ref(0);
const totalVideoSize = ref(0);
const videos = ref<MediaRequest[]>([]);

// Config
const storagePath = ref('~/Downloads/chrome-history');
const proxyEndpoint = ref('http://localhost:3777');
const minImageSizeKB = ref(10);
const minVideoSizeMB = ref(1);
const videoTypes = reactive({
  mp4: true,
  webm: true,
  mov: false,
  avi: false
});

let currentTabId: number | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let statsUpdateInterval: ReturnType<typeof setInterval> | null = null;
let networkListener: NetworkListener | null = null;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
  imageCaptureCount.value = stats.capturedImageCount;
  skippedSvgCount.value = stats.skippedSvgCount;
  failedImageCount.value = stats.failedImageCount;
  totalImageSize.value = stats.totalImageSize;
  images.value = networkListener.getCapturedImages();

  videoCaptureCount.value = stats.capturedVideoCount;
  skippedVideoCount.value = stats.skippedVideoCount;
  failedVideoCount.value = stats.failedVideoCount;
  totalVideoSize.value = stats.totalVideoSize;
  videos.value = networkListener.getCapturedVideos();
};

const toggleCapture = async () => {
  if (!networkListener) return;

  isCapturing.value = !isCapturing.value;

  if (isCapturing.value) {
    networkListener.startListening();
    console.log('Started capturing media');
  } else {
    networkListener.stopListening();
    console.log('Stopped capturing media');
  }

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

const clearVideos = () => {
  if (!networkListener) return;
  networkListener.clearVideos();
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

const saveImageFilters = () => {
  if (!networkListener) return;
  networkListener.setMinFileSize(minImageSizeKB.value * 1024);
  chrome.storage.local.set({ minImageSizeKB: minImageSizeKB.value });
};

const saveVideoFilters = () => {
  if (!networkListener) return;
  const enabledTypes: string[] = [];
  if (videoTypes.mp4) enabledTypes.push('video/mp4');
  if (videoTypes.webm) enabledTypes.push('video/webm');
  if (videoTypes.mov) enabledTypes.push('video/quicktime');
  if (videoTypes.avi) enabledTypes.push('video/x-msvideo');

  networkListener.setEnabledVideoTypes(enabledTypes);
  networkListener.setMinVideoSize(minVideoSizeMB.value * 1024 * 1024);
  chrome.storage.local.set({
    minVideoSizeMB: minVideoSizeMB.value,
    enabledVideoTypes: enabledTypes
  });
};

onMounted(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id ?? null;

  const saved = await chrome.storage.local.get([
    'storagePath', 'proxyEndpoint', 'minImageSizeKB',
    'minVideoSizeMB', 'enabledVideoTypes'
  ]);

  if (saved.storagePath) storagePath.value = saved.storagePath;
  if (saved.proxyEndpoint) proxyEndpoint.value = saved.proxyEndpoint;
  if (saved.minImageSizeKB) minImageSizeKB.value = saved.minImageSizeKB;
  if (saved.minVideoSizeMB) minVideoSizeMB.value = saved.minVideoSizeMB;

  if (saved.enabledVideoTypes) {
    videoTypes.mp4 = saved.enabledVideoTypes.includes('video/mp4');
    videoTypes.webm = saved.enabledVideoTypes.includes('video/webm');
    videoTypes.mov = saved.enabledVideoTypes.includes('video/quicktime');
    videoTypes.avi = saved.enabledVideoTypes.includes('video/x-msvideo');
  }

  networkListener = new NetworkListener();
  networkListener.setProxyEndpoint(proxyEndpoint.value);
  networkListener.setMinFileSize(minImageSizeKB.value * 1024);
  networkListener.setMinVideoSize(minVideoSizeMB.value * 1024 * 1024);

  const enabledVideoTypes: string[] = [];
  if (videoTypes.mp4) enabledVideoTypes.push('video/mp4');
  if (videoTypes.webm) enabledVideoTypes.push('video/webm');
  if (videoTypes.mov) enabledVideoTypes.push('video/quicktime');
  if (videoTypes.avi) enabledVideoTypes.push('video/x-msvideo');
  networkListener.setEnabledVideoTypes(enabledVideoTypes);

  await checkServiceHealth();
  healthCheckInterval = setInterval(checkServiceHealth, 5000);
  statsUpdateInterval = setInterval(updateStats, 1000);

  if (currentTabId) {
    await chrome.runtime.sendMessage({
      type: 'devToolsOpened',
      tabId: currentTabId
    });
  }

  console.log('Media Recorder panel initialized');
});

onUnmounted(() => {
  if (networkListener && isCapturing.value) {
    networkListener.stopListening();
  }

  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (statsUpdateInterval) clearInterval(statsUpdateInterval);

  if (currentTabId) {
    chrome.runtime.sendMessage({
      type: 'devToolsClosed',
      tabId: currentTabId
    });
  }
});
</script>

<style scoped>
.media-recorder-panel {
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
  gap: 24px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 16px;
}

.stats-group {
  flex: 1;
}

.stats-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4px;
}

.stat-item {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.stat-item .label { color: #666; }
.stat-item .value { font-weight: bold; }
.stat-item .value.failed { color: #f44336; }

.media-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.media-tabs button {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 12px;
}

.media-tabs button.active {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.media-list-header {
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

.media-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.media-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  transition: background 0.2s ease;
}

.media-item:hover {
  background: #f9f9f9;
}

.media-item:last-child {
  border-bottom: none;
}

.video-item {
  background: #fff8e1;
}

.video-item:hover {
  background: #ffecb3;
}

.media-info {
  flex: 1;
  overflow: hidden;
}

.media-url {
  color: #333;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-meta {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.media-meta .separator {
  margin: 0 6px;
  color: #ccc;
}

.media-meta .filename {
  color: #4caf50;
  font-weight: 500;
}

.media-status {
  margin-left: 12px;
  font-size: 16px;
}

.media-status.success {
  color: #4caf50;
}

.no-media {
  padding: 32px;
  text-align: center;
  color: #999;
}

.no-media p {
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

.config-section h4 {
  margin: 16px 0 8px 0;
  font-size: 13px;
  color: #666;
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

.config-item input[type="text"] {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.config-item input[type="number"] {
  width: 80px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.config-item input:focus {
  outline: none;
  border-color: #4caf50;
}

.config-item .unit {
  color: #666;
  font-size: 12px;
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

.video-types {
  flex-wrap: wrap;
}

.checkbox-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: normal;
  min-width: auto;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  cursor: pointer;
}
</style>