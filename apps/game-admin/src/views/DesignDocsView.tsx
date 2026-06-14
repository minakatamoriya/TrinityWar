import type {
  AdminDesignDocCard,
  AdminDesignDocResponse,
  AdminDesignDocSection,
} from '@trinitywar/shared';
import { EmptyState } from '../components/EmptyState';
import { TableSection } from '../components/TableSection';
import { formatValue } from '../domain/labels';
import type { AdminRecord } from '../types';

export function DesignDocsView(props: {
  docs: AdminDesignDocResponse | null;
  busy: string;
  search: string;
  activeSectionKey: string;
  onSearchChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onRefresh: () => void;
}): JSX.Element {
  const docs = props.docs;
  const keyword = props.search.trim().toLowerCase();
  const selectedSections = filterSections(docs?.sections ?? [], props.activeSectionKey, keyword);
  const selectedCards = selectedSections.flatMap((section) => section.cards);
  const selectedTables = selectedSections.flatMap((section) => section.tables.map((table) => ({ ...table, sectionTitle: section.title })));
  const exportMarkdown = docs ? buildDesignDocsMarkdown(docs, selectedSections) : '';

  const copyMarkdown = async (): Promise<void> => {
    if (!exportMarkdown) {
      return;
    }
    await navigator.clipboard?.writeText(exportMarkdown);
  };

  const downloadMarkdown = (): void => {
    if (!exportMarkdown) {
      return;
    }
    const blob = new Blob([exportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trinitywar-design-docs.md';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-stack design-docs">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Generated Docs</p>
            <h3>{docs?.overview.title ?? '数值文档'}</h3>
          </div>
          <div className="action-group">
            <button className="small-button" disabled={!docs} onClick={() => void copyMarkdown()} type="button">复制 Markdown</button>
            <button className="small-button" disabled={!docs} onClick={downloadMarkdown} type="button">下载 Markdown</button>
            <button className="primary-button" disabled={props.busy === 'design-docs'} onClick={props.onRefresh} type="button">刷新</button>
          </div>
        </div>
        {docs ? (
          <>
            <div className="design-doc-metrics">
              {docs.overview.metrics.map((item) => (
                <div className={`design-doc-metric ${item.tone ?? 'neutral'}`} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatValue(item.value)}</strong>
                </div>
              ))}
            </div>
            <p className="panel-note">{docs.overview.summary}</p>
            <div className="design-doc-toolbar">
              <input
                aria-label="搜索数值文档"
                onChange={(event) => props.onSearchChange(event.target.value)}
                placeholder="搜索灵宠、灵植、任务、规则"
                value={props.search}
              />
              <select
                aria-label="文档分类"
                onChange={(event) => props.onSectionChange(event.target.value)}
                value={props.activeSectionKey}
              >
                <option value="all">全部分类</option>
                {docs.sections.map((section) => (
                  <option key={section.key} value={section.key}>{section.title}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <EmptyState text="正在读取数值文档。" />
        )}
      </section>

      {docs ? (
        <section className="panel design-doc-result-head">
          <div>
            <span>匹配卡片</span>
            <strong>{selectedCards.length}</strong>
          </div>
          <div>
            <span>匹配表格</span>
            <strong>{selectedTables.length}</strong>
          </div>
          <div>
            <span>生成时间</span>
            <strong>{formatValue(docs.generatedAt)}</strong>
          </div>
        </section>
      ) : null}

      {docs && selectedCards.length <= 0 ? <EmptyState text="暂无匹配文档。" /> : null}

      {selectedSections.map((section) => (
        <section className="panel design-doc-section" key={section.key}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">{section.key}</p>
              <h3>{section.title}</h3>
            </div>
            <span className="result-count">{section.cards.length} 张卡片</span>
          </div>
          <p className="panel-note">{section.description}</p>
          <div className="design-doc-section-metrics">
            {section.metrics.map((item) => (
              <span className={`status-pill ${item.tone ?? 'neutral'}`} key={`${section.key}:${item.label}`}>
                {item.label}: {formatValue(item.value)}
              </span>
            ))}
          </div>
          <div className="design-doc-card-grid">
            {section.cards.map((card) => <DesignDocCardView card={card} key={card.id} />)}
          </div>
        </section>
      ))}

      {selectedTables.map((table) => (
        <TableSection
          columns={table.columns}
          key={`${table.sectionTitle}:${table.key}`}
          rows={table.rows as AdminRecord[]}
          title={`${table.sectionTitle} / ${table.title}`}
        />
      ))}
    </div>
  );
}

function DesignDocCardView(props: { card: AdminDesignDocCard }): JSX.Element {
  return (
    <article className="design-doc-card">
      <div className="design-doc-card-head">
        <div>
          <span>{props.card.category}</span>
          <strong>{props.card.title}</strong>
          <small>{props.card.subtitle}</small>
        </div>
        <code>{props.card.source}</code>
      </div>
      <p>{props.card.summary}</p>
      <div className="design-doc-card-tags">
        {props.card.tags.map((tag) => <span key={`${props.card.id}:${tag}`}>{tag}</span>)}
      </div>
      <div className="design-doc-card-metrics">
        {props.card.metrics.map((item) => (
          <div key={`${props.card.id}:${item.label}`}>
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
        ))}
      </div>
      <div className="design-doc-facts">
        {props.card.facts.map((fact) => (
          <div key={`${props.card.id}:${fact.key}`}>
            <span>{fact.label}</span>
            <code>{fact.key}</code>
            <strong>{formatValue(fact.value)}</strong>
          </div>
        ))}
      </div>
      {props.card.notes.length > 0 ? (
        <ul className="design-doc-notes">
          {props.card.notes.slice(0, 4).map((note) => <li key={`${props.card.id}:${note}`}>{note}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

function filterSections(
  sections: AdminDesignDocSection[],
  activeSectionKey: string,
  keyword: string,
): AdminDesignDocSection[] {
  return sections
    .filter((section) => activeSectionKey === 'all' || section.key === activeSectionKey)
    .map((section) => {
      if (!keyword) {
        return section;
      }
      const cards = section.cards.filter((card) => cardMatchesKeyword(card, keyword));
      const tables = section.tables
        .map((table) => ({
          ...table,
          rows: table.rows.filter((row) => rowMatchesKeyword(row, keyword)),
        }))
        .filter((table) => table.rows.length > 0);
      return { ...section, cards, tables };
    })
    .filter((section) => section.cards.length > 0 || section.tables.length > 0);
}

function cardMatchesKeyword(card: AdminDesignDocCard, keyword: string): boolean {
  return [
    card.id,
    card.title,
    card.subtitle,
    card.category,
    card.source,
    card.summary,
    ...card.tags,
    ...card.notes,
    ...card.metrics.map((item) => `${item.label} ${item.value}`),
    ...card.facts.map((item) => `${item.label} ${item.key} ${formatValue(item.value)}`),
  ].join(' ').toLowerCase().includes(keyword);
}

function rowMatchesKeyword(row: Record<string, unknown>, keyword: string): boolean {
  return Object.values(row).map(formatValue).join(' ').toLowerCase().includes(keyword);
}

function buildDesignDocsMarkdown(docs: AdminDesignDocResponse, sections: AdminDesignDocSection[]): string {
  const lines: string[] = [
    `# ${docs.overview.title}`,
    '',
    docs.overview.summary,
    '',
    `生成时间：${formatValue(docs.generatedAt)}`,
    '',
    '## 概览',
    '',
    ...docs.overview.metrics.map((item) => `- ${item.label}: ${formatValue(item.value)}`),
    '',
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, '', section.description, '');
    if (section.metrics.length > 0) {
      lines.push(...section.metrics.map((item) => `- ${item.label}: ${formatValue(item.value)}`), '');
    }

    for (const card of section.cards) {
      lines.push(`### ${card.title}`, '', `来源：${card.source}`, '', card.summary, '');
      if (card.metrics.length > 0) {
        lines.push(...card.metrics.map((item) => `- ${item.label}: ${formatValue(item.value)}`), '');
      }
      if (card.notes.length > 0) {
        lines.push(...card.notes.map((note) => `- ${note}`), '');
      }
    }

    for (const table of section.tables) {
      lines.push(`### ${table.title}`, '', table.description, '');
      lines.push(`| ${table.columns.map((column) => column.label).join(' | ')} |`);
      lines.push(`| ${table.columns.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) {
        lines.push(`| ${table.columns.map((column) => formatMarkdownCell(row[column.key])).join(' | ')} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

function formatMarkdownCell(value: unknown): string {
  return formatValue(value).replace(/\|/g, '/').replace(/\n/g, ' ');
}
