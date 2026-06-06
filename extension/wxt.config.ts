import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: "src",
  outDir: ".wxt",
  // entrypointsDir: "src/entrypoints",
  manifest: {
    name: 'Media Recorder',
    description: 'Capture images and videos from web pages using DevTools API',
    version: '0.2.0',
    permissions: [
      'activeTab',
      'storage',
      'downloads'
    ],
    host_permissions: [
      '<all_urls>'  // 允许访问所有域名，用于拦截所有网站的媒体
    ],
    devtools_page: 'devtools.html'
  }
});