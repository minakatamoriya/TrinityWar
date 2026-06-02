export function LoadingScreen(): JSX.Element {
  return (
    <main className="loading-shell">
      <section className="loading-panel">
        <p className="eyebrow">TRINITY WAR</p>
        <h1>验证前端加载中</h1>
        <p className="panel-text">正在读取客户端验证数据与页面结构。</p>
      </section>
    </main>
  );
}
