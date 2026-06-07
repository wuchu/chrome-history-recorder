import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';

// 初始化语言
async function init() {
  const saved = await chrome.storage.local.get('locale');
  if (saved.locale) {
    // i18n 会在 App 中初始化
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

init();