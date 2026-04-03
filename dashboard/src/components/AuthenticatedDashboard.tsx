import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarRange,
  Gauge,
  ImagePlus,
  Layers3,
  Library,
  LogOut,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users
} from 'lucide-react';
import { dashboardApi, extractApiError, isUnauthorizedError } from '../lib/api';
import {
  AssetRecord,
  CalendarView,
  CommandCenterView,
  GrowthLoopsView,
  LibraryView,
  MediaDiagnosticsView,
  OperatorRecord,
  OperatorSettingsRecord,
  OpportunityRecord,
  PerformanceView,
  PipelineView,
  SystemHealthView
} from '../lib/types';
import { SectionPanel } from './SectionPanel';
import { StatCard } from './StatCard';
import { StatusPill } from './StatusPill';

const navItems = ['Command Center', 'Opportunities', 'Pipeline', 'Calendar', 'Performance', 'Library', 'Growth Loops', 'Settings'];
const fmtDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
    : 'Not set';
const fmtCompact = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const toLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type DashboardToast = { type: 'success' | 'error'; message: string } | null;

export function AuthenticatedDashboard(input: {
  operator: OperatorRecord;
  onLogout: () => Promise<void>;
  globalToast: DashboardToast;
  setGlobalToast: (toast: DashboardToast) => void;
}) {
  const [commandCenter, setCommandCenter] = useState<CommandCenterView | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [pipeline, setPipeline] = useState<PipelineView | null>(null);
  const [calendar, setCalendar] = useState<CalendarView | null>(null);
  const [performance, setPerformance] = useState<PerformanceView | null>(null);
  const [library, setLibrary] = useState<LibraryView | null>(null);
  const [growthLoops, setGrowthLoops] = useState<GrowthLoopsView | null>(null);
  const [settings, setSettings] = useState<OperatorSettingsRecord | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthView | null>(null);
  const [mediaDiagnostics, setMediaDiagnostics] = useState<MediaDiagnosticsView | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [selectedContentItemId, setSelectedContentItemId] = useState('');
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [assetUploadForm, setAssetUploadForm] = useState({ title: '', tags: '' });
  const [assetUploadFile, setAssetUploadFile] = useState<File | null>(null);
  const [assetEditDrafts, setAssetEditDrafts] = useState<Record<string, { preset: 'square' | 'story' | 'reel'; overlayText: string }>>({});
  const [variantCount, setVariantCount] = useState('3');
  const [referralCreateUserId, setReferralCreateUserId] = useState('');
  const [inviteForm, setInviteForm] = useState({ code: '', invitedUserId: '' });
  const [rewardForm, setRewardForm] = useState({ code: '', invitedUserId: '', rewardCents: '500' });
  const [busyActionId, setBusyActionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      const [
        commandCenterData,
        opportunitiesData,
        pipelineData,
        calendarData,
        performanceData,
        libraryData,
        growthLoopsData,
        settingsData,
        systemHealthData,
        mediaDiagnosticsData
      ] = await Promise.all([
        dashboardApi.getCommandCenter(),
        dashboardApi.getOpportunities(),
        dashboardApi.getPipeline(),
        dashboardApi.getCalendar(),
        dashboardApi.getPerformance(),
        dashboardApi.getLibrary(),
        dashboardApi.getGrowthLoops(),
        dashboardApi.getSettings(),
        dashboardApi.getSystemHealth(),
        dashboardApi.getMediaDiagnostics()
      ]);

      setCommandCenter(commandCenterData);
      setOpportunities(opportunitiesData);
      setPipeline(pipelineData);
      setCalendar(calendarData);
      setPerformance(performanceData);
      setLibrary(libraryData);
      setGrowthLoops(growthLoopsData);
      setSettings(settingsData);
      setSystemHealth(systemHealthData);
      setMediaDiagnostics(mediaDiagnosticsData);
      setScheduleDrafts((current) =>
        Object.fromEntries(pipelineData.items.map((item) => [item.id, current[item.id] || toLocal(item.schedule.scheduledFor)]))
      );
      setAssetEditDrafts((current) =>
        Object.fromEntries(
          (libraryData.assets as AssetRecord[]).map((asset) => [
            asset.id,
            current[asset.id] || { preset: 'square', overlayText: asset.title || 'ReemTeam Highlight' }
          ])
        )
      );

      if (!selectedOpportunityId && opportunitiesData[0]) setSelectedOpportunityId(opportunitiesData[0].id);
      if (!selectedContentItemId && pipelineData.items[0]) setSelectedContentItemId(pipelineData.items[0].id);
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
  }, []);

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

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? opportunities[0] ?? null;
  const selectedContentItem = pipeline?.items.find((item) => item.id === selectedContentItemId) ?? pipeline?.items[0] ?? null;
  const currentAssets = (library?.assets as AssetRecord[] | undefined) ?? [];
  const topHealthSummary = useMemo(() => {
    if (!systemHealth) return [];
    return [
      { label: 'Backend', status: systemHealth.backendConnectivity.status },
      { label: 'Redis', status: systemHealth.redis.status },
      { label: 'Media Queue', status: systemHealth.mediaQueue.status },
      { label: 'Publishing', status: systemHealth.publishingQueue.status }
    ];
  }, [systemHealth]);

  const createContentItem = async (opportunityId: string) => {
    await runBusy(`create-item:${opportunityId}`, async () => {
      const item = await dashboardApi.createContentItemFromOpportunity(opportunityId);
      setSelectedContentItemId(item.id);
      input.setGlobalToast({ type: 'success', message: 'Content item drafted from opportunity.' });
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
      input.setGlobalToast({ type: 'success', message: 'Asset uploaded to the library.' });
      await refreshAll();
    });
  };

  const selectedVariant = selectedContentItem?.selectedVariant;

  return (
    <div className="app-shell">
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      {input.globalToast ? <div className={`toast toast--${input.globalToast.type}`}>{input.globalToast.message}</div> : null}
      <div className="dashboard-shell dashboard-shell--assistant">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-block__eyebrow">ReemGrowth Engine</span>
            <h1>Operator Assistant</h1>
            <p>Detect, recommend, create, approve, publish, and learn from live ReemTeam gameplay.</p>
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
            <p>Mode</p>
            <strong>{settings?.mode || 'assisted'}</strong>
            <div className="chip-row">
              {topHealthSummary.map((entry) => (
                <span key={entry.label} className="chip">
                  {entry.label}: {entry.status}
                </span>
              ))}
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                void runBusy('sync-intelligence', async () => {
                  await dashboardApi.syncIntelligence({ mode: 'sync' });
                  input.setGlobalToast({ type: 'success', message: 'Live backend intelligence synced.' });
                  await refreshAll();
                })
              }
              disabled={busyActionId === 'sync-intelligence'}
            >
              <RefreshCw size={16} />
              {busyActionId === 'sync-intelligence' ? 'Syncing...' : 'Sync backend feed'}
            </button>
            <button className="ghost-button" onClick={() => void runBusy('logout', input.onLogout)} disabled={busyActionId === 'logout'}>
              <LogOut size={16} />
              {busyActionId === 'logout' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </aside>

        <main className="main-column">
          <section className="hero hero--command">
            <div>
              <span className="hero__eyebrow">Command Center</span>
              <h2>What matters now, what is ready next, and what needs operator attention.</h2>
              <p>The dashboard is organized around decisions now, not internal records. Opportunities become content items, content items become approved posts, and the system keeps worker and media health in view the whole time.</p>
            </div>
            <div className="hero__chip-grid">
              <div><span>Opportunities</span><strong>{opportunities.length}</strong></div>
              <div><span>Needs review</span><strong>{commandCenter?.needsReview.length ?? 0}</strong></div>
              <div><span>Scheduled</span><strong>{pipeline?.counts.scheduled ?? 0}</strong></div>
              <div><span>Published</span><strong>{pipeline?.counts.published ?? 0}</strong></div>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard eyebrow="Top opportunities" value={String(opportunities.length)} detail="Fresh gameplay moments worth turning into content." icon={<Target size={18} />} tone="accent" />
            <StatCard eyebrow="Needs review" value={String(commandCenter?.needsReview.length ?? 0)} detail="Content items with copy or media waiting on an operator decision." icon={<ShieldCheck size={18} />} tone="warning" />
            <StatCard eyebrow="Ready to post" value={String(commandCenter?.readyToScheduleOrPublish.length ?? 0)} detail="Approved or scheduled items queued for action." icon={<Rocket size={18} />} tone="success" />
            <StatCard eyebrow="Performance signal" value={fmtCompact(performance?.totals.engagement ?? 0)} detail="Recent engagement feeding the strategy engine." icon={<TrendingUp size={18} />} tone="neutral" />
          </section>

          <SectionPanel id="command-center" title="Command Center" subtitle="Recent actions, top opportunities, system health, and operator exceptions">
            <div className="split-grid split-grid--command">
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header"><Target size={18} /><strong>Top Opportunities Today</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.topOpportunitiesToday.map((opportunity) => (
                      <button key={opportunity.id} className="opportunity-compact" onClick={() => setSelectedOpportunityId(opportunity.id)}>
                        <div><StatusPill label={opportunity.urgency} /><strong>{opportunity.headline}</strong></div>
                        <span>{Math.round(opportunity.confidenceScore)}</span>
                      </button>
                    ))}
                  </div>
                </article>
                <article className="insight-card">
                  <div className="insight-card__header"><ShieldCheck size={18} /><strong>Needs Review</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.needsReview.map((item) => (
                      <button key={item.id} className="opportunity-compact" onClick={() => setSelectedContentItemId(item.id)}>
                        <div><StatusPill label={item.stage} /><strong>{item.title}</strong></div>
                        <span>{item.recommendedFormat}</span>
                      </button>
                    ))}
                  </div>
                </article>
              </div>
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header"><CalendarRange size={18} /><strong>Upcoming Scheduled Content</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.upcomingScheduledContent.map((item) => (
                      <div key={item.id} className="compact-row">
                        <div><strong>{item.title}</strong><p>{item.recommendedPlatforms.join(', ')} • {fmtDate(item.schedule.scheduledFor)}</p></div>
                        <StatusPill label={item.stage} />
                      </div>
                    ))}
                  </div>
                </article>
                <article className="insight-card">
                  <div className="insight-card__header"><Gauge size={18} /><strong>System Health</strong></div>
                  <div className="health-grid">
                    {topHealthSummary.map((entry) => <div key={entry.label} className="health-tile"><span>{entry.label}</span><StatusPill label={entry.status} /></div>)}
                  </div>
                  <p>Last sync: {fmtDate(systemHealth?.lastSyncTime)}</p>
                  <p>Last successful media render: {fmtDate(systemHealth?.lastSuccessfulMediaRenderTime)}</p>
                </article>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="opportunities" title="Opportunities" subtitle="Operator-facing ranked opportunities with clear reasons and next actions">
            <div className="opportunity-grid">
              {opportunities.map((opportunity) => (
                <article key={opportunity.id} className={`opportunity-card ${selectedOpportunity?.id === opportunity.id ? 'opportunity-card--selected' : ''}`} onClick={() => setSelectedOpportunityId(opportunity.id)}>
                  <div className="post-card__meta"><StatusPill label={opportunity.urgency} /><StatusPill label={opportunity.opportunityType} /><StatusPill label={opportunity.operatorStatus} /></div>
                  <h3>{opportunity.headline}</h3>
                  <p>{opportunity.whyItMatters}</p>
                  <div className="detail-block"><span>Why am I seeing this?</span><strong>{opportunity.whyAmISeeingThis}</strong></div>
                  <div className="field-grid field-grid--two">
                    <div className="mini-stat"><span>Recommended angle</span><strong>{opportunity.recommendedContentAngle}</strong></div>
                    <div className="mini-stat"><span>Format</span><strong>{opportunity.recommendedFormat}</strong></div>
                    <div className="mini-stat"><span>Platforms</span><strong>{opportunity.recommendedPlatforms.join(', ')}</strong></div>
                    <div className="mini-stat"><span>Potential</span><strong>{Math.round(opportunity.estimatedValue)}</strong></div>
                  </div>
                  <div className="chip-row">
                    {opportunity.sourceSignals.map((signal) => <span key={signal.id} className="chip">{signal.player} • {signal.type.replace(/_/g, ' ')}</span>)}
                  </div>
                  <div className="post-card__actions">
                    <button className="mini-button mini-button--accent" onClick={(event) => { event.stopPropagation(); void createContentItem(opportunity.id); }} disabled={busyActionId === `create-item:${opportunity.id}`}><Sparkles size={16} />Create Post</button>
                    <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`save-op:${opportunity.id}`, async () => { await dashboardApi.saveOpportunityForLater(opportunity.id); input.setGlobalToast({ type: 'success', message: 'Opportunity saved for later.' }); await refreshAll(); }); }}><Save size={16} />Save for Later</button>
                    <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`dismiss-op:${opportunity.id}`, async () => { await dashboardApi.dismissOpportunity(opportunity.id); input.setGlobalToast({ type: 'success', message: 'Opportunity dismissed.' }); await refreshAll(); }); }}><Send size={16} />Dismiss</button>
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel id="pipeline" title="Pipeline" subtitle="One operator-facing pipeline from draft to scheduled post">
            <div className="kanban-grid">
              {pipeline?.columns.map((column) => (
                <div key={column.id} className="kanban-column">
                  <div className="kanban-column__header"><strong>{column.label}</strong><span>{column.items.length}</span></div>
                  <div className="stack stack--tight">
                    {column.items.map((item) => (
                      <button key={item.id} className={`kanban-card ${selectedContentItem?.id === item.id ? 'kanban-card--selected' : ''}`} onClick={() => setSelectedContentItemId(item.id)}>
                        <div className="post-card__meta"><StatusPill label={item.stage} /><StatusPill label={item.recommendedFormat} /></div>
                        <strong>{item.title}</strong>
                        <p>{item.strategyAngle}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pipeline-table">
              {pipeline?.items.map((item) => (
                <button key={item.id} className={`pipeline-row ${selectedContentItem?.id === item.id ? 'pipeline-row--selected' : ''}`} onClick={() => setSelectedContentItemId(item.id)}>
                  <div><strong>{item.title}</strong><p>{item.opportunityType.replace(/_/g, ' ')}</p></div>
                  <div><span>Stage</span><StatusPill label={item.stage} /></div>
                  <div><span>Media</span><strong>{item.selectedVariant?.media.status || 'pending'}</strong></div>
                  <div><span>Schedule</span><strong>{fmtDate(item.schedule.scheduledFor)}</strong></div>
                </button>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel id="calendar" title="Calendar" subtitle="Scheduled and published content by day">
            <div className="calendar-grid">
              {calendar?.days.map((day) => (
                <article key={day.date} className="calendar-day">
                  <div className="calendar-day__header"><strong>{day.date}</strong><span>{day.items.length}</span></div>
                  {day.items.map((entry) => (
                    <div key={entry.id} className="calendar-entry">
                      <div><strong>{entry.title}</strong><p>{fmtDate(entry.scheduledFor || entry.publishedAt)}</p></div>
                      <div className="chip-row">{entry.platformBadges.map((platform) => <span key={platform} className="chip">{platform}</span>)}</div>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel id="performance" title="Performance" subtitle="What is working, what is not, and what to do next">
            <div className="stats-grid stats-grid--three">
              <StatCard eyebrow="Engagement" value={fmtCompact(performance?.totals.engagement ?? 0)} detail="Likes, comments, and shares flowing back in." icon={<Activity size={18} />} tone="accent" />
              <StatCard eyebrow="Signups" value={fmtCompact(performance?.totals.signups ?? 0)} detail="Conversion outcomes tied to published content." icon={<Users size={18} />} tone="success" />
              <StatCard eyebrow="Conversion influence" value={fmtCompact(performance?.totals.conversionInfluence ?? 0)} detail="Weighted downstream impact across the live pipeline." icon={<TrendingUp size={18} />} tone="warning" />
            </div>
            <div className="split-grid">
              <article className="insight-card">
                <div className="insight-card__header"><TrendingUp size={18} /><strong>Top performers</strong></div>
                {performance?.bestPerformers.map((item) => <div key={item.id} className="compact-row"><div><strong>{item.title}</strong><p>{item.opportunityType.replace(/_/g, ' ')}</p></div><span>{item.analyticsSummary.performanceScore.toFixed(1)}</span></div>)}
              </article>
              <article className="insight-card">
                <div className="insight-card__header"><Gauge size={18} /><strong>Recommendations</strong></div>
                <p>{performance?.recommendations.instructions}</p>
                <div className="chip-row">{performance?.bestFormats.map((entry) => <span key={entry.label} className="chip">{entry.label}: {entry.count}</span>)}</div>
                <div className="chip-row">{performance?.bestStoryTypes.map((entry) => <span key={entry.label} className="chip">{entry.label}: {entry.count}</span>)}</div>
              </article>
            </div>
          </SectionPanel>

          <SectionPanel id="library" title="Library" subtitle="Assets, presets, hooks, CTAs, and reusable creative building blocks">
            <div className="split-grid">
              <div className="stack">
                <form className="form-card" onSubmit={uploadAsset}>
                  <div className="form-card__header"><ImagePlus size={18} /><strong>Upload asset</strong></div>
                  <label>Asset title<input value={assetUploadForm.title} onChange={(event) => setAssetUploadForm((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>Tags<input value={assetUploadForm.tags} onChange={(event) => setAssetUploadForm((current) => ({ ...current, tags: event.target.value }))} /></label>
                  <label>Image or video file<input type="file" accept="image/*,video/*" onChange={(event) => setAssetUploadFile(event.target.files?.[0] ?? null)} /></label>
                  <button className="primary-button" type="submit" disabled={busyActionId === 'asset-upload'}><ImagePlus size={16} />{busyActionId === 'asset-upload' ? 'Uploading...' : 'Upload'}</button>
                </form>
                <article className="insight-card">
                  <div className="insight-card__header"><Library size={18} /><strong>Visual presets</strong></div>
                  {library?.visualPresets.map((preset) => (
                    <button key={preset.id} className={`preset-card ${selectedContentItem?.selectedVisualPreset === preset.name ? 'preset-card--selected' : ''}`} onClick={() => selectedContentItem ? void runBusy(`preset:${preset.id}`, async () => { await dashboardApi.selectContentItemVisualPreset(selectedContentItem.id, preset.name); input.setGlobalToast({ type: 'success', message: 'Visual preset updated.' }); await refreshAll(); }) : undefined}>
                      <strong>{preset.name}</strong>
                      <p>{preset.description}</p>
                    </button>
                  ))}
                </article>
              </div>
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header"><Sparkles size={18} /><strong>Hooks and CTAs</strong></div>
                  <div className="chip-row">{library?.hookPatterns.map((entry) => <span key={entry.id} className="chip">{entry.hook}</span>)}</div>
                  <div className="chip-row">{library?.ctaTemplates.map((entry) => <span key={entry.id} className="chip">{entry.cta}</span>)}</div>
                </article>
                <div className="asset-grid asset-grid--library">
                  {currentAssets.map((asset) => (
                    <article key={asset.id} className="asset-card">
                      <div className="asset-card__preview">{asset.preferredUrl ? asset.kind === 'video' ? <video src={asset.preferredUrl} controls /> : <img src={asset.preferredUrl} alt={asset.title || 'Asset'} /> : <div className="media-placeholder">Preview unavailable</div>}</div>
                      <div className="asset-card__body">
                        <div className="post-card__meta"><StatusPill label={asset.editorStatus} /><StatusPill label={asset.kind} /></div>
                        <h3>{asset.title || 'Untitled asset'}</h3>
                        <div className="field-grid field-grid--two">
                          <label>Preset<select value={assetEditDrafts[asset.id]?.preset ?? 'square'} onChange={(event) => setAssetEditDrafts((current) => ({ ...current, [asset.id]: { preset: event.target.value as 'square' | 'story' | 'reel', overlayText: current[asset.id]?.overlayText ?? asset.title ?? 'ReemTeam Highlight' } }))}><option value="square">Square</option><option value="story">Story</option><option value="reel">Reel</option></select></label>
                          <label>Overlay<input value={assetEditDrafts[asset.id]?.overlayText ?? ''} onChange={(event) => setAssetEditDrafts((current) => ({ ...current, [asset.id]: { preset: current[asset.id]?.preset ?? 'square', overlayText: event.target.value } }))} /></label>
                        </div>
                        <button className="mini-button" onClick={() => void runBusy(`asset-edit:${asset.id}`, async () => { await dashboardApi.autoEditAsset(asset.id, assetEditDrafts[asset.id]); input.setGlobalToast({ type: 'success', message: 'Asset auto-edited.' }); await refreshAll(); })}><Sparkles size={16} />Auto-edit</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="growth-loops" title="Growth Loops" subtitle="Referrals and growth automation kept separate from daily publishing decisions">
            <div className="stats-grid stats-grid--three">
              <StatCard eyebrow="Referral codes" value={String(growthLoops?.summary.referralCodes ?? 0)} detail="Active codes in the growth loop." icon={<Users size={18} />} tone="accent" />
              <StatCard eyebrow="Invites" value={String(growthLoops?.summary.totalInvites ?? 0)} detail="Total invites recorded across all codes." icon={<Send size={18} />} tone="success" />
              <StatCard eyebrow="Rewarded" value={String(growthLoops?.summary.totalRewarded ?? 0)} detail="Invites that completed the reward logic." icon={<Sparkles size={18} />} tone="warning" />
            </div>
            <div className="split-grid">
              <div className="stack">
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-create', async () => { await dashboardApi.createReferral(referralCreateUserId); setReferralCreateUserId(''); input.setGlobalToast({ type: 'success', message: 'Referral code created.' }); await refreshAll(); }); }}><div className="form-card__header"><Users size={18} /><strong>Create referral code</strong></div><label>Owner user ID<input value={referralCreateUserId} onChange={(event) => setReferralCreateUserId(event.target.value)} required /></label><button className="primary-button" type="submit">Create</button></form>
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-invite', async () => { await dashboardApi.createInvite(inviteForm.code, inviteForm.invitedUserId); setInviteForm({ code: '', invitedUserId: '' }); input.setGlobalToast({ type: 'success', message: 'Invite recorded.' }); await refreshAll(); }); }}><div className="form-card__header"><Send size={18} /><strong>Record invite</strong></div><label>Referral code<input value={inviteForm.code} onChange={(event) => setInviteForm((current) => ({ ...current, code: event.target.value }))} required /></label><label>Invited user ID<input value={inviteForm.invitedUserId} onChange={(event) => setInviteForm((current) => ({ ...current, invitedUserId: event.target.value }))} required /></label><button className="primary-button" type="submit">Save invite</button></form>
                <form className="form-card" onSubmit={(event) => { event.preventDefault(); void runBusy('referral-reward', async () => { await dashboardApi.rewardInvite(rewardForm.code, rewardForm.invitedUserId, Number(rewardForm.rewardCents || 0)); setRewardForm({ code: '', invitedUserId: '', rewardCents: '500' }); input.setGlobalToast({ type: 'success', message: 'Referral reward applied.' }); await refreshAll(); }); }}><div className="form-card__header"><Sparkles size={18} /><strong>Apply reward</strong></div><label>Referral code<input value={rewardForm.code} onChange={(event) => setRewardForm((current) => ({ ...current, code: event.target.value }))} required /></label><label>Invited user ID<input value={rewardForm.invitedUserId} onChange={(event) => setRewardForm((current) => ({ ...current, invitedUserId: event.target.value }))} required /></label><label>Reward cents<input type="number" value={rewardForm.rewardCents} onChange={(event) => setRewardForm((current) => ({ ...current, rewardCents: event.target.value }))} /></label><button className="primary-button" type="submit">Apply reward</button></form>
              </div>
              <div className="referral-table">
                {growthLoops?.referrals.map((referral) => (
                  <article key={referral.id} className="referral-row"><div><strong>{referral.code}</strong><p>{referral.ownerUserId}</p></div><div><span>Invites</span><strong>{referral.inviteCount}</strong></div><div><span>Rewarded</span><strong>{referral.rewardedCount}</strong></div></article>
                ))}
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="settings" title="Settings" subtitle="Operator mode, system health, diagnostics, and advanced confidence tools">
            <div className="split-grid">
              <div className="stack">
                <article className="insight-card"><div className="insight-card__header"><Settings2 size={18} /><strong>Operator mode</strong></div><div className="chip-row">{(['assisted', 'autopilot', 'manual'] as const).map((mode) => <button key={mode} className={`mini-button ${settings?.mode === mode ? 'mini-button--accent' : ''}`} onClick={() => void runBusy(`mode:${mode}`, async () => { await dashboardApi.updateSettings({ mode }); input.setGlobalToast({ type: 'success', message: `Mode switched to ${mode}.` }); await refreshAll(); })}>{mode}</button>)}</div><p>New users default to Assisted. Autopilot auto-schedules safe items after media succeeds. Manual keeps deeper control in the operator’s hands.</p></article>
                <article className="insight-card"><div className="insight-card__header"><ShieldCheck size={18} /><strong>System health</strong></div><div className="health-list">{systemHealth && Object.entries({ backendConnectivity: systemHealth.backendConnectivity, intelligenceSync: systemHealth.intelligenceSync, mongo: systemHealth.mongo, redis: systemHealth.redis, mediaQueue: systemHealth.mediaQueue, publishingQueue: systemHealth.publishingQueue }).map(([key, value]) => <div key={key} className="compact-row"><div><strong>{key}</strong><p>{value.detail}</p></div><StatusPill label={value.status} /></div>)}</div></article>
              </div>
              <div className="stack">
                <article className="insight-card"><div className="insight-card__header"><Gauge size={18} /><strong>Media diagnostics</strong></div><div className="health-list">{mediaDiagnostics && [{ label: 'Queue', value: mediaDiagnostics.queue.detail, status: mediaDiagnostics.queue.status }, { label: 'FFmpeg', value: mediaDiagnostics.ffmpeg.detail, status: mediaDiagnostics.ffmpeg.status }, { label: 'Canvas', value: mediaDiagnostics.canvas.detail, status: mediaDiagnostics.canvas.status }, { label: 'Last success', value: fmtDate(mediaDiagnostics.lastSuccess), status: 'success' }, { label: 'Last failure', value: mediaDiagnostics.lastFailure.reason || 'None', status: mediaDiagnostics.lastFailure.reason ? 'failed' : 'success' }].map((entry) => <div key={entry.label} className="compact-row"><div><strong>{entry.label}</strong><p>{entry.value}</p></div><StatusPill label={entry.status} /></div>)}</div></article>
                <article className="insight-card"><div className="insight-card__header"><Layers3 size={18} /><strong>Advanced</strong></div><p>Legacy internal routes remain available under <code>/api/v2/*</code> for deeper inspection and compatibility, but the daily workflow stays centered on Command Center, Opportunities, and Pipeline.</p></article>
              </div>
            </div>
          </SectionPanel>
        </main>

        <aside className="detail-rail">
          <div className="detail-rail__header"><p>Review</p><strong>{selectedContentItem ? selectedContentItem.title : selectedOpportunity?.headline || 'Select an item'}</strong></div>
          <div className="detail-rail__content">
            {selectedContentItem ? (
              <>
                <div className="detail-hero">
                  <div className="post-card__meta"><StatusPill label={selectedContentItem.stage} /><StatusPill label={selectedContentItem.operatorMode} /></div>
                  <h3>{selectedContentItem.whyItMatters}</h3>
                  <p>{selectedContentItem.recommendationWhy}</p>
                </div>
                <div className="detail-block"><span>Brief</span><strong>{selectedContentItem.brief?.objective || 'No brief yet'}</strong><p>{selectedContentItem.brief?.hookDirection || selectedContentItem.strategyAngle}</p></div>
                <div className="detail-block"><span>Selected variant</span><strong>{selectedVariant?.hook || 'Choose a variant'}</strong><p>{selectedVariant?.caption || 'Generate copy to build captions and hooks.'}</p><div className="chip-row">{selectedVariant?.hashtags.map((hashtag) => <span key={hashtag} className="chip">{hashtag}</span>)}</div></div>
                <div className="detail-media">{selectedVariant?.media.videoUrl ? <video controls src={selectedVariant.media.videoUrl} /> : selectedVariant?.media.imageUrl ? <img src={selectedVariant.media.imageUrl} alt={selectedVariant.hook} /> : <div className="media-placeholder">Generate media to preview the selected content item.</div>}</div>
                <div className="detail-block"><span>Variants</span><div className="stack stack--tight">{selectedContentItem.variants.map((variant) => <button key={variant.id} className={`mini-button ${selectedContentItem.selectedVariantId === variant.id ? 'mini-button--accent' : ''}`} onClick={() => void runBusy(`select-variant:${variant.id}`, async () => { await dashboardApi.selectContentItemVariant(selectedContentItem.id, variant.id); await refreshAll(); })}>{variant.variantLabel} • {variant.media.status}</button>)}</div></div>
                <div className="detail-block"><span>Schedule</span><p>Best window: {selectedContentItem.schedule.bestTimeWindow || 'Not calculated'}</p><label><input type="datetime-local" value={scheduleDrafts[selectedContentItem.id] ?? ''} onChange={(event) => setScheduleDrafts((current) => ({ ...current, [selectedContentItem.id]: event.target.value }))} /></label></div>
                <div className="detail-block"><span>Performance snapshot</span><strong>{selectedContentItem.analyticsSummary.performanceScore.toFixed(1)}</strong><p>{selectedContentItem.analyticsSummary.clicks} clicks • {selectedContentItem.analyticsSummary.signups} signups • {selectedContentItem.analyticsSummary.conversionInfluence.toFixed(1)} influence</p></div>
                <div className="post-card__actions post-card__actions--stack">
                  <button className="primary-button" onClick={() => void runBusy(`approve:${selectedContentItem.id}`, async () => { await dashboardApi.approveContentItem(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Content item approved.' }); await refreshAll(); })}><ShieldCheck size={16} />Approve</button>
                  <button className="mini-button" onClick={() => void runBusy(`copy:${selectedContentItem.id}`, async () => { await dashboardApi.generateContentItemCopy(selectedContentItem.id, Number(variantCount || 3)); input.setGlobalToast({ type: 'success', message: 'Copy regenerated.' }); await refreshAll(); })}><Sparkles size={16} />Regenerate Copy</button>
                  <button className="mini-button" onClick={() => void runBusy(`media:${selectedContentItem.id}`, async () => { await dashboardApi.generateContentItemMedia(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Media generation queued.' }); await refreshAll(); })}><ImagePlus size={16} />Regenerate Media</button>
                  <button className="mini-button" onClick={() => void runBusy(`draft:${selectedContentItem.id}`, async () => { await dashboardApi.saveContentItemDraft(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Draft saved.' }); await refreshAll(); })}><Save size={16} />Save Draft</button>
                  <button className="mini-button mini-button--accent" onClick={() => void runBusy(`schedule:${selectedContentItem.id}`, async () => { await dashboardApi.scheduleContentItem(selectedContentItem.id, new Date(scheduleDrafts[selectedContentItem.id] || toLocal()).toISOString()); input.setGlobalToast({ type: 'success', message: 'Content item scheduled.' }); await refreshAll(); })}><CalendarRange size={16} />Schedule</button>
                  <button className="mini-button" onClick={() => void runBusy(`publish:${selectedContentItem.id}`, async () => { await dashboardApi.publishContentItemNow(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Content item published.' }); await refreshAll(); })}><Rocket size={16} />Publish Now</button>
                  <button className="mini-button" onClick={() => void runBusy(`archive:${selectedContentItem.id}`, async () => { await dashboardApi.archiveContentItem(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Content item archived.' }); await refreshAll(); })}><Send size={16} />Archive</button>
                </div>
              </>
            ) : selectedOpportunity ? (
              <div className="detail-empty"><strong>{selectedOpportunity.headline}</strong><p>{selectedOpportunity.whyAmISeeingThis}</p></div>
            ) : (
              <div className="detail-empty"><strong>{isLoading ? 'Refreshing workspace' : 'Review panel'}</strong><p>Select a content item to approve, regenerate, schedule, or publish it from one place.</p></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
