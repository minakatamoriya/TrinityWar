import type { ReactNode } from 'react';

export function Modal(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) {
        props.onClose();
      }
    }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-head">
          <div>
            <p className="eyebrow">{props.subtitle}</p>
            <h2 id="modal-title">{props.title}</h2>
          </div>
          <button className="small-button" type="button" onClick={props.onClose}>关闭</button>
        </header>
        <div className="modal-body">{props.children}</div>
      </section>
    </div>
  );
}
