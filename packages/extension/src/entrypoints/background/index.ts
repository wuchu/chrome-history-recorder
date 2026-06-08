export default defineBackground(() => {
  console.log('Image Recorder background service worker loaded');

  // Initialize state management for multiple tabs
  const captureStates = new Map<number, CaptureState>();

  // Track active DevTools connections
  const devToolsConnections = new Map<number, boolean>();

  interface CaptureState {
    isEnabled: boolean;
    capturedImages: ImageInfo[];
    captureCount: number;
    lastCaptureTime: Date;
    skippedCount: number;
    failedCount: number;
  }

  interface ImageInfo {
    hash: string;
    url: string;
    size: number;
    mimeType: string;
    captureTime: Date;
  }

  // Listen for tab removal to clean up state
  chrome.tabs.onRemoved.addListener((tabId) => {
    captureStates.delete(tabId);
    console.log(`Cleaned up state for tab ${tabId}`);
  });

  // Listen for tab replacement (refresh)
  chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    // Preserve capture count but reset other state
    const oldState = captureStates.get(removedTabId);
    if (oldState) {
      captureStates.set(addedTabId, {
        isEnabled: false, // Reset to disabled after refresh
        capturedImages: [],
        captureCount: 0,
        lastCaptureTime: new Date(),
        skippedCount: 0,
        failedCount: 0,
      });
      captureStates.delete(removedTabId);
    }
  });

  // Handle messages from DevTools panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getCaptureState') {
      const tabId = message.tabId;
      const state = captureStates.get(tabId) || {
        isEnabled: false,
        capturedImages: [],
        captureCount: 0,
        lastCaptureTime: new Date(),
        skippedCount: 0,
        failedCount: 0,
      };
      sendResponse(state);
    } else if (message.type === 'setCaptureEnabled') {
      const tabId = message.tabId;
      const enabled = message.enabled;
      const state = captureStates.get(tabId) || {
        isEnabled: false,
        capturedImages: [],
        captureCount: 0,
        lastCaptureTime: new Date(),
        skippedCount: 0,
        failedCount: 0,
      };
      state.isEnabled = enabled;
      captureStates.set(tabId, state);
      sendResponse({ success: true });
    } else if (message.type === 'devToolsOpened') {
      // Track DevTools connection
      const tabId = message.tabId;
      devToolsConnections.set(tabId, true);
      console.log(`DevTools opened for tab ${tabId}`);
      sendResponse({ success: true });
    } else if (message.type === 'devToolsClosed') {
      // Mark DevTools as closed (but keep state)
      const tabId = message.tabId;
      devToolsConnections.set(tabId, false);
      console.log(`DevTools closed for tab ${tabId}`);
      sendResponse({ success: true });
    } else if (message.type === 'isDevToolsOpen') {
      const tabId = message.tabId;
      const isOpen = devToolsConnections.get(tabId) || false;
      sendResponse({ isOpen });
    } else if (message.type === 'getGlobalStats') {
      // Aggregate stats from all tabs
      let totalCaptured = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let totalSize = 0;

      captureStates.forEach((state) => {
        totalCaptured += state.captureCount;
        totalSkipped += state.skippedCount;
        totalFailed += state.failedCount;
        totalSize += state.capturedImages.reduce((sum, img) => sum + img.size, 0);
      });

      sendResponse({
        totalCaptured,
        totalSkipped,
        totalFailed,
        totalSize,
        activeTabs: captureStates.size,
        activeDevTools: Array.from(devToolsConnections.values()).filter((v) => v).length,
      });
    }
    return true; // Keep message channel open for async response
  });
});
