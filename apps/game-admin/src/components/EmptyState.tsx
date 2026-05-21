export function EmptyState(props: { text: string }): JSX.Element {
  return <div className="empty-state">{props.text}</div>;
}
