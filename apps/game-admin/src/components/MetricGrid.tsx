export function MetricGrid(props: { metrics: Array<{ label: string; value: string; tone: string }> }): JSX.Element {
  return (
    <section className="metric-grid">
      {props.metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong className={metric.tone === 'ok' ? 'ok' : metric.tone === 'bad' ? 'bad' : ''}>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}
