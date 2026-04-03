import { ReactNode } from 'react';

type StatCardProps = {
  eyebrow: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
};

export function StatCard({ eyebrow, value, detail, icon, tone = 'neutral' }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__header">
        <span>{eyebrow}</span>
        <div className="stat-card__icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
