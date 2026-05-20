import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ADMIN_API_PREFIX,
  APP_NAME,
  type AdminOverviewResponse,
  type AdminPlayerOverviewResponse,
  type AdminPlayerSearchResponse,
  type AdminRaidOrderDetailResponse,
  type AdminSystemStatusResponse,
} from '@trinitywar/shared';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const DEBUG_KEY = import.meta.env.VITE_ADMIN_DEBUG_KEY ?? '';

function App(): JSX.Element {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [status, setStatus] = useState<AdminSystemStatusResponse | null>(null);
  const [keyword, setKeyword] = useState('dev');
  const [searchResult, setSearchResult] = useState<AdminPlayerSearchResponse | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [playerOverview, setPlayerOverview] = useState<AdminPlayerOverviewResponse | null>(null);
  const [orderId, setOrderId] = useState('');
  const [orderDetail, setOrderDetail] = useState<AdminRaidOrderDetailResponse | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedNickname = useMemo(() => {
    return searchResult?.items.find((item) => item.playerId === selectedPlayerId)?.nickname ?? selectedPlayerId;
  }, [searchResult, selectedPlayerId]);

  useEffect(() => {
    void refreshShell();
  }, []);

  const run = async <T,>(label: string, request: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    setError(null);
    try {
      return await request();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '请求失败');
      return null;
    } finally {
      setBusy('');
    }
  };

  const refreshShell = async (): Promise<void> => {
    const [nextOverview, nextStatus] = await Promise.all([
      adminFetch<AdminOverviewResponse>('/overview'),
      adminFetch<AdminSystemStatusResponse>('/system/status'),
    ]).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '后台概览请求失败');
      return [null, null] as const;
    });

    setOverview(nextOverview);
    setStatus(nextStatus);
  };

  const handleSearch = async (): Promise<void> => {
    const result = await run('search', () => adminFetch<AdminPlayerSearchResponse>(`/players/search?keyword=${encodeURIComponent(keyword)}`));
    if (!result) {
      return;
    }
    setSearchResult(result);
    const firstPlayerId = result.items[0]?.playerId ?? '';
    setSelectedPlayerId(firstPlayerId);
    setPlayerOverview(null);
  };

  const handleLoadPlayer = async (playerId = selectedPlayerId): Promise<void> => {
    if (!playerId) {
      setError('请选择玩家');
      return;
    }
    const result = await run('player', () => adminFetch<AdminPlayerOverviewResponse>(`/players/${encodeURIComponent(playerId)}/overview`));
    if (result) {
      setSelectedPlayerId(playerId);
      setPlayerOverview(result);
    }
  };

  const handleLoadOrder = async (): Promise<void> => {
    if (!orderId.trim()) {
      setError('请输入订单 ID');
      return;
    }
    const result = await run('order', () => adminFetch<AdminRaidOrderDetailResponse>(`/raid/orders/${encodeURIComponent(orderId.trim())}`));
    if (result) {
      setOrderDetail(result);
    }
  };

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>{APP_NAME}</h1>
        </div>
        <button className="icon-button" disabled={busy === 'shell'} onClick={() => void run('shell', refreshShell)} type="button">
          刷新
        </button>
      </header>

      {error ? <div className="error-line">{error}</div> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>数据库</span>
          <strong className={status?.database.status === 'up' ? 'ok' : 'bad'}>{status?.database.status ?? '-'}</strong>
        </article>
        <article className="metric-card">
          <span>环境</span>
          <strong>{status?.environment ?? '-'}</strong>
        </article>
        <article className="metric-card">
          <span>模块</span>
          <strong>{overview?.modules.length ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>调试头</span>
          <strong>{DEBUG_KEY ? '已配置' : '未配置'}</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="side-panel">
          <label>
            玩家检索
            <div className="inline-form">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="玩家 ID / 昵称 / dev 身份" />
              <button disabled={busy === 'search'} onClick={() => void handleSearch()} type="button">搜索</button>
            </div>
          </label>

          <div className="result-list">
            {(searchResult?.items ?? []).map((player) => (
              <button className={player.playerId === selectedPlayerId ? 'row-button active' : 'row-button'} key={player.playerId} onClick={() => void handleLoadPlayer(player.playerId)} type="button">
                <span>{player.nickname}</span>
                <small>{player.playerId}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Player Overview</p>
              <h2>{selectedNickname || '未选择玩家'}</h2>
            </div>
            <button disabled={!selectedPlayerId || busy === 'player'} onClick={() => void handleLoadPlayer()} type="button">读取详情</button>
          </div>

          {playerOverview ? (
            <div className="data-grid">
              <JsonBlock title="身份" value={playerOverview.identity} />
              <JsonBlock title="钱包" value={playerOverview.wallet} />
              <JsonBlock title="建筑" value={playerOverview.building} />
              <JsonBlock title="军队兼容层" value={playerOverview.army} />
              <JsonBlock title="田地" value={playerOverview.fields.slice(0, 6)} />
              <JsonBlock title="最近战报" value={playerOverview.recentReports} />
            </div>
          ) : (
            <p className="empty-note">先搜索并选择玩家。</p>
          )}
        </section>
      </section>

      <section className="order-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Raid Order</p>
            <h2>订单排查</h2>
          </div>
          <div className="inline-form">
            <input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="raid order id" />
            <button disabled={busy === 'order'} onClick={() => void handleLoadOrder()} type="button">读取订单</button>
          </div>
        </div>
        {orderDetail ? <JsonBlock title="订单详情" value={orderDetail} /> : <p className="empty-note">输入订单 ID 可查看结算、锁定资产和战报。</p>}
      </section>
    </main>
  );
}

function JsonBlock(props: { title: string; value: unknown }): JSX.Element {
  return (
    <article className="json-block">
      <h3>{props.title}</h3>
      <pre>{JSON.stringify(props.value, null, 2)}</pre>
    </article>
  );
}

async function adminFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${ADMIN_API_PREFIX}${path}`, {
    headers: {
      ...(DEBUG_KEY ? { 'x-admin-debug-key': DEBUG_KEY } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
