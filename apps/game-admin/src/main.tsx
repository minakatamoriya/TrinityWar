import React from 'react';
import ReactDOM from 'react-dom/client';
import { APP_NAME } from '@trinitywar/shared';
import './styles.css';

function App(): JSX.Element {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Admin Console</p>
        <h1>{APP_NAME}</h1>
        <p className="summary">运营后台、活动配置和数值管理将与游戏客户端分开部署。</p>
        <ul className="checklist">
          <li>独立端口开发与部署</li>
          <li>后续接入登录与权限系统</li>
          <li>与 Node 服务端走管理接口</li>
        </ul>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);