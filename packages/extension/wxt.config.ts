import { defineConfig } from 'wxt';

// Fixed public key for consistent Extension ID in development
// This ensures the Extension ID stays the same across reloads
const DEV_PUBLIC_KEY = `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAulHkiBAKBwVAleVP/QKNbEtcuwFqhUtcY5fxhIdhPjk9f4Ty9vXAiobSjNsJeJzRtUEkgZYxHUfBRfjSXTMzD+RC6OJ5EiaB2FNlDCHvKrWDjFBORVVhFyMyv1lZ4Q5riIdPCCwJ8JVVpkYz/t/adfEZv2WfEF41x/7DRIjAtBAavcLK3Vg2nfIi0CuzgxyQXHJVWbFJsq1WlIfQGcDN9TzEyPWgbtcmL2QO9kEe4dEunqtIOp81REeoCyZVOzjShLz8zka2QsDnwxHvJz8rdKcC4P+XAL1Jr9zx6EgVwHTFwAbSZU8qGHdBuvt2PseS/V2+bhTC/D04lhP0sxhyEQIDAQAB`;

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: '.wxt',
  manifest: {
    name: 'Media Recorder',
    description: 'Capture images and videos from web pages using DevTools API',
    version: '0.4.0',
    permissions: ['activeTab', 'storage', 'downloads', 'declarativeNetRequest'],
    host_permissions: [
      '<all_urls>', // 允许访问所有域名，用于拦截所有网站的媒体
      'http://localhost/*', // 允许访问本地 Ollama/VFS 服务
      'http://127.0.0.1/*', // 允许访问本地 Ollama 服务
    ],
    devtools_page: 'devtools.html',
    // Fixed key for development - ensures consistent Extension ID
    // Remove this for production builds
    ...(process.env.NODE_ENV !== 'production' && { key: DEV_PUBLIC_KEY }),
  },
  // 浏览器启动配置 - 根据环境变量控制
  // NO_BROWSER=1 时禁用自动启动
  webExt: process.env.NO_BROWSER
    ? {
        disabled: true,
      }
    : {
        chromiumArgs: ['https://www.baidu.com', '--auto-open-devtools-for-tabs'],
      },
});
