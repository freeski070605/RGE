import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Gauge,
  ImagePlus,
  Info,
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
  ContentItemRecord,
  GrowthLoopsView,
  LibraryView,
  MediaDiagnosticsView,
  OperatorRecord,
  OperatorSettingsRecord,
  OpportunityRecord,
  PerformanceView,
  PipelineView,
  SystemIntegrityView,
  SystemHealthView,
  WorkersStatusView
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
const formatDuration = (value?: number | null) =>
  value == null ? 'Not enough data yet' : value >= 60_000 ? `${Math.round(value / 1000 / 60)} min` : `${Math.round(value / 1000)} sec`;
const toLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const isSameDay = (left?: string | null, right = new Date()) => {
  if (!left) return false;
  const date = new Date(left);
  return (
    date.getFullYear() === right.getFullYear() &&
    date.getMonth() === right.getMonth() &&
    date.getDate() === right.getDate()
  );
};

type DashboardToast = { type: 'success' | 'error'; message: string } | null;
type NextBestAction = {
  label: string;
  description: string;
  sectionId: string;
  buttonLabel: string;
  tone: 'accent' | 'warning' | 'danger';
  contentItemId?: string;
  opportunityId?: string;
  action?: 'sync';
};

function EmptyState(input: {
  title: string;
  description: string;
  buttonLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <strong>{input.title}</strong>
      <p>{input.description}</p>
      {input.buttonLabel && input.onClick ? (
        <button className="primary-button" onClick={input.onClick}>
          <ArrowRight size={16} />
          {input.buttonLabel}
        </button>
      ) : null}
    </div>
  );
}

function SectionGuide(input: {
  what: string;
  why: string;
  action: string;
}) {
  return (
    <div className="section-guide">
      <strong>What this is:</strong>
      <span>{input.what}</span>
      <strong>Why it matters:</strong>
      <span>{input.why}</span>
      <strong>What to do:</strong>
      <span>{input.action}</span>
    </div>
  );
}

function HelpHint(input: {
  label: string;
  description: string;
}) {
  return (
    <span className="help-hint" tabIndex={0} aria-label={`${input.label}: ${input.description}`}>
      <Info size={14} />
      <span className="help-hint__bubble">
        <strong>{input.label}</strong>
        <span>{input.description}</span>
      </span>
    </span>
  );
}

