type StatusPillProps = {
  label: string;
};

const toneMap: Record<string, string> = {
  draft: 'muted',
  received: 'muted',
  processed: 'success',
  content_ready: 'accent',
  media_ready: 'accent',
  scheduled: 'warning',
  posted: 'success',
  pending: 'warning',
  proposed: 'muted',
  approved: 'accent',
  briefed: 'accent',
  variant_ready: 'accent',
  published: 'success',
  processing: 'warning',
  archived: 'muted',
  idea_created: 'accent',
  ranked: 'accent',
  new: 'warning',
  original: 'muted',
  edited: 'success',
  rewarded: 'success',
  failed: 'danger'
};

export function StatusPill({ label }: StatusPillProps) {
  return <span className={`status-pill status-pill--${toneMap[label] ?? 'muted'}`}>{label.replace(/_/g, ' ')}</span>;
}
