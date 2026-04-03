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
  new_opportunity: 'muted',
  draft_ready: 'accent',
  needs_review: 'warning',
  not_started: 'muted',
  queued: 'warning',
  completed: 'success',
  succeeded: 'success',
  underperforming: 'danger',
  assisted: 'accent',
  autopilot: 'success',
  manual: 'muted',
  low: 'muted',
  medium: 'accent',
  high: 'warning',
  critical: 'danger',
  open: 'muted',
  saved: 'accent',
  converted: 'success',
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  ok: 'success',
  error: 'danger',
  unscheduled: 'muted',
  original: 'muted',
  edited: 'success',
  rewarded: 'success',
  failed: 'danger'
};

export function StatusPill({ label }: StatusPillProps) {
  return <span className={`status-pill status-pill--${toneMap[label] ?? 'muted'}`}>{label.replace(/_/g, ' ')}</span>;
}
