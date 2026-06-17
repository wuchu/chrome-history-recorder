import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

/**
 * 获取 Chrome DevTools 语言
 * chrome.i18n.getUILanguage() 返回浏览器 UI 语言
 * DevTools 面板语言跟随浏览器语言
 */
function getDevToolsLocale(): string {
  const language = chrome.i18n.getUILanguage();
  console.log(language);
  // zh-CN, zh-TW, zh-HK 等都映射到 zh
  if (language.startsWith('zh')) {
    return 'zh';
  }
  // 其他语言兜底用英文
  return 'en';
}

// 初始化 i18n - 语言跟随 Chrome DevTools
i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: getDevToolsLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React 已经处理了 XSS
  },
});

export default i18n;
