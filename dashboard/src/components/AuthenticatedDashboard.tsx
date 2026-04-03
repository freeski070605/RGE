import { FormEvent, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarRange,
  CopyPlus,
  Gift,
  ImagePlus,
  Layers3,
  LogOut,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Trophy,
  Users
} from 'lucide-react';
import { dashboardApi, extractApiError, isUnauthorizedError } from '../lib/api';
import {
  AssetRecord,
  GrowthDashboard,
  ImplementationSpec,
  LeaderboardRecord,
  OperatorRecord,
  ReferralRecord,
  SignalRecord
} from '../lib/types';
import { SectionPanel } from './SectionPanel';
import { StatCard } from './StatCard';
import { StatusPill } from './StatusPill';

const navItems = ['Overview', 'Today Queue', 'Leaderboards', 'Signals', 'Variants', 'Assets', 'Referrals'];
const fmtMoney = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const fmtDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(value))
    : 'Not set';
const toLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

type DashboardToast = { type: 'success' | 'error'; message: string } | null;

export function AuthenticatedDashboard(input: {
  operator: OperatorRecord;
  onLogout: () => Promise<void>;
  globalToast: DashboardToast;
  setGlobalToast: (toast: DashboardToast) => void;
}) {
  const [dashboard, setDashboard] = useState<GrowthDashboard | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardRecord[]>([]);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [spec, setSpec] = useState<ImplementationSpec | null>(null);
  const [leaderboardWindow, setLeaderboardWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [briefForm, setBriefForm] = useState({
    platform: 'instagram',
    format: 'reel',
    tone: 'competitive and social-first'
  });
  const [variantCount, setVariantCount] = useState('3');
  const [assetUploadForm, setAssetUploadForm] = useState({ title: '', tags: '' });
  const [assetUploadFile, setAssetUploadFile] = useState<File | null>(null);
  const [assetEditDrafts, setAssetEditDrafts] = useState<
    Record<string, { preset: 'square' | 'story' | 'reel'; overlayText: string }>
  >({});
  const [metricsForm, setMetricsForm] = useState({
    clicks: '12',
    signups: '2',
    deposits: '1',
    likes: '26',
    comments: '5',
    shares: '4',
    saves: '3',
    impressions: '220'
  });
  const [referralCreateUserId, setReferralCreateUserId] = useState('');
  const [inviteForm, setInviteForm] = useState({ code: '', invitedUserId: '' });
  const [rewardForm, setRewardForm] = useState({ code: '', invitedUserId: '', rewardCents: '500' });
  const [busyActionId, setBusyActionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      const [dashboardData, leaderboardsData, signalsData, assetsData, referralsData, specData] = await Promise.all([
        dashboardApi.getGrowthDashboard(),
        dashboardApi.getLeaderboards(leaderboardWindow),
        dashboardApi.getSignals(),
        dashboardApi.getAssets(),
        dashboardApi.getReferrals(),
        dashboardApi.getImplementationSpec()
      ]);
      setDashboard(dashboardData);
      setLeaderboards(leaderboardsData);
      setSignals(signalsData);
      setAssets(assetsData);
      setReferrals(referralsData);
      setSpec(specData);
      setScheduleDrafts((current) =>
        Object.fromEntries(dashboardData.variants.map((variant) => [variant.id, current[variant.id] || toLocal()]))
      );
      setAssetEditDrafts((current) =>
        Object.fromEntries(
          assetsData.map((asset) => [
            asset.id,
            current[asset.id] || { preset: 'square', overlayText: asset.title || 'ReemTeam Highlight' }
          ])
        )
      );
      if (!selectedIdeaId && dashboardData.todayQueue[0]) setSelectedIdeaId(dashboardData.todayQueue[0].id);
      if (!selectedVariantId && dashboardData.variants[0]) setSelectedVariantId(dashboardData.variants[0].id);
      if (!selectedJobId && dashboardData.publishingJobs[0]) setSelectedJobId(dashboardData.publishingJobs[0].id);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        input.setGlobalToast({ type: 'error', message: 'Your session expired. Please sign in again.' });
        await input.onLogout();
        return;
      }

      input.setGlobalToast({ type: 'error', message: extractApiError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, [leaderboardWindow]);

  const runBusy = async (id: string, action: () => Promise<void>) => {
    setBusyActionId(id);
    try {
      await action();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        input.setGlobalToast({ type: 'error', message: 'Your session expired. Please sign in again.' });
        await input.onLogout();
        return;
      }

      input.setGlobalToast({ type: 'error', message: extractApiError(error) });
    } finally {
      setBusyActionId('');
    }
  };

  const selectedIdea = dashboard?.todayQueue.find((idea) => idea.id === selectedIdeaId) ?? null;
  const selectedVariant = dashboard?.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const selectedJob = dashboard?.publishingJobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));

  const createBrief = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedIdeaId) {
      input.setGlobalToast({ type: 'error', message: 'Choose a content idea first.' });
      return;
    }

    await runBusy('create-brief', async () => {
      await dashboardApi.createBrief(selectedIdeaId, { ...briefForm, assetIds: selectedAssetIds });
      input.setGlobalToast({ type: 'success', message: 'Creative brief created.' });
      await refreshAll();
    });
  };

  const uploadAsset = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetUploadFile) {
      input.setGlobalToast({ type: 'error', message: 'Choose a file to upload.' });
      return;
    }

    await runBusy('asset-upload', async () => {
      const payload = new FormData();
      payload.append('file', assetUploadFile);
      payload.append('title', assetUploadForm.title);
      payload.append('tags', assetUploadForm.tags);
      await dashboardApi.uploadAsset(payload);
      setAssetUploadFile(null);
      setAssetUploadForm({ title: '', tags: '' });
      input.setGlobalToast({ type: 'success', message: 'Asset uploaded.' });
      await refreshAll();
    });
  };

  return (
    <div className="app-shell">
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      {input.globalToast ? <div className={`toast toast--${input.globalToast.type}`}>{input.globalToast.message}</div> : null}
      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-block__eyebrow">ReemTeam Growth Ops</span>
            <h1>ReemGrowth Engine V2</h1>
            <p>Real game signals to briefs, variants, publishing, and feedback.</p>
          </div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}>
                {item}
              </a>
            ))}
          </nav>
          <div className="sidebar-callout">
            <p>Signed in</p>
            <strong>{input.operator.name}</strong>
            <span>{input.operator.email}</span>
            <p>System status</p>
            <strong>{isLoading ? 'Refreshing workspace...' : 'Dashboard connected to API and workers'}</strong>
            <button
              className="ghost-button"
              onClick={() =>
                void runBusy('sync-intelligence', async () => {
                  await dashboardApi.syncIntelligence({ mode: 'sync' });
                  input.setGlobalToast({ type: 'success', message: 'Game intelligence synced.' });
                  await refreshAll();
                })
              }
              disabled={busyActionId === 'sync-intelligence'}
            >
              <RefreshCw size={16} />
              {busyActionId === 'sync-intelligence' ? 'Syncing...' : 'Sync backend feed'}
            </button>
            <button
              className="ghost-button"
              onClick={() => void runBusy('logout', input.onLogout)}
              disabled={busyActionId === 'logout'}
            >
              <LogOut size={16} />
              {busyActionId === 'logout' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </aside>

        <main className="main-column">
          <section id="overview" className="hero">
            <div>
              <span className="hero__eyebrow">Intelligence First Workflow</span>
              <h2>From top earners and most reems to publishable variants and measurable outcomes.</h2>
              <p>The dashboard now starts from real backend signals instead of ad hoc post requests.</p>
            </div>
            <div className="hero__chip-grid">
              <div>
                <span>Hook styles</span>
                <strong>{dashboard?.strategy.winningHookStyles.length ?? 0}</strong>
              </div>
              <div>
                <span>Exact routes</span>
                <strong>{spec?.apiRoutes.length ?? 0}</strong>
              </div>
              <div>
                <span>Worker flows</span>
                <strong>{spec?.workerFlow.length ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard
              eyebrow="Ideas in queue"
              value={String(dashboard?.headline.totalIdeas ?? 0)}
              detail="Ranked opportunities ready for operators."
              icon={<Layers3 size={18} />}
              tone="accent"
            />
            <StatCard
              eyebrow="Variants live"
              value={String(dashboard?.headline.totalVariants ?? 0)}
              detail="Creative options generated for testing."
              icon={<Sparkles size={18} />}
              tone="success"
            />
            <StatCard
              eyebrow="Publishing jobs"
              value={String(dashboard?.headline.totalPublishingJobs ?? 0)}
              detail="Scheduled or published platform jobs."
              icon={<CalendarRange size={18} />}
              tone="warning"
            />
            <StatCard
              eyebrow="Tracked clicks"
              value={String(dashboard?.insights.totals.clicks ?? 0)}
              detail="Performance flowing back into strategy."
              icon={<Activity size={18} />}
              tone="neutral"
            />
          </section>

          <SectionPanel id="today-queue" title="Today Queue" subtitle="Work from ranked opportunities instead of raw events">
            <div className="split-grid">
              <div className="stack">
                {dashboard?.todayQueue.map((idea) => (
                  <article
                    key={idea.id}
                    className={`idea-card ${idea.id === selectedIdeaId ? 'idea-card--selected' : ''}`}
                    onClick={() => setSelectedIdeaId(idea.id)}
                  >
                    <div className="idea-card__header">
                      <div className="post-card__meta">
                        <StatusPill label={idea.status} />
                        <StatusPill label={idea.ideaType} />
                      </div>
                      <strong>{Math.round(idea.priorityScore)}</strong>
                    </div>
                    <h3>{idea.headline}</h3>
                    <p>{idea.reason}</p>
                  </article>
                ))}
              </div>
              <form className="form-card" onSubmit={createBrief}>
                <div className="form-card__header">
                  <CopyPlus size={18} />
                  <strong>Create creative brief</strong>
                </div>
                <div className="detail-block">
                  <span>Selected idea</span>
                  <strong>{selectedIdea?.headline || 'Choose an idea'}</strong>
                  <p>{selectedIdea?.hookAngle || 'Hook direction will appear here.'}</p>
                </div>
                <div className="field-grid field-grid--two">
                  <label>
                    Platform
                    <select
                      value={briefForm.platform}
                      onChange={(event) => setBriefForm((current) => ({ ...current, platform: event.target.value }))}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="x">X</option>
                      <option value="story">Story</option>
                    </select>
                  </label>
                  <label>
                    Format
                    <select
                      value={briefForm.format}
                      onChange={(event) => setBriefForm((current) => ({ ...current, format: event.target.value }))}
                    >
                      <option value="reel">Reel</option>
                      <option value="carousel">Carousel</option>
                      <option value="story">Story</option>
                      <option value="square">Square</option>
                    </select>
                  </label>
                </div>
                <label>
                  Tone
                  <input
                    value={briefForm.tone}
                    onChange={(event) => setBriefForm((current) => ({ ...current, tone: event.target.value }))}
                  />
                </label>
                <div className="chip-row">
                  {selectedAssets.length ? (
                    selectedAssets.map((asset) => (
                      <span key={asset.id} className="chip">
                        {asset.kind}: {asset.title || asset.id}
                      </span>
                    ))
                  ) : (
                    <p>No assets selected yet.</p>
                  )}
                </div>
                <button className="primary-button" type="submit" disabled={busyActionId === 'create-brief'}>
                  <CopyPlus size={16} />
                  {busyActionId === 'create-brief' ? 'Creating...' : 'Create brief'}
                </button>
              </form>
            </div>
          </SectionPanel>

          <SectionPanel id="leaderboards" title="Leaderboards" subtitle="Top earners, reems, payouts, win rate, and streaks">
            <div className="panel-toolbar">
              {(['24h', '7d', '30d'] as const).map((window) => (
                <button
                  key={window}
                  className={`mini-button ${leaderboardWindow === window ? 'mini-button--accent' : ''}`}
                  onClick={() => setLeaderboardWindow(window)}
                >
                  {window}
                </button>
              ))}
            </div>
            <div className="leaderboard-grid">
              {leaderboards.map((board) => (
                <article key={board.id} className="leaderboard">
                  <div className="leaderboard__header">
                    <Trophy size={18} />
                    <strong>{board.title}</strong>
                  </div>
                  {board.rankings.map((entry) => (
                    <div key={`${board.id}-${entry.playerId}`} className="leaderboard__item">
                      <div>
                        <strong>
                          #{entry.rank} {entry.username}
                        </strong>
                        <p>{entry.playerId}</p>
                      </div>
                      <span>{Math.round(entry.value)}</span>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel id="signals" title="Signals" subtitle="Backend moments with a clear post-worthiness score">
            <div className="signal-list">
              {signals.map((signal) => (
                <article key={signal.id} className="signal-row">
                  <div>
                    <div className="post-card__meta">
                      <StatusPill label={signal.status} />
                      <StatusPill label={signal.signalType} />
                    </div>
                    <strong>{signal.username || signal.playerId || 'Unknown player'}</strong>
                    <p>
                      {signal.signalType.replace(/_/g, ' ')} on {fmtDate(signal.occurredAt)}
                    </p>
                  </div>
                  <div className="signal-row__score">
                    <span>Priority</span>
                    <strong>{Math.round(signal.scores.overallPriorityScore)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel id="variants" title="Variants" subtitle="Generate media, schedule, publish, and track performance">
            <div className="split-grid">
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header">
                    <Sparkles size={18} />
                    <strong>Variant generation</strong>
                  </div>
                  <label>
                    Variant count
                    <select value={variantCount} onChange={(event) => setVariantCount(event.target.value)}>
                      <option value="2">2 variants</option>
                      <option value="3">3 variants</option>
                      <option value="4">4 variants</option>
                    </select>
                  </label>
                  <div className="stack">
                    {dashboard?.briefs.map((brief) => (
                      <button
                        key={brief.id}
                        className="mini-button mini-button--accent"
                        onClick={() =>
                          void runBusy(`generate:${brief.id}`, async () => {
                            await dashboardApi.generateVariants(brief.id, Number(variantCount || 3));
                            input.setGlobalToast({ type: 'success', message: 'Variants generated.' });
                            await refreshAll();
                          })
                        }
                        disabled={busyActionId === `generate:${brief.id}`}
                      >
                        Generate for {brief.ideaHeadline || brief.objective}
                      </button>
                    ))}
                  </div>
                </article>
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); if (!selectedJobId) return; void runBusy('track-job', async () => { await dashboardApi.trackPublishingJob(selectedJobId, Object.fromEntries(Object.entries(metricsForm).map(([key, value]) => [key, Number(value || 0)]))); input.setGlobalToast({ type: 'success', message: 'Publishing performance updated.' }); await refreshAll(); }); }}>
                  <div className="form-card__header"><BarChart3 size={18} /><strong>Track job metrics</strong></div>
                  <label>Publishing job<select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}><option value="">Choose a job</option>{dashboard?.publishingJobs.map((job) => <option key={job.id} value={job.id}>{job.platform} - {job.variant?.variantLabel || job.id}</option>)}</select></label>
                  <div className="field-grid field-grid--two">{Object.entries(metricsForm).map(([key, value]) => <label key={key}>{key}<input type="number" value={value} onChange={(event) => setMetricsForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
                  <button className="primary-button" type="submit" disabled={busyActionId === 'track-job'}><BarChart3 size={16} />{busyActionId === 'track-job' ? 'Updating...' : 'Update performance'}</button>
                </form>
              </div>
              <div className="variant-grid">
                {dashboard?.variants.map((variant) => (
                  <article key={variant.id} className={`variant-card ${variant.id === selectedVariantId ? 'variant-card--selected' : ''}`} onClick={() => setSelectedVariantId(variant.id)}>
                    <div className="post-card__meta"><StatusPill label={variant.status} /><StatusPill label={variant.media.status} /></div>
                    <h3>{variant.variantLabel}</h3>
                    <p>{variant.hook}</p>
                    <div className="detail-media">{variant.media.videoUrl ? <video controls src={variant.media.videoUrl} /> : variant.media.imageUrl ? <img src={variant.media.imageUrl} alt={variant.hook} /> : <div className="media-placeholder">Render media to preview this variant.</div>}</div>
                    <div className="post-card__actions">
                      <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`media:${variant.id}`, async () => { await dashboardApi.queueVariantMedia(variant.id); input.setGlobalToast({ type: 'success', message: 'Variant media queued.' }); await refreshAll(); }); }} disabled={busyActionId === `media:${variant.id}`}><ImagePlus size={16} />{busyActionId === `media:${variant.id}` ? 'Queueing...' : 'Create media'}</button>
                      <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`publish:${variant.id}`, async () => { const jobs = await dashboardApi.publishVariantNow(variant.id); if (jobs[0]) setSelectedJobId(jobs[0].id); input.setGlobalToast({ type: 'success', message: 'Variant published.' }); await refreshAll(); }); }} disabled={busyActionId === `publish:${variant.id}`}><Rocket size={16} />{busyActionId === `publish:${variant.id}` ? 'Publishing...' : 'Publish now'}</button>
                    </div>
                    <div className="schedule-inline">
                      <label><CalendarRange size={16} /><input type="datetime-local" value={scheduleDrafts[variant.id] ?? ''} onChange={(event) => setScheduleDrafts((current) => ({ ...current, [variant.id]: event.target.value }))} /></label>
                      <button className="mini-button mini-button--accent" onClick={(event) => { event.stopPropagation(); void runBusy(`schedule:${variant.id}`, async () => { const jobs = await dashboardApi.scheduleVariant(variant.id, { scheduledFor: new Date(scheduleDrafts[variant.id] || toLocal()).toISOString() }); if (jobs[0]) setSelectedJobId(jobs[0].id); input.setGlobalToast({ type: 'success', message: 'Publishing jobs scheduled.' }); await refreshAll(); }); }} disabled={busyActionId === `schedule:${variant.id}`}><Send size={16} />{busyActionId === `schedule:${variant.id}` ? 'Scheduling...' : 'Schedule'}</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="assets" title="Assets" subtitle="Upload, auto-edit, and select media for the next brief">
            <div className="split-grid">
              <div className="stack">
                <form className="form-card" onSubmit={uploadAsset}>
                  <div className="form-card__header"><CopyPlus size={18} /><strong>Upload asset</strong></div>
                  <label>Asset title<input value={assetUploadForm.title} onChange={(event) => setAssetUploadForm((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>Tags<input value={assetUploadForm.tags} onChange={(event) => setAssetUploadForm((current) => ({ ...current, tags: event.target.value }))} /></label>
                  <label>Image or video file<input type="file" accept="image/*,video/*" onChange={(event) => setAssetUploadFile(event.target.files?.[0] ?? null)} /></label>
                  <button className="primary-button" type="submit" disabled={busyActionId === 'asset-upload'}><ImagePlus size={16} />{busyActionId === 'asset-upload' ? 'Uploading...' : 'Upload to library'}</button>
                </form>
                <article className="insight-card"><div className="insight-card__header"><Layers3 size={18} /><strong>Selected for next brief</strong></div><div className="chip-row">{selectedAssets.length ? selectedAssets.map((asset) => <span key={asset.id} className="chip">{asset.kind}: {asset.title || asset.id}</span>) : <p>Choose assets below to carry them into the next brief.</p>}</div></article>
              </div>
              <div className="asset-grid">
                {assets.map((asset) => (
                  <article key={asset.id} className="asset-card">
                    <div className="asset-card__preview">{asset.kind === 'video' ? asset.preferredUrl ? <video src={asset.preferredUrl} controls /> : <div className="media-placeholder">Video preview unavailable</div> : asset.preferredUrl ? <img src={asset.preferredUrl} alt={asset.title || asset.originalName || 'Asset'} /> : <div className="media-placeholder">Image preview unavailable</div>}</div>
                    <div className="asset-card__body">
                      <div className="post-card__meta"><StatusPill label={asset.editorStatus} /><StatusPill label={asset.kind} /></div>
                      <h3>{asset.title || asset.originalName || 'Untitled asset'}</h3>
                      <div className="field-grid field-grid--two">
                        <label>Preset<select value={assetEditDrafts[asset.id]?.preset ?? 'square'} onChange={(event) => setAssetEditDrafts((current) => ({ ...current, [asset.id]: { preset: event.target.value as 'square' | 'story' | 'reel', overlayText: current[asset.id]?.overlayText ?? asset.title ?? 'ReemTeam Highlight' } }))}><option value="square">Square</option><option value="story">Story</option><option value="reel">Reel</option></select></label>
                        <label>Overlay text<input value={assetEditDrafts[asset.id]?.overlayText ?? ''} onChange={(event) => setAssetEditDrafts((current) => ({ ...current, [asset.id]: { preset: current[asset.id]?.preset ?? 'square', overlayText: event.target.value } }))} /></label>
                      </div>
                      <div className="post-card__actions">
                        <button className="mini-button" onClick={() => void runBusy(`asset-edit:${asset.id}`, async () => { await dashboardApi.autoEditAsset(asset.id, assetEditDrafts[asset.id]); input.setGlobalToast({ type: 'success', message: 'Asset auto-edited.' }); await refreshAll(); })} disabled={busyActionId === `asset-edit:${asset.id}`}><Sparkles size={16} />{busyActionId === `asset-edit:${asset.id}` ? 'Editing...' : 'Auto-edit'}</button>
                        <button className={`mini-button ${selectedAssetIds.includes(asset.id) ? 'mini-button--accent' : ''}`} onClick={() => setSelectedAssetIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])}><Send size={16} />{selectedAssetIds.includes(asset.id) ? 'Selected' : 'Use in brief'}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="referrals" title="Referrals" subtitle="Run the growth loop beside the content engine">
            <div className="split-grid">
              <div className="stack">
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-create', async () => { await dashboardApi.createReferral(referralCreateUserId); setReferralCreateUserId(''); input.setGlobalToast({ type: 'success', message: 'Referral code created.' }); await refreshAll(); }); }}><div className="form-card__header"><CopyPlus size={18} /><strong>Create referral code</strong></div><label>Owner user ID<input value={referralCreateUserId} onChange={(event) => setReferralCreateUserId(event.target.value)} required /></label><button className="primary-button" type="submit" disabled={busyActionId === 'referral-create'}><Users size={16} />{busyActionId === 'referral-create' ? 'Creating...' : 'Create code'}</button></form>
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-invite', async () => { await dashboardApi.createInvite(inviteForm.code, inviteForm.invitedUserId); setInviteForm({ code: '', invitedUserId: '' }); input.setGlobalToast({ type: 'success', message: 'Invite recorded.' }); await refreshAll(); }); }}><div className="form-card__header"><Send size={18} /><strong>Record invite</strong></div><label>Referral code<input value={inviteForm.code} onChange={(event) => setInviteForm((current) => ({ ...current, code: event.target.value }))} required /></label><label>Invited user ID<input value={inviteForm.invitedUserId} onChange={(event) => setInviteForm((current) => ({ ...current, invitedUserId: event.target.value }))} required /></label><button className="primary-button" type="submit" disabled={busyActionId === 'referral-invite'}><Send size={16} />{busyActionId === 'referral-invite' ? 'Saving...' : 'Record invite'}</button></form>
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-reward', async () => { await dashboardApi.rewardInvite(rewardForm.code, rewardForm.invitedUserId, Number(rewardForm.rewardCents || 0)); setRewardForm({ code: '', invitedUserId: '', rewardCents: '500' }); input.setGlobalToast({ type: 'success', message: 'Referral reward applied.' }); await refreshAll(); }); }}><div className="form-card__header"><Gift size={18} /><strong>Apply reward</strong></div><div className="field-grid field-grid--two"><label>Referral code<input value={rewardForm.code} onChange={(event) => setRewardForm((current) => ({ ...current, code: event.target.value }))} required /></label><label>Invited user ID<input value={rewardForm.invitedUserId} onChange={(event) => setRewardForm((current) => ({ ...current, invitedUserId: event.target.value }))} required /></label></div><label>Reward cents<input type="number" value={rewardForm.rewardCents} onChange={(event) => setRewardForm((current) => ({ ...current, rewardCents: event.target.value }))} /></label><button className="primary-button" type="submit" disabled={busyActionId === 'referral-reward'}><Gift size={16} />{busyActionId === 'referral-reward' ? 'Applying...' : 'Reward invite'}</button></form>
              </div>
              <div className="referral-table">{referrals.map((referral) => <article key={referral.id} className="referral-row"><div><strong>{referral.code}</strong><p>{referral.ownerUserId}</p></div><div><span>Invites</span><strong>{referral.inviteCount}</strong></div><div><span>Rewarded</span><strong>{referral.rewardedCount}</strong></div><div><span>Credits</span><strong>{fmtMoney(referral.walletCreditsAwarded / 100)}</strong></div></article>)}</div>
            </div>
          </SectionPanel>
        </main>

        <aside className="detail-rail">
          <div className="detail-rail__header"><p>Operator detail rail</p><strong>{selectedVariant ? 'Selected variant' : selectedIdea ? 'Selected idea' : 'Choose a record'}</strong></div>
          <div className="detail-rail__content">
            {selectedVariant ? (
              <>
                <div className="detail-hero"><StatusPill label={selectedVariant.status} /><h3>{selectedVariant.hook}</h3><p>{selectedVariant.caption}</p></div>
                <div className="detail-block"><span>Overlay</span><strong>{selectedVariant.overlayText}</strong></div>
                <div className="detail-block"><span>Hashtags</span><div className="chip-row">{selectedVariant.hashtags.map((hashtag) => <span key={hashtag} className="chip">{hashtag}</span>)}</div></div>
                <div className="detail-block"><span>Schedule</span><p>Selected job: {selectedJob ? `${selectedJob.platform} / ${fmtDate(selectedJob.scheduledFor)}` : 'Choose a publishing job above.'}</p></div>
              </>
            ) : (
              <div className="detail-empty"><strong>No item selected</strong><p>Choose an idea or variant in the dashboard to inspect the details here.</p></div>
            )}
            <div className="detail-block"><span>Implementation spec</span><p>{spec?.system.name || 'Spec unavailable'}</p><div className="chip-row"><span className="chip">{spec?.mongoSchemas.length ?? 0} schemas</span><span className="chip">{spec?.apiRoutes.length ?? 0} routes</span><span className="chip">{spec?.workerFlow.length ?? 0} worker flows</span></div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
