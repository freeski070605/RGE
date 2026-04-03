import { ReactNode } from 'react';

type SectionPanelProps = {
  id?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
};

export function SectionPanel({ id, title, subtitle, action, children }: SectionPanelProps) {
  return (
    <section id={id} className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">{title}</p>
          <h2>{subtitle}</h2>
        </div>
        {action ? <div className="panel__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
