import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  outDir: ".wxt",
  manifest: {
    name: 'Media Recorder',
    description: 'Capture images and videos from web pages using DevTools API',
    version: '0.3.0',
    permissions: [
      'activeTab',
      'storage',
      'downloads'
    ],
    host_permissions: [
      '<all_urls>'  // 允许访问所有域名，用于拦截所有网站的媒体
    ],
    devtools_page: 'devtools.html'
  },
  // 浏览器启动配置 (替代已弃用的 runner)
  // https://wxt.dev/runner.html
  webExt: {
    // 开发时默认打开的 URL (直接作为 chromium 参数)
    chromiumArgs: [
      'https://www.baidu.com',
      '--auto-open-devtools-for-tabs'
    ]
  }
});