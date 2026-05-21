export function SearchPanel(props: {
  busy: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
}): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Player Search</p>
          <h3>按玩家 ID、昵称或 dev 身份检索，留空查全部</h3>
        </div>
        <div className="inline-form lookup-form">
          <input value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} placeholder="留空查全部，例如 dev、测试用户、player id" />
          <button className="primary-button" disabled={props.busy} onClick={props.onSearch} type="button">搜索</button>
        </div>
      </div>
    </section>
  );
}
