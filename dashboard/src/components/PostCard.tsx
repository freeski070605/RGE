import { CalendarClock, ImageIcon, Rocket, Sparkles } from 'lucide-react';
import { PostRecord } from '../lib/types';
import { StatusPill } from './StatusPill';

type PostCardProps = {
  post: PostRecord;
  onSelect: (postId: string) => void;
  onQueueMedia: (postId: string) => void;
  onPublishNow: (postId: string) => void;
  onSchedule: (postId: string) => void;
  scheduleValue: string;
  onScheduleChange: (postId: string, value: string) => void;
  busyActionId?: string;
};

export function PostCard({
  post,
  onSelect,
  onQueueMedia,
  onPublishNow,
  onSchedule,
  scheduleValue,
  onScheduleChange,
  busyActionId
}: PostCardProps) {
  return (
    <article className="post-card">
      <div className="post-card__top">
        <div>
          <div className="post-card__meta">
            <StatusPill label={post.schedule.status} />
            <StatusPill label={post.media.status} />
          </div>
          <h3>{post.hook || 'Draft post waiting for content generation'}</h3>
          <p>{post.caption || 'No caption generated yet.'}</p>
        </div>
        <button className="ghost-button" onClick={() => onSelect(post.id)}>
          Open details
        </button>
      </div>

      <div className="post-card__grid">
        <div>
          <span>Platforms</span>
          <strong>{post.platforms.join(', ') || 'No platform selected'}</strong>
        </div>
        <div>
          <span>Player</span>
          <strong>{post.event?.playerId ?? 'Unknown player'}</strong>
        </div>
        <div>
          <span>Event</span>
          <strong>{post.event?.eventType ?? 'Unlinked'}</strong>
        </div>
        <div>
          <span>Performance</span>
          <strong>{Math.round(post.analytics?.performanceScore ?? 0)}</strong>
        </div>
      </div>

      <div className="post-card__actions">
        <button className="mini-button" onClick={() => onQueueMedia(post.id)} disabled={busyActionId === `media:${post.id}`}>
          <ImageIcon size={16} />
          {busyActionId === `media:${post.id}` ? 'Queueing...' : 'Create media'}
        </button>
        <button className="mini-button" onClick={() => onPublishNow(post.id)} disabled={busyActionId === `publish:${post.id}`}>
          <Rocket size={16} />
          {busyActionId === `publish:${post.id}` ? 'Publishing...' : 'Publish now'}
        </button>
        <div className="schedule-inline">
          <label>
            <CalendarClock size={16} />
            <input
              type="datetime-local"
              value={scheduleValue}
              onChange={(event) => onScheduleChange(post.id, event.target.value)}
            />
          </label>
          <button className="mini-button mini-button--accent" onClick={() => onSchedule(post.id)} disabled={busyActionId === `schedule:${post.id}`}>
            <Sparkles size={16} />
            {busyActionId === `schedule:${post.id}` ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </article>
  );
}
