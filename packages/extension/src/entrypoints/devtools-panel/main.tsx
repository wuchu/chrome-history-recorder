import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';

// 入口 - 语言由 i18n 模块自动初始化（跟随 Chrome DevTools）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);