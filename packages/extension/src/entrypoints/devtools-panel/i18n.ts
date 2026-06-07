import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

// 获取 Chrome DevTools 语言
function getDevToolsLocale(): string {
  const language = chrome.i18n.getUILanguage();
  // zh-CN, zh-TW, zh-HK 等都映射到 zh
  if (language.startsWith('zh')) {
    return 'zh';
  }
  // 其他语言兜底用英文
  return 'en';
}

// 初始化 i18n
i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en }
    },
    lng: getDevToolsLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React 已经处理了 XSS
    }
  });

// 初始化语言（跟随 DevTools）
export function initLocale(): void {
  const locale = getDevToolsLocale();
  i18n.changeLanguage(locale);
}

export default i18n;