function getDraftNextStep(item: ContentItemRecord): {
  label: string;
  description: string;
} {
  const selectedVariant = item.selectedVariant;

  if (selectedVariant?.media.status === 'failed' || item.schedule.lastError) {
    return {
      label: 'Fix the broken render or publish step',
      description: item.schedule.lastError || selectedVariant?.media.errorMessage || 'Review the failure reason, then try the render or schedule again.'
    };
  }

  if (selectedVariant?.media.status === 'queued' || selectedVariant?.media.status === 'processing') {
    return {
      label: 'Wait for media, then review the preview',
      description: 'The render is in progress. Refresh once the job finishes, then approve or adjust the draft.'
    };
  }

  if (!item.variants.length) {
    return {
      label: 'Generate copy options',
      description: 'Create hooks and captions before you decide what to render and approve.'
    };
  }

  if (!selectedVariant || selectedVariant.media.status === 'not_started') {
    return {
      label: 'Render media for the selected draft',
      description: 'Create the image or video preview so you can approve the post with confidence.'
    };
  }

  if (['draft_ready', 'needs_review'].includes(item.stage)) {
    return {
      label: 'Review and approve the draft',
      description: 'Check the story angle, caption, CTA, and visual before moving it to publish.'
    };
  }

  if (item.stage === 'approved') {
    return {
      label: 'Schedule the post or publish now',
      description: 'The draft is approved and ready for a live publishing decision.'
    };
  }

  if (item.stage === 'scheduled') {
    return {
      label: 'Monitor the calendar and queue health',
      description: 'The post is lined up. Keep an eye on timing, worker health, and live delivery.'
    };
  }

  if (item.stage === 'published') {
    return {
      label: 'Review performance and feed the next round',
      description: 'Use this result to sharpen the next opportunity, hook, and timing recommendation.'
    };
  }

  return {
    label: 'Move the draft to the next visible step',
    description: 'The assistant will keep the workflow moving as you complete each decision in order.'
  };
}

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
  const [systemIntegrity, setSystemIntegrity] = useState<SystemIntegrityView | null>(null);
  const [workersStatus, setWorkersStatus] = useState<WorkersStatusView | null>(null);
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
        systemIntegrityData,
        workersStatusData,
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
        dashboardApi.getSystemIntegrity(),
        dashboardApi.getWorkersStatus(),
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
      setSystemIntegrity(systemIntegrityData);
      setWorkersStatus(workersStatusData);
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

  const runSync = async () => {
    await runBusy('sync-intelligence', async () => {
      await dashboardApi.syncIntelligence({ mode: 'sync' });
      input.setGlobalToast({ type: 'success', message: 'Live backend intelligence synced.' });
      await refreshAll();
    });
  };

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? opportunities[0] ?? null;
  const selectedContentItem = pipeline?.items.find((item) => item.id === selectedContentItemId) ?? pipeline?.items[0] ?? null;
  const currentAssets = (library?.assets as AssetRecord[] | undefined) ?? [];
  const navigateToFocus = (sectionId: string, options?: { contentItemId?: string; opportunityId?: string }) => {
    if (options?.contentItemId) {
      setSelectedContentItemId(options.contentItemId);
    }

    if (options?.opportunityId) {
      setSelectedOpportunityId(options.opportunityId);
    }

    if (typeof document !== 'undefined') {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const topHealthSummary = useMemo(() => {
    if (!systemHealth) return [];
    return [
      { label: 'Backend', status: systemHealth.backendConnectivity.status },
      { label: 'Redis', status: systemHealth.redis.status },
      { label: 'Media Queue', status: systemHealth.mediaQueue.status },
      { label: 'Publishing', status: systemHealth.publishingQueue.status }
    ];
  }, [systemHealth]);
  const failedItemCount = useMemo(() => {
    const pipelineFailures =
      pipeline?.items.filter(
        (item) =>
          item.selectedVariant?.media.status === 'failed' ||
          Boolean(item.selectedVariant?.media.errorMessage) ||
          Boolean(item.schedule.lastError)
      ).length ?? 0;

    return Math.max(pipelineFailures, systemIntegrity?.issues.length ?? 0);
  }, [pipeline, systemIntegrity]);
  const globalStatusCounts = useMemo(
    () => ({
      opportunitiesToday: opportunities.length,
      needsReview: commandCenter?.needsReview.length ?? 0,
      readyToPublish: commandCenter?.readyToScheduleOrPublish.length ?? 0,
      scheduledToday: calendar?.entries.filter((entry) => isSameDay(entry.scheduledFor)).length ?? 0,
      failedItems: failedItemCount
    }),
    [calendar, commandCenter, failedItemCount, opportunities.length]
  );
  const firstTimeChecklist = useMemo(
    () => opportunities.length === 0 && (pipeline?.items.length ?? 0) === 0,
    [opportunities.length, pipeline?.items.length]
  );
  const nextBestAction = useMemo<NextBestAction>(() => {
    const criticalIssue = systemIntegrity?.issues.find((issue) => issue.severity === 'critical');
    if (criticalIssue) {
      return {
        label: `${systemIntegrity?.issues.length ?? 1} system issue${(systemIntegrity?.issues.length ?? 1) === 1 ? '' : 's'} need attention`,
        description: criticalIssue.summary,
        sectionId: 'settings',
        buttonLabel: 'Fix failed jobs',
        tone: 'danger'
      };
    }

    const failedItem = pipeline?.items.find(
      (item) =>
        item.selectedVariant?.media.status === 'failed' ||
        Boolean(item.selectedVariant?.media.errorMessage) ||
        Boolean(item.schedule.lastError)
    );
    if (failedItem) {
      return {
        label: '1 media or publishing failure needs a retry',
        description: failedItem.schedule.lastError || failedItem.selectedVariant?.media.errorMessage || failedItem.title,
        sectionId: 'pipeline',
        contentItemId: failedItem.id,
        buttonLabel: 'Open failed item',
        tone: 'danger'
      };
    }

    if ((commandCenter?.needsReview.length ?? 0) > 0) {
      const item = commandCenter?.needsReview[0];
      return {
        label: `${commandCenter?.needsReview.length ?? 0} draft${(commandCenter?.needsReview.length ?? 0) === 1 ? '' : 's'} ready for review`,
        description: 'Review the selected hook, media, and schedule before approving.',
        sectionId: 'pipeline',
        contentItemId: item?.id,
        buttonLabel: 'Review drafts',
        tone: 'warning'
      };
    }

    const mediaReadyItem = pipeline?.items.find(
      (item) => item.selectedVariant?.media.status === 'completed' && ['draft_ready', 'needs_review'].includes(item.stage)
    );
    if (mediaReadyItem) {
      return {
        label: 'Media is ready for approval',
        description: `${mediaReadyItem.title} has a completed render and is ready for operator review.`,
        sectionId: 'pipeline',
        contentItemId: mediaReadyItem.id,
        buttonLabel: 'Approve draft',
        tone: 'warning'
      };
    }

    const openOpportunity = opportunities.find((opportunity) => opportunity.operatorStatus === 'open');
    if (openOpportunity) {
      return {
        label: `${opportunities.filter((opportunity) => opportunity.operatorStatus === 'open').length} high-value opportunities detected`,
        description: 'Turn the strongest gameplay moment into a post draft.',
        sectionId: 'opportunities',
        opportunityId: openOpportunity.id,
        buttonLabel: 'Review opportunities',
        tone: 'accent'
      };
    }

    return {
      label: 'Sync the live ReemTeam feed',
      description: 'Pull fresh gameplay activity so the assistant can rank new opportunities.',
      sectionId: 'command-center',
      buttonLabel: 'Sync now',
      tone: 'accent',
      action: 'sync'
    };
  }, [commandCenter, opportunities, pipeline, systemIntegrity]);

  const createContentItem = async (opportunityId: string) => {
    await runBusy(`create-item:${opportunityId}`, async () => {
      const item = await dashboardApi.createContentItemFromOpportunity(opportunityId);
      setSelectedContentItemId(item.id);
      input.setGlobalToast({ type: 'success', message: 'Draft created from opportunity.' });
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

  const removeAsset = async (asset: AssetRecord) => {
    const assetLabel = asset.title || asset.originalName || 'this asset';
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete ${assetLabel}? This also removes it from linked drafts and library references.`);
      if (!confirmed) {
        return;
      }
    }

    await runBusy(`asset-delete:${asset.id}`, async () => {
      await dashboardApi.deleteAsset(asset.id);
      input.setGlobalToast({ type: 'success', message: `${assetLabel} deleted from the library.` });
      await refreshAll();
    });
  };

  const selectedVariant = selectedContentItem?.selectedVariant;
  const selectedDraftNextStep = selectedContentItem ? getDraftNextStep(selectedContentItem) : null;
  const workflowSteps = selectedContentItem
    ? [
        { label: 'Opportunity', status: 'completed', title: 'Opportunity: detected gameplay moment worth posting.' },
        {
          label: 'Draft',
          status:
            selectedContentItem.variants.length > 0 || ['draft_ready', 'needs_review', 'approved', 'scheduled', 'published'].includes(selectedContentItem.stage)
              ? 'completed'
              : 'current',
          title: 'Draft: hooks and captions are ready to review.'
        },
        {
          label: 'Media',
          status:
            selectedVariant?.media.status === 'completed'
              ? 'completed'
              : selectedVariant?.media.status === 'failed'
                ? 'failed'
                : selectedVariant?.media.status === 'queued' || selectedVariant?.media.status === 'processing'
                  ? 'active'
                  : 'current',
          title: 'Media render: generated preview assets for the selected draft.'
        },
        {
          label: 'Review',
          status: ['needs_review', 'approved', 'scheduled', 'published'].includes(selectedContentItem.stage) ? 'completed' : 'current',
          title: 'Review: operator checks the recommendation, copy, and preview.'
        },
        {
          label: 'Schedule',
          status: ['scheduled', 'published'].includes(selectedContentItem.stage) ? 'completed' : 'current',
          title: 'Schedule: set the post time and platform.'
        },
        {
          label: 'Published',
          status: selectedContentItem.stage === 'published' ? 'completed' : 'current',
          title: 'Published: live post with tracked performance.'
        }
      ]
    : [];
  const operatorWorkflow = [
    {
      label: 'Detect',
      title: 'Find the strongest live moments',
      description: 'Sync gameplay activity and surface the stories worth attention.',
      sectionId: 'command-center',
      icon: <Activity size={16} />
    },
    {
      label: 'Recommend',
      title: 'See the best next move',
      description: 'Rank opportunities with angle, format, urgency, and platform guidance.',
      sectionId: 'opportunities',
      icon: <Sparkles size={16} />
    },
    {
      label: 'Create',
      title: 'Build the draft and creative',
      description: 'Turn a moment into copy, choose the best version, and render media.',
      sectionId: 'pipeline',
      icon: <ImagePlus size={16} />
    },
    {
      label: 'Approve',
      title: 'Check it with confidence',
      description: 'Review the hook, caption, CTA, media, and timing in one place.',
      sectionId: 'pipeline',
      icon: <ShieldCheck size={16} />
    },
    {
      label: 'Publish',
      title: 'Send it live at the right time',
      description: 'Schedule ahead or publish now once the draft is truly ready.',
      sectionId: 'calendar',
      icon: <Rocket size={16} />
    },
    {
      label: 'Learn',
      title: 'Use results to get sharper',
      description: 'Read performance clearly and feed the next round of recommendations.',
      sectionId: 'performance',
      icon: <TrendingUp size={16} />
    }
  ];
  const operatorGlossary = [
    {
      label: 'Opportunity',
      description: 'A ranked gameplay moment the assistant believes is worth turning into a post.'
    },
    {
      label: 'Pipeline',
      description: 'Every post draft from first copy through media, approval, scheduling, and publishing.'
    },
    {
      label: 'Variant',
      description: 'A different hook-and-caption option for the same story angle.'
    },
    {
      label: 'Media Job',
      description: 'The render task that creates preview-ready image or video files for a draft.'
    }
  ];

  return (
    <div className="app-shell">
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      {input.globalToast ? <div className={`toast toast--${input.globalToast.type}`}>{input.globalToast.message}</div> : null}
      <div className="dashboard-shell dashboard-shell--assistant">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-block__eyebrow">ReemGrowth Engine</span>
            <h1>Operator Console</h1>
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
              onClick={() => void runSync()}
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
            <div className="hero__copy">
              <span className="hero__eyebrow">Command Center</span>
              <h2>Run today's content workflow without guesswork.</h2>
              <p>The assistant shows what just happened, what matters most, what is ready next, and whether sync, workers, and media are healthy enough to trust.</p>
              <div className="hero__glossary">
                <span className="hero__meta-label">Quick terms</span>
                <div className="hero__glossary-grid">
                  {operatorGlossary.map((entry) => (
                    <div key={entry.label} className="term-pill">
                      <strong>{entry.label}</strong>
                      <HelpHint label={entry.label} description={entry.description} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="hero__chip-grid">
              <div><span>High-priority moments</span><strong>{opportunities.length}</strong></div>
              <div><span>Review queue</span><strong>{commandCenter?.needsReview.length ?? 0}</strong></div>
              <div><span>Scheduled</span><strong>{pipeline?.counts.scheduled ?? 0}</strong></div>
              <div><span>Published</span><strong>{pipeline?.counts.published ?? 0}</strong></div>
            </div>
          </section>

          <section className="workflow-ribbon" aria-label="Operator workflow">
            {operatorWorkflow.map((step) => (
              <button key={step.label} className="workflow-ribbon__step" onClick={() => navigateToFocus(step.sectionId)}>
                <div className="workflow-ribbon__icon">{step.icon}</div>
                <span>{step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </button>
            ))}
          </section>

          <section className="status-bar">
            {[
              { label: 'Opportunities Today', value: globalStatusCounts.opportunitiesToday, sectionId: 'opportunities' },
              { label: 'Needs Review', value: globalStatusCounts.needsReview, sectionId: 'pipeline' },
              { label: 'Ready to Publish', value: globalStatusCounts.readyToPublish, sectionId: 'pipeline' },
              { label: 'Scheduled Today', value: globalStatusCounts.scheduledToday, sectionId: 'calendar' },
              { label: 'Failed Items', value: globalStatusCounts.failedItems, sectionId: 'settings' }
            ].map((entry) => (
              <button key={entry.label} className="status-bar__item" onClick={() => navigateToFocus(entry.sectionId)}>
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </button>
            ))}
          </section>

          <section className={`next-best-action next-best-action--${nextBestAction.tone}`}>
            <div>
              <span className="hero__eyebrow">Next Best Action</span>
              <h3>{nextBestAction.label}</h3>
              <p>{nextBestAction.description}</p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                if (nextBestAction.action === 'sync') {
                  void runSync();
                  return;
                }

                navigateToFocus(nextBestAction.sectionId, {
                  contentItemId: nextBestAction.contentItemId,
                  opportunityId: nextBestAction.opportunityId
                });
              }}
            >
              <ArrowRight size={16} />
              {nextBestAction.buttonLabel}
            </button>
          </section>

          {firstTimeChecklist ? (
            <section className="assistant-checklist">
              <div>
                <span className="hero__eyebrow">First-Time Mode</span>
                <h3>The shortest path to your first post</h3>
                <p>If you are just starting, follow these steps once. After that, the assistant keeps the rhythm for you.</p>
              </div>
              <div className="assistant-checklist__steps">
                {['Sync data', 'Review opportunities', 'Create a post', 'Generate media', 'Publish'].map((step, index) => (
                  <div key={step} className="assistant-checklist__step">
                    <span>Step {index + 1}</span>
                    <strong>{step}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="stats-grid">
            <StatCard eyebrow="Top opportunities" value={String(opportunities.length)} detail="Fresh moments the assistant believes deserve a post now." icon={<Target size={18} />} tone="accent" />
            <StatCard eyebrow="Needs review" value={String(commandCenter?.needsReview.length ?? 0)} detail="Drafts waiting on a human decision before they move forward." icon={<ShieldCheck size={18} />} tone="warning" />
            <StatCard eyebrow="Ready to post" value={String(commandCenter?.readyToScheduleOrPublish.length ?? 0)} detail="Approved posts with media ready for scheduling or live publishing." icon={<Rocket size={18} />} tone="success" />
            <StatCard eyebrow="Performance signal" value={fmtCompact(performance?.totals.engagement ?? 0)} detail="Recent response shaping what the assistant recommends next." icon={<TrendingUp size={18} />} tone="neutral" />
          </section>

          <SectionPanel
            id="command-center"
            title="Command Center"
            subtitle="Live priorities, review queue, schedule, and system status"
            action={
              <button className="ghost-button" onClick={() => void runSync()} disabled={busyActionId === 'sync-intelligence'}>
                <RefreshCw size={16} />
                {busyActionId === 'sync-intelligence' ? 'Refreshing...' : 'Refresh live activity'}
              </button>
            }
          >
            <SectionGuide
              what="Your live operating snapshot across opportunities, drafts, scheduled posts, and system health."
              why="This is the fastest way to see what changed and what deserves attention first."
              action="Start with the next best action, then clear review items and failures before moving into deeper work."
            />
            <div className="split-grid split-grid--command">
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header"><Target size={18} /><strong>Top Opportunities Today</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.topOpportunitiesToday.length ? commandCenter.topOpportunitiesToday.map((opportunity) => (
                      <button key={opportunity.id} className="opportunity-compact" onClick={() => navigateToFocus('opportunities', { opportunityId: opportunity.id })}>
                        <div><StatusPill label={opportunity.urgency} /><strong>{opportunity.headline}</strong></div>
                        <span>{Math.round(opportunity.confidenceScore)}</span>
                      </button>
                    )) : <div className="empty-state empty-state--compact"><strong>No opportunities yet.</strong><p>Run a sync to detect the next gameplay moment worth posting.</p></div>}
                  </div>
                </article>
                <article className="insight-card">
                  <div className="insight-card__header"><ShieldCheck size={18} /><strong>Needs Review</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.needsReview.length ? commandCenter.needsReview.map((item) => (
                      <button key={item.id} className="opportunity-compact" onClick={() => navigateToFocus('pipeline', { contentItemId: item.id })}>
                        <div><StatusPill label={item.stage} /><strong>{item.title}</strong></div>
                        <span>{item.recommendedFormat}</span>
                      </button>
                    )) : <div className="empty-state empty-state--compact"><strong>No drafts need review.</strong><p>The assistant will place review-ready items here.</p></div>}
                  </div>
                </article>
              </div>
              <div className="stack">
                <article className="insight-card">
                  <div className="insight-card__header"><CalendarRange size={18} /><strong>Upcoming Scheduled Content</strong></div>
                  <div className="stack stack--tight">
                    {commandCenter?.upcomingScheduledContent.length ? commandCenter.upcomingScheduledContent.map((item) => (
                      <div key={item.id} className="compact-row">
                        <div><strong>{item.title}</strong><p>{item.recommendedPlatforms.join(', ')} / {fmtDate(item.schedule.scheduledFor)}</p></div>
                        <StatusPill label={item.stage} />
                      </div>
                    )) : <div className="empty-state empty-state--compact"><strong>Nothing is scheduled yet.</strong><p>Approve a draft and choose a publish window to start filling the calendar.</p></div>}
                  </div>
                </article>
                <article className="insight-card">
                  <div className="insight-card__header"><Gauge size={18} /><strong>System Status</strong></div>
                  <div className="health-grid">
                    <div className="health-tile"><span>Backend</span><StatusPill label={systemIntegrity?.backendConnection || 'error'} /></div>
                    <div className="health-tile"><span>Media</span><StatusPill label={systemIntegrity && Object.values(systemIntegrity.mediaPipeline).every((value) => value === 'ok') ? 'ok' : 'error'} /></div>
                    <div className="health-tile"><span>Workers</span><StatusPill label={workersStatus?.summary.status || 'error'} /></div>
                    <div className="health-tile"><span>Last Sync</span><strong>{fmtDate(systemIntegrity?.lastSync || systemHealth?.lastSyncTime)}</strong></div>
                    <div className="health-tile"><span>Last Media Render</span><strong>{fmtDate(systemIntegrity?.lastSuccessfulMediaJob || systemHealth?.lastSuccessfulMediaRenderTime)}</strong></div>
                  </div>
                  <p>{systemIntegrity?.issues[0]?.summary || 'The workflow integrity checks are currently healthy.'}</p>
                </article>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="opportunities" title="Opportunities" subtitle="Ranked story opportunities with clear reasons, urgency, and next steps">
            <SectionGuide what="High-value gameplay moments detected from live activity." why="These are the fastest paths to timely, high-conviction posts." action="Start with the strongest opportunity, then save or dismiss weaker ones to keep the queue sharp." />
            {opportunities.length ? <div className="opportunity-grid">
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
                    {opportunity.sourceSignals.map((signal) => <span key={signal.id} className="chip">{signal.player} / {signal.type.replace(/_/g, ' ')}</span>)}
                  </div>
                  <div className="post-card__actions">
                    <button className="mini-button mini-button--accent" onClick={(event) => { event.stopPropagation(); void createContentItem(opportunity.id); }} disabled={busyActionId === `create-item:${opportunity.id}`}><Sparkles size={16} />Create Post</button>
                    <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`save-op:${opportunity.id}`, async () => { await dashboardApi.saveOpportunityForLater(opportunity.id); input.setGlobalToast({ type: 'success', message: 'Opportunity saved for later.' }); await refreshAll(); }); }}><Save size={16} />Save for Later</button>
                    <button className="mini-button" onClick={(event) => { event.stopPropagation(); void runBusy(`dismiss-op:${opportunity.id}`, async () => { await dashboardApi.dismissOpportunity(opportunity.id); input.setGlobalToast({ type: 'success', message: 'Opportunity dismissed.' }); await refreshAll(); }); }}><Send size={16} />Dismiss</button>
                  </div>
                </article>
              ))}
            </div> : <EmptyState title="No opportunities yet." description="Start by syncing ReemTeam activity, then the assistant will rank the best moments here." buttonLabel="Sync Now" onClick={() => void runSync()} />}
          </SectionPanel>

          <SectionPanel id="pipeline" title="Pipeline" subtitle="Every post draft from first idea through approval and scheduling">
            <SectionGuide what="Your full post workflow in one place." why="Each draft shows the real state of copy, media, review, and publishing." action="Open a draft, complete the next highlighted step, and keep momentum without jumping across tools." />
            {pipeline?.items.length ? <>
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
                  <div><span>Media</span><StatusPill label={item.selectedVariant?.media.status || 'not_started'} /></div>
                  <div><span>Schedule</span><strong>{fmtDate(item.schedule.scheduledFor)}</strong></div>
                </button>
              ))}
            </div>
            </> : <EmptyState title="No drafts yet." description="Pick an opportunity and create a post. The pipeline will guide the rest from first draft to publish." buttonLabel="Review Opportunities" onClick={() => navigateToFocus('opportunities')} />}
          </SectionPanel>

          <SectionPanel id="calendar" title="Calendar" subtitle="Your publishing plan by day, status, and platform">
            <SectionGuide what="A clear view of what is scheduled or already live." why="It helps you space posts well, spot gaps, and avoid timing collisions." action="Check today's queue, confirm timing, and make sure approved drafts land in the right windows." />
            {calendar?.days.length ? <div className="calendar-grid">
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
            </div> : <EmptyState title="No calendar entries yet." description="Approve a draft and schedule it. Scheduled posts will appear here by day." buttonLabel="Open Pipeline" onClick={() => navigateToFocus('pipeline')} />}
          </SectionPanel>

          <SectionPanel id="performance" title="Performance" subtitle="What is winning, what is slipping, and what to do next">
            <SectionGuide what="Results from live posts and patterns the assistant is learning." why="This is where the system gets smarter about hooks, formats, timing, and story types." action="Lean into what is outperforming, and use underperformance to adjust the next batch of drafts." />
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

          <SectionPanel id="library" title="Library" subtitle="Reusable creative ingredients for faster, better posts">
            <SectionGuide what="Reusable creative resources for faster post production." why="The best operators build repeatable visual and copy patterns." action="Upload source assets, then reuse presets and hooks instead of starting from scratch." />
            <div className="split-grid">
              <div className="stack">
                <form className="form-card" onSubmit={uploadAsset}>
                  <div className="form-card__header"><ImagePlus size={18} /><strong>Add asset</strong></div>
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
                  <div className="insight-card__header"><Sparkles size={18} /><strong>Winning hooks and CTAs</strong></div>
                  <div className="chip-row">{library?.hookPatterns.map((entry) => <span key={entry.id} className="chip">{entry.hook}</span>)}</div>
                  <div className="chip-row">{library?.ctaTemplates.map((entry) => <span key={entry.id} className="chip">{entry.cta}</span>)}</div>
                </article>
                <div className="asset-grid asset-grid--library">
                  {currentAssets.length === 0 ? <div className="empty-state empty-state--compact"><strong>No assets yet.</strong><p>Upload an image or video so the assistant has real media to work with.</p></div> : null}
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
                        <div className="post-card__actions">
                          <button className="mini-button" onClick={() => void runBusy(`asset-edit:${asset.id}`, async () => { await dashboardApi.autoEditAsset(asset.id, assetEditDrafts[asset.id]); input.setGlobalToast({ type: 'success', message: 'Asset auto-edited.' }); await refreshAll(); })} disabled={busyActionId === `asset-edit:${asset.id}`}><Sparkles size={16} />{busyActionId === `asset-edit:${asset.id}` ? 'Editing...' : 'Auto-edit'}</button>
                          <button className="mini-button mini-button--danger" onClick={() => void removeAsset(asset)} disabled={busyActionId === `asset-delete:${asset.id}`}><AlertTriangle size={16} />{busyActionId === `asset-delete:${asset.id}` ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="growth-loops" title="Growth Loops" subtitle="Referral workflows and invite momentum separate from daily posting">
            <SectionGuide what="Referral and invite workflows that support growth outside the daily content queue." why="This keeps acquisition mechanics available without cluttering the main publishing workflow." action="Use this area when you are running referral pushes, rewards, or invite-based campaigns." />
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
                {growthLoops?.referrals.length ? growthLoops.referrals.map((referral) => (
                  <article key={referral.id} className="referral-row"><div><strong>{referral.code}</strong><p>{referral.ownerUserId}</p></div><div><span>Invites</span><strong>{referral.inviteCount}</strong></div><div><span>Rewarded</span><strong>{referral.rewardedCount}</strong></div></article>
                )) : <div className="empty-state empty-state--compact"><strong>No referral codes yet.</strong><p>Create one when you are ready to run invite-driven growth loops.</p></div>}
              </div>
            </div>
          </SectionPanel>

          <SectionPanel id="settings" title="Settings" subtitle="Modes, health, diagnostics, and confidence tools">
            <SectionGuide what="The control room for operator mode, system health, worker status, and media diagnostics." why="Confidence comes from seeing the machine state clearly, not guessing whether it is working." action="Use this view to confirm health before trusting autopilot or diagnosing anything that failed." />
            <div className="split-grid">
              <div className="stack">
                <article className="insight-card"><div className="insight-card__header"><Settings2 size={18} /><strong>Operator mode</strong></div><div className="chip-row">{(['assisted', 'autopilot', 'manual'] as const).map((mode) => <button key={mode} className={`mini-button ${settings?.mode === mode ? 'mini-button--accent' : ''}`} onClick={() => void runBusy(`mode:${mode}`, async () => { await dashboardApi.updateSettings({ mode }); input.setGlobalToast({ type: 'success', message: `Mode switched to ${mode}.` }); await refreshAll(); })}>{mode}</button>)}</div><p>New users default to Assisted. Autopilot auto-schedules safe items after media succeeds. Manual keeps deeper control in the operator's hands.</p></article>
                <article className="insight-card"><div className="insight-card__header"><ShieldCheck size={18} /><strong>System health</strong></div><div className="health-list">{systemHealth && Object.entries({ backendConnectivity: systemHealth.backendConnectivity, intelligenceSync: systemHealth.intelligenceSync, mongo: systemHealth.mongo, redis: systemHealth.redis, mediaQueue: systemHealth.mediaQueue, publishingQueue: systemHealth.publishingQueue }).map(([key, value]) => <div key={key} className="compact-row"><div><strong>{key}</strong><p>{value.detail}</p></div><StatusPill label={value.status} /></div>)}</div></article>
                <article className="insight-card"><div className="insight-card__header"><Users size={18} /><strong>Workers</strong></div><div className="health-list">{workersStatus ? Object.values(workersStatus.workers).map((worker) => <div key={worker.workerName} className="compact-row"><div><strong>{worker.workerName}</strong><p>{worker.detail} / Last heartbeat {fmtDate(worker.lastHeartbeatAt)}</p></div><StatusPill label={worker.status} /></div>) : null}</div></article>
              </div>
              <div className="stack">
                <article className="insight-card"><div className="insight-card__header"><Gauge size={18} /><strong>Media System Health</strong></div><div className="health-list">{mediaDiagnostics && [{ label: 'Queue length', value: String(mediaDiagnostics.queueLength), status: mediaDiagnostics.queue.status }, { label: 'Active jobs', value: String(mediaDiagnostics.activeJobs), status: mediaDiagnostics.processing.status }, { label: 'Failed jobs', value: String(mediaDiagnostics.failedJobs), status: mediaDiagnostics.failedJobs ? 'failed' : 'completed' }, { label: 'Average processing', value: formatDuration(mediaDiagnostics.averageProcessingTimeMs), status: 'completed' }, { label: 'FFmpeg', value: mediaDiagnostics.ffmpeg.detail, status: mediaDiagnostics.ffmpeg.status }, { label: 'Canvas', value: mediaDiagnostics.canvas.detail, status: mediaDiagnostics.canvas.status }, { label: 'Output directory', value: mediaDiagnostics.output.detail, status: mediaDiagnostics.output.status }, { label: 'Serving', value: mediaDiagnostics.serving.detail, status: mediaDiagnostics.serving.status }, { label: 'Last success', value: fmtDate(mediaDiagnostics.lastSuccess), status: 'completed' }, { label: 'Last failure', value: mediaDiagnostics.lastFailure.reason || 'None', status: mediaDiagnostics.lastFailure.reason ? 'failed' : 'completed' }].map((entry) => <div key={entry.label} className="compact-row"><div><strong>{entry.label}</strong><p>{entry.value}</p></div><StatusPill label={entry.status} /></div>)}</div></article>
                <article className="insight-card"><div className="insight-card__header"><AlertTriangle size={18} /><strong>System Integrity Issues</strong></div><div className="health-list">{systemIntegrity?.issues.length ? systemIntegrity.issues.slice(0, 8).map((issue) => <div key={`${issue.code}-${issue.entityId || issue.detectedAt}`} className="issue-card"><div><StatusPill label={issue.severity === 'critical' ? 'failed' : 'needs_review'} /><strong>{issue.summary}</strong><p>{issue.details || issue.action || 'Review this issue in the relevant workflow step.'}</p></div>{issue.entityType === 'content_item' && issue.entityId ? <button className="mini-button" onClick={() => navigateToFocus('pipeline', { contentItemId: issue.entityId || undefined })}>Open Draft</button> : null}</div>) : <div className="empty-state empty-state--compact"><strong>No integrity issues detected.</strong><p>The assistant is not seeing broken workflow steps right now.</p></div>}</div></article>
                <article className="insight-card"><div className="insight-card__header"><Layers3 size={18} /><strong>Advanced</strong></div><p>Legacy internal routes remain available under <code>/api/v2/*</code> for deeper inspection and compatibility, but the daily workflow stays centered on Command Center, Opportunities, and Pipeline.</p></article>
              </div>
            </div>
          </SectionPanel>
        </main>

        <aside className="detail-rail">
          <div className="detail-rail__header"><p>Review Queue</p><strong>{selectedContentItem ? selectedContentItem.title : selectedOpportunity?.headline || 'Select a draft'}</strong></div>
          <div className="detail-rail__content">
            {selectedContentItem ? (
              <>
                <div className="detail-hero">
                  <div className="post-card__meta"><StatusPill label={selectedContentItem.stage} /><StatusPill label={selectedContentItem.operatorMode} /></div>
                  <h3>{selectedContentItem.whyItMatters}</h3>
                  <p>{selectedContentItem.recommendationWhy}</p>
                </div>
                {selectedDraftNextStep ? <div className="detail-block detail-block--next"><span>Next step</span><strong>{selectedDraftNextStep.label}</strong><p>{selectedDraftNextStep.description}</p></div> : null}
                <div className="workflow-tracker">
                  {workflowSteps.map((step) => (
                    <button key={step.label} className={`workflow-step workflow-step--${step.status}`} title={step.title}>
                      <span>{step.label}</span>
                    </button>
                  ))}
                </div>
                {selectedVariant?.media.errorMessage || selectedContentItem.schedule.lastError ? <div className="failure-banner"><div><strong>Failure visible</strong><p>{selectedContentItem.schedule.lastError || selectedVariant?.media.errorMessage}</p></div><button className="mini-button mini-button--accent" onClick={() => void runBusy(`media:${selectedContentItem.id}`, async () => { await dashboardApi.generateContentItemMedia(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Media render queued again.' }); await refreshAll(); })}>Render Again</button></div> : null}
                <div className="detail-block"><span>Brief</span><strong>{selectedContentItem.brief?.objective || 'No brief yet'}</strong><p>{selectedContentItem.brief?.hookDirection || selectedContentItem.strategyAngle}</p></div>
                <div className="detail-block"><span>Selected version</span><strong>{selectedVariant?.hook || 'Choose a version'}</strong><p>{selectedVariant?.caption || 'Generate copy to build hooks and captions.'}</p><div className="chip-row">{selectedVariant?.hashtags.map((hashtag) => <span key={hashtag} className="chip">{hashtag}</span>)}</div></div>
                <div className="detail-media">{selectedVariant?.media.videoUrl ? <video controls src={selectedVariant.media.videoUrl} /> : selectedVariant?.media.imageUrl ? <img src={selectedVariant.media.imageUrl} alt={selectedVariant.hook} /> : <div className="media-placeholder">Render media to preview this post before approval.</div>}</div>
                <div className="detail-block"><span>Versions</span><div className="stack stack--tight">{selectedContentItem.variants.map((variant) => <button key={variant.id} className={`mini-button ${selectedContentItem.selectedVariantId === variant.id ? 'mini-button--accent' : ''}`} onClick={() => void runBusy(`select-variant:${variant.id}`, async () => { await dashboardApi.selectContentItemVariant(selectedContentItem.id, variant.id); await refreshAll(); })}>{variant.variantLabel} / {variant.media.status}</button>)}</div></div>
                <div className="detail-block"><span>Schedule</span><p>Best window: {selectedContentItem.schedule.bestTimeWindow || 'Not calculated'}</p><label><input type="datetime-local" value={scheduleDrafts[selectedContentItem.id] ?? ''} onChange={(event) => setScheduleDrafts((current) => ({ ...current, [selectedContentItem.id]: event.target.value }))} /></label></div>
                <div className="detail-block"><span>Performance snapshot</span><strong>{selectedContentItem.analyticsSummary.performanceScore.toFixed(1)}</strong><p>{selectedContentItem.analyticsSummary.clicks} clicks / {selectedContentItem.analyticsSummary.signups} signups / {selectedContentItem.analyticsSummary.conversionInfluence.toFixed(1)} influence</p></div>
                <div className="post-card__actions post-card__actions--stack">
                  <button className="primary-button" onClick={() => void runBusy(`approve:${selectedContentItem.id}`, async () => { await dashboardApi.approveContentItem(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Draft approved.' }); await refreshAll(); })}><ShieldCheck size={16} />Approve</button>
                  <button className="mini-button" onClick={() => void runBusy(`copy:${selectedContentItem.id}`, async () => { await dashboardApi.generateContentItemCopy(selectedContentItem.id, Number(variantCount || 3)); input.setGlobalToast({ type: 'success', message: 'Fresh copy options generated.' }); await refreshAll(); })}><Sparkles size={16} />Generate More Copy</button>
                  <button className="mini-button" onClick={() => void runBusy(`media:${selectedContentItem.id}`, async () => { await dashboardApi.generateContentItemMedia(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Media render queued.' }); await refreshAll(); })}><ImagePlus size={16} />Render Media</button>
                  <button className="mini-button" onClick={() => void runBusy(`draft:${selectedContentItem.id}`, async () => { await dashboardApi.saveContentItemDraft(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Draft saved.' }); await refreshAll(); })}><Save size={16} />Save Draft</button>
                  <button className="mini-button mini-button--accent" onClick={() => void runBusy(`schedule:${selectedContentItem.id}`, async () => { await dashboardApi.scheduleContentItem(selectedContentItem.id, new Date(scheduleDrafts[selectedContentItem.id] || toLocal()).toISOString()); input.setGlobalToast({ type: 'success', message: 'Post scheduled.' }); await refreshAll(); })}><CalendarRange size={16} />Schedule Post</button>
                  <button className="mini-button" onClick={() => void runBusy(`publish:${selectedContentItem.id}`, async () => { await dashboardApi.publishContentItemNow(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Post published.' }); await refreshAll(); })}><Rocket size={16} />Publish Now</button>
                  <button className="mini-button" onClick={() => void runBusy(`archive:${selectedContentItem.id}`, async () => { await dashboardApi.archiveContentItem(selectedContentItem.id); input.setGlobalToast({ type: 'success', message: 'Draft archived.' }); await refreshAll(); })}><Send size={16} />Archive Draft</button>
                </div>
              </>
            ) : selectedOpportunity ? (
              <div className="detail-empty"><strong>{selectedOpportunity.headline}</strong><p>{selectedOpportunity.whyAmISeeingThis}</p></div>
            ) : (
              <div className="detail-empty"><strong>{isLoading ? 'Refreshing workspace' : 'Review panel'}</strong><p>Select a draft to approve, render, schedule, or publish it from one place.</p></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
