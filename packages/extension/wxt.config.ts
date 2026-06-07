import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  outDir: ".wxt",
  manifest: {
    name: 'Media Recorder',
    description: 'Capture images and videos from web pages using DevTools API',
    version: '0.4.0',
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
  // 浏览器启动配置 - 根据环境变量控制
  // NO_BROWSER=1 时禁用自动启动
  webExt: process.env.NO_BROWSER ? {
    disabled: true
  } : {
    chromiumArgs: [
      'https://www.baidu.com',
      '--auto-open-devtools-for-tabs'
    ]
  }
});