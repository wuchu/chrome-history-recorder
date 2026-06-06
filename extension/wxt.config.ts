import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: "src",
  outDir: ".wxt",
  // entrypointsDir: "src/entrypoints",
  manifest: {
    name: 'Image Recorder',
    description: 'Capture images from web pages using DevTools API',
    version: '0.1.0',
    permissions: [
      'activeTab',
      'storage',
      'downloads'
    ],
    host_permissions: [
      '<all_urls>'  // 允许访问所有域名，用于拦截所有网站的图片
    ],
    devtools_page: 'devtools.html'
  }
});