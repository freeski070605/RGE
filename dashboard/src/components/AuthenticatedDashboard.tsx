import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  ImagePlus,
  Library,
  LogOut,
  RefreshCw,
  Rocket,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users
} from 'lucide-react'
import { dashboardApi, extractApiError, isUnauthorizedError } from '../lib/api'
import {
  CommandCenterView,
  ContentItemRecord,
  GrowthLoopsView,
  HqCribRecord,
  HqEventRecord,
  HqGameIntelligenceSignalRecord,
  HqGrowthPlayRecord,
  HqModuleReadinessView,
  HqTableRecord,
  HqUserRecord,
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
} from '../lib/types'
import { StatusPill } from './StatusPill'

type DashboardToast = { type: 'success' | 'error'; message: string } | null
type WorkspaceTab = 'today' | 'create' | 'review' | 'library' | 'system'
type HqModuleId =
  | 'command_center'
  | 'crm'
  | 'users'
  | 'tables'
  | 'cribs'
  | 'events'
  | 'game_intelligence'
  | 'growth_plays'
  | 'content_studio'
  | 'referrals'
  | 'wallet_ops'
  | 'support'
  | 'analytics'
  | 'system_health'
type DraftActionKey = 'copy' | 'media' | 'approve' | 'schedule' | 'publish' | 'save'

type NextBestAction = {
  label: string
  description: string
  buttonLabel: string
  tone: 'accent' | 'warning' | 'danger'
  tab: WorkspaceTab
  contentItemId?: string
  opportunityId?: string
  action?: 'sync'
}

const fmtDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(value))
    : 'Not set'

const fmtCompact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

const formatDuration = (value?: number | null) =>
  value == null ? 'Not enough data yet' : value >= 60_000 ? `${Math.round(value / 1000 / 60)} min` : `${Math.round(value / 1000)} sec`

const toLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const isSameDay = (left?: string | null, right = new Date()) => {
  if (!left) return false
  const date = new Date(left)
  return (
    date.getFullYear() === right.getFullYear() &&
    date.getMonth() === right.getMonth() &&
    date.getDate() === right.getDate()
  )
}

const getMediaPreview = (variant?: ContentItemRecord['variants'][number] | null) => {
  if (!variant) {
    return null
  }

  if (variant.media.videoUrl) {
    return {
      url: variant.media.videoUrl,
      kind: 'video' as const
    }
  }

  if (variant.media.imageUrl) {
    return {
      url: variant.media.imageUrl,
      kind: 'image' as const
    }
  }

  return null
}

const getDraftNextStep = (item: ContentItemRecord) => {
  const selectedVariant = item.selectedVariant

  if (selectedVariant?.media.status === 'failed' || item.schedule.lastError) {
    return {
      label: 'Fix the failed render or publish step',
      description: item.schedule.lastError || selectedVariant?.media.errorMessage || 'Review the error and run the media step again.'
    }
  }

  if (selectedVariant?.media.status === 'queued' || selectedVariant?.media.status === 'processing') {
    return {
      label: 'Wait for the render, then check the preview',
      description: 'The system is building the asset now. Refresh when it finishes so you can approve with confidence.'
    }
  }

  if (!item.variants.length) {
    return {
      label: 'Generate copy options first',
      description: 'Create a few hook and caption options before picking the winner.'
    }
  }

  if (!selectedVariant || selectedVariant.media.status === 'not_started') {
    return {
      label: 'Render the selected draft',
      description: 'Make the image or video preview appear here before approving the action.'
    }
  }

  if (['draft_ready', 'needs_review'].includes(item.stage)) {
    return {
      label: 'Review and approve this draft',
      description: 'Check the hook, caption, CTA, and preview, then approve it.'
    }
  }

  if (item.stage === 'approved') {
    return {
      label: 'Choose a publish time',
      description: 'The draft is approved, so the next decision is schedule versus publish now.'
    }
  }

  if (item.stage === 'scheduled') {
    return {
      label: 'Monitor the scheduled action',
      description: 'The content is queued. Keep an eye on timing and worker health.'
    }
  }

  if (item.stage === 'published') {
    return {
      label: 'Use the result to guide the next action',
      description: 'Review performance and let the next Growth Play build on what worked.'
    }
  }

  return {
    label: 'Keep the draft moving one step at a time',
    description: 'This workspace keeps every action in sequence so the operator never has to guess.'
  }
}

function EmptyState(input: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}) {
  return (
    <div className="workspace-empty">
      {input.icon ? <div className="workspace-empty__icon">{input.icon}</div> : null}
      <strong>{input.title}</strong>
      <p>{input.description}</p>
      {input.actionLabel && input.onAction ? (
        <button className="primary-button" onClick={input.onAction}>
          <ArrowRight size={16} />
          {input.actionLabel}
        </button>
      ) : null}
    </div>
  )
}

const hqModules: Array<{
  id: HqModuleId
  label: string
  workspace?: WorkspaceTab
}> = [
  { id: 'command_center', label: 'Command Center', workspace: 'today' },
  { id: 'crm', label: 'CRM' },
  { id: 'users', label: 'Users' },
  { id: 'tables', label: 'Tables' },
  { id: 'cribs', label: 'Cribs' },
  { id: 'events', label: 'Events' },
  { id: 'game_intelligence', label: 'Game Intelligence' },
  { id: 'growth_plays', label: 'Growth Plays', workspace: 'create' },
  { id: 'content_studio', label: 'Content Studio', workspace: 'review' },
  { id: 'referrals', label: 'Referrals', workspace: 'system' },
  { id: 'wallet_ops', label: 'Wallet/Ops' },
  { id: 'support', label: 'Support' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'system_health', label: 'System Health', workspace: 'system' }
]

export function AuthenticatedDashboard(input: {
  operator: OperatorRecord
  onLogout: () => Promise<void>
  globalToast: DashboardToast
  setGlobalToast: (toast: DashboardToast) => void
}) {
  const [activeModule, setActiveModule] = useState<HqModuleId>('command_center')
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('today')
  const [moduleReadiness, setModuleReadiness] = useState<HqModuleReadinessView | null>(null)
  const [hqUsers, setHqUsers] = useState<HqUserRecord[]>([])
  const [hqCribs, setHqCribs] = useState<HqCribRecord[]>([])
  const [hqTables, setHqTables] = useState<HqTableRecord[]>([])
  const [hqEvents, setHqEvents] = useState<HqEventRecord[]>([])
  const [hqSignals, setHqSignals] = useState<HqGameIntelligenceSignalRecord[]>([])
  const [hqGrowthPlays, setHqGrowthPlays] = useState<HqGrowthPlayRecord[]>([])
  const [commandCenter, setCommandCenter] = useState<CommandCenterView | null>(null)
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([])
  const [pipeline, setPipeline] = useState<PipelineView | null>(null)
  const [performance, setPerformance] = useState<PerformanceView | null>(null)
  const [library, setLibrary] = useState<LibraryView | null>(null)
  const [growthLoops, setGrowthLoops] = useState<GrowthLoopsView | null>(null)
  const [settings, setSettings] = useState<OperatorSettingsRecord | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealthView | null>(null)
  const [systemIntegrity, setSystemIntegrity] = useState<SystemIntegrityView | null>(null)
  const [workersStatus, setWorkersStatus] = useState<WorkersStatusView | null>(null)
  const [mediaDiagnostics, setMediaDiagnostics] = useState<MediaDiagnosticsView | null>(null)
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('')
  const [selectedContentItemId, setSelectedContentItemId] = useState('')
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({})
  const [assetUploadForm, setAssetUploadForm] = useState({ title: '', tags: '' })
  const [assetUploadFile, setAssetUploadFile] = useState<File | null>(null)
  const [assetEditDrafts, setAssetEditDrafts] = useState<Record<string, { preset: 'square' | 'story' | 'reel'; overlayText: string }>>({})
  const [variantCount, setVariantCount] = useState('3')
  const [referralCreateUserId, setReferralCreateUserId] = useState('')
  const [inviteForm, setInviteForm] = useState({ code: '', invitedUserId: '' })
  const [rewardForm, setRewardForm] = useState({ code: '', invitedUserId: '', rewardCents: '500' })
  const [busyActionId, setBusyActionId] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const refreshAll = async () => {
    setIsLoading(true)
    try {
      const [
        commandCenterData,
        opportunitiesData,
        pipelineData,
        performanceData,
        libraryData,
        growthLoopsData,
        settingsData,
        systemHealthData,
        systemIntegrityData,
        workersStatusData,
        mediaDiagnosticsData,
        moduleReadinessData,
        hqUsersData,
        hqCribsData,
        hqTablesData,
        hqEventsData,
        hqSignalsData,
        hqGrowthPlaysData
      ] = await Promise.all([
        dashboardApi.getCommandCenter(),
        dashboardApi.getOpportunities(),
        dashboardApi.getPipeline(),
        dashboardApi.getPerformance(),
        dashboardApi.getLibrary(),
        dashboardApi.getGrowthLoops(),
        dashboardApi.getSettings(),
        dashboardApi.getSystemHealth(),
        dashboardApi.getSystemIntegrity(),
        dashboardApi.getWorkersStatus(),
        dashboardApi.getMediaDiagnostics(),
        dashboardApi.getHqModuleReadiness(),
        dashboardApi.getHqUsers(),
        dashboardApi.getHqCribs(),
        dashboardApi.getHqTables(),
        dashboardApi.getHqEvents(),
        dashboardApi.getHqGameIntelligenceSignals(),
        dashboardApi.getHqGrowthPlays()
      ])

      setModuleReadiness(moduleReadinessData)
      setHqUsers(hqUsersData)
      setHqCribs(hqCribsData)
      setHqTables(hqTablesData)
      setHqEvents(hqEventsData)
      setHqSignals(hqSignalsData)
      setHqGrowthPlays(hqGrowthPlaysData)
      setCommandCenter(commandCenterData)
      setOpportunities(opportunitiesData)
      setPipeline(pipelineData)
      setPerformance(performanceData)
      setLibrary(libraryData)
      setGrowthLoops(growthLoopsData)
      setSettings(settingsData)
      setSystemHealth(systemHealthData)
      setSystemIntegrity(systemIntegrityData)
      setWorkersStatus(workersStatusData)
      setMediaDiagnostics(mediaDiagnosticsData)

      setScheduleDrafts((current) =>
        Object.fromEntries(pipelineData.items.map((item) => [item.id, current[item.id] || toLocal(item.schedule.scheduledFor)]))
      )
      setAssetEditDrafts((current) =>
        Object.fromEntries(
          libraryData.assets.map((asset) => [
            asset.id,
            current[asset.id] || { preset: 'square', overlayText: asset.title || 'ReemTeam Highlight' }
          ])
        )
      )

      if (!selectedOpportunityId && opportunitiesData[0]) setSelectedOpportunityId(opportunitiesData[0].id)
      if (!selectedContentItemId && pipelineData.items[0]) setSelectedContentItemId(pipelineData.items[0].id)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        input.setGlobalToast({ type: 'error', message: 'Your session expired. Please sign in again.' })
        await input.onLogout()
        return
      }

      input.setGlobalToast({ type: 'error', message: extractApiError(error) })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  const runBusy = async (id: string, action: () => Promise<void>) => {
    setBusyActionId(id)
    try {
      await action()
    } catch (error) {
      if (isUnauthorizedError(error)) {
        input.setGlobalToast({ type: 'error', message: 'Your session expired. Please sign in again.' })
        await input.onLogout()
        return
      }

      input.setGlobalToast({ type: 'error', message: extractApiError(error) })
    } finally {
      setBusyActionId('')
    }
  }

  const goToTab = (tab: WorkspaceTab, options?: { contentItemId?: string; opportunityId?: string }) => {
    setActiveTab(tab)
    if (options?.contentItemId) {
      setSelectedContentItemId(options.contentItemId)
    }
    if (options?.opportunityId) {
      setSelectedOpportunityId(options.opportunityId)
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const selectHqModule = (moduleId: HqModuleId) => {
    const module = hqModules.find((entry) => entry.id === moduleId)
    setActiveModule(moduleId)
    if (module?.workspace) {
      setActiveTab(module.workspace)
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const runSync = async () => {
    await runBusy('sync-intelligence', async () => {
      await dashboardApi.syncIntelligence({ mode: 'sync' })
      input.setGlobalToast({ type: 'success', message: 'Live backend intelligence synced.' })
      await refreshAll()
    })
  }

  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? opportunities[0] ?? null
  const selectedContentItem = pipeline?.items.find((item) => item.id === selectedContentItemId) ?? pipeline?.items[0] ?? null
  const selectedVariant = selectedContentItem?.selectedVariant ?? null
  const selectedPreview = getMediaPreview(selectedVariant)

  const topHealthSummary = useMemo(() => {
    if (!systemHealth) return []
    return [
      { label: 'Backend', status: systemHealth.backendConnectivity.status },
      { label: 'Redis', status: systemHealth.redis.status },
      { label: 'Media queue', status: systemHealth.mediaQueue.status },
      { label: 'Publishing', status: systemHealth.publishingQueue.status }
    ]
  }, [systemHealth])

  const failedItemCount = useMemo(() => {
    const pipelineFailures =
      pipeline?.items.filter(
        (item) =>
          item.selectedVariant?.media.status === 'failed' ||
          Boolean(item.selectedVariant?.media.errorMessage) ||
          Boolean(item.schedule.lastError)
      ).length ?? 0

    return Math.max(pipelineFailures, systemIntegrity?.issues.length ?? 0)
  }, [pipeline, systemIntegrity])

  const globalStatusCounts = useMemo(
    () => ({
      opportunitiesToday: opportunities.length,
      needsReview: commandCenter?.needsReview.length ?? 0,
      readyToPublish: commandCenter?.readyToScheduleOrPublish.length ?? 0,
      scheduledToday: pipeline?.items.filter((item) => isSameDay(item.schedule.scheduledFor)).length ?? 0,
      failedItems: failedItemCount
    }),
    [commandCenter, failedItemCount, opportunities.length, pipeline]
  )

  const firstTimeChecklist = useMemo(
    () => opportunities.length === 0 && (pipeline?.items.length ?? 0) === 0,
    [opportunities.length, pipeline?.items.length]
  )

  const readinessByModule = useMemo(
    () => new Map((moduleReadiness?.modules ?? []).map((module) => [module.id, module])),
    [moduleReadiness]
  )

  const getModuleCount = (moduleId: HqModuleId) => {
    if (moduleId === 'command_center') return globalStatusCounts.needsReview + globalStatusCounts.readyToPublish
    if (moduleId === 'crm' || moduleId === 'users') return hqUsers.length
    if (moduleId === 'tables') return hqTables.length
    if (moduleId === 'cribs') return hqCribs.length
    if (moduleId === 'events') return hqEvents.length
    if (moduleId === 'game_intelligence') return hqSignals.length
    if (moduleId === 'growth_plays') return hqGrowthPlays.length || opportunities.length
    if (moduleId === 'content_studio') return pipeline?.items.length ?? 0
    if (moduleId === 'referrals') return growthLoops?.summary.referralCodes ?? 0
    if (moduleId === 'analytics') return performance?.totals.clicks ?? 0
    if (moduleId === 'system_health') return systemIntegrity?.issues.length ?? 0
    return readinessByModule.get(moduleId)?.counts
      ? Object.values(readinessByModule.get(moduleId)?.counts ?? {}).reduce((sum, value) => sum + value, 0)
      : 0
  }

  const activeModuleMeta = hqModules.find((module) => module.id === activeModule) ?? hqModules[0]
  const activeModuleReadiness = readinessByModule.get(activeModule)

  const nextBestAction = useMemo<NextBestAction>(() => {
    const criticalIssue = systemIntegrity?.issues.find((issue) => issue.severity === 'critical')
    if (criticalIssue) {
      return {
        label: `${systemIntegrity?.issues.length ?? 1} system issue${(systemIntegrity?.issues.length ?? 1) === 1 ? '' : 's'} need attention`,
        description: criticalIssue.summary,
        buttonLabel: 'Open system checks',
        tone: 'danger',
        tab: 'system'
      }
    }

    const failedItem = pipeline?.items.find(
      (item) =>
        item.selectedVariant?.media.status === 'failed' ||
        Boolean(item.selectedVariant?.media.errorMessage) ||
        Boolean(item.schedule.lastError)
    )
    if (failedItem) {
      return {
        label: 'A draft needs a retry',
        description: failedItem.schedule.lastError || failedItem.selectedVariant?.media.errorMessage || failedItem.title,
        buttonLabel: 'Open failed draft',
        tone: 'danger',
        tab: 'review',
        contentItemId: failedItem.id
      }
    }

    if ((commandCenter?.needsReview.length ?? 0) > 0) {
      const item = commandCenter?.needsReview[0]
      return {
        label: `${commandCenter?.needsReview.length ?? 0} draft${(commandCenter?.needsReview.length ?? 0) === 1 ? '' : 's'} ready for review`,
        description: 'Open the draft, check the preview, and approve it.',
        buttonLabel: 'Review drafts',
        tone: 'warning',
        tab: 'review',
        contentItemId: item?.id
      }
    }

    const mediaReadyItem = pipeline?.items.find(
      (item) => item.selectedVariant?.media.status === 'completed' && ['draft_ready', 'needs_review'].includes(item.stage)
    )
    if (mediaReadyItem) {
      return {
        label: 'A rendered draft is waiting for approval',
        description: `${mediaReadyItem.title} already has a completed preview.`,
        buttonLabel: 'Approve draft',
        tone: 'warning',
        tab: 'review',
        contentItemId: mediaReadyItem.id
      }
    }

    const openOpportunity = opportunities.find((opportunity) => opportunity.operatorStatus === 'open')
    if (openOpportunity) {
      return {
        label: `${opportunities.filter((opportunity) => opportunity.operatorStatus === 'open').length} Growth Plays are ready`,
        description: 'Pick the strongest gameplay or admin signal and turn it into action.',
        buttonLabel: 'Create from Growth Play',
        tone: 'accent',
        tab: 'create',
        opportunityId: openOpportunity.id
      }
    }

    return {
      label: 'Sync the live feed',
      description: 'Bring in fresh gameplay activity so HQ can rank new Growth Plays.',
      buttonLabel: 'Sync now',
      tone: 'accent',
      tab: 'today',
      action: 'sync'
    }
  }, [commandCenter, opportunities, pipeline, systemIntegrity])

  const selectedDraftNextStep = selectedContentItem ? getDraftNextStep(selectedContentItem) : null
  const workflowSteps = selectedContentItem
    ? [
        {
          label: '1. Growth Play',
          state: 'completed',
          detail: 'A meaningful signal has been detected.'
        },
        {
          label: '2. Draft',
          state:
            selectedContentItem.variants.length > 0 || ['draft_ready', 'needs_review', 'approved', 'scheduled', 'published'].includes(selectedContentItem.stage)
              ? 'completed'
              : 'current',
          detail: 'Hooks and captions are generated here.'
        },
        {
          label: '3. Media',
          state:
            selectedVariant?.media.status === 'completed'
              ? 'completed'
              : selectedVariant?.media.status === 'failed'
                ? 'failed'
                : selectedVariant?.media.status === 'queued' || selectedVariant?.media.status === 'processing'
                  ? 'active'
                  : 'current',
          detail: 'The image or video preview appears in this workspace.'
        },
        {
          label: '4. Approval',
          state: ['needs_review', 'approved', 'scheduled', 'published'].includes(selectedContentItem.stage) ? 'completed' : 'current',
          detail: 'Operator confirms the draft is ready.'
        },
        {
          label: '5. Publish',
          state: ['scheduled', 'published'].includes(selectedContentItem.stage) ? 'completed' : 'current',
          detail: 'Schedule, publish, or take the recommended action.'
        }
      ]
    : []

  const primaryDraftAction = useMemo(() => {
    if (!selectedContentItem) {
      return null
    }

    if (!selectedContentItem.variants.length) {
      return {
        key: 'copy' as DraftActionKey,
        label: 'Generate copy',
        helper: 'Create hook and caption options first.'
      }
    }

    if (!selectedVariant || ['not_started', 'failed'].includes(selectedVariant.media.status)) {
      return {
        key: 'media' as DraftActionKey,
        label: selectedVariant?.media.status === 'failed' ? 'Render again' : 'Render media',
        helper: 'Build the preview you will approve.'
      }
    }

    if (selectedVariant.media.status === 'queued' || selectedVariant.media.status === 'processing') {
      return {
        key: 'save' as DraftActionKey,
        label: 'Render in progress',
        helper: 'Refresh after the job completes to review the preview.'
      }
    }

    if (['draft_ready', 'needs_review'].includes(selectedContentItem.stage)) {
      return {
        key: 'approve' as DraftActionKey,
        label: 'Approve draft',
        helper: 'This confirms the copy and media are operator-approved.'
      }
    }

    if (selectedContentItem.stage === 'approved') {
      return {
        key: 'schedule' as DraftActionKey,
        label: 'Schedule action',
        helper: 'Choose the publish time and place it in the queue.'
      }
    }

    if (selectedContentItem.stage === 'scheduled') {
      return {
        key: 'publish' as DraftActionKey,
        label: 'Publish now',
        helper: 'Use this if you want to override the scheduled timing.'
      }
    }

    return {
      key: 'save' as DraftActionKey,
      label: 'Save draft',
      helper: 'Keep the current state without moving stages.'
    }
  }, [selectedContentItem, selectedVariant])

  const copyPreviewLink = async (url: string) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser')
      }

      await navigator.clipboard.writeText(url)
      input.setGlobalToast({ type: 'success', message: 'Preview link copied.' })
    } catch (error) {
      input.setGlobalToast({ type: 'error', message: extractApiError(error) })
    }
  }

  const createContentItem = async (opportunityId: string) => {
    await runBusy(`create-item:${opportunityId}`, async () => {
      const item = await dashboardApi.createContentItemFromOpportunity(opportunityId)
      setSelectedContentItemId(item.id)
      setActiveTab('review')
      input.setGlobalToast({ type: 'success', message: 'Draft created from the Growth Play.' })
      await refreshAll()
    })
  }

  const uploadAsset = async (event: FormEvent) => {
    event.preventDefault()
    if (!assetUploadFile) {
      input.setGlobalToast({ type: 'error', message: 'Choose a file to upload.' })
      return
    }

    await runBusy('asset-upload', async () => {
      const payload = new FormData()
      payload.append('file', assetUploadFile)
      payload.append('title', assetUploadForm.title)
      payload.append('tags', assetUploadForm.tags)
      await dashboardApi.uploadAsset(payload)
      setAssetUploadFile(null)
      setAssetUploadForm({ title: '', tags: '' })
      input.setGlobalToast({ type: 'success', message: 'Asset uploaded to the library.' })
      await refreshAll()
    })
  }

  const removeAsset = async (asset: LibraryView['assets'][number]) => {
    const assetLabel = asset.title || 'this asset'
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete ${assetLabel}? This also removes it from linked drafts and library references.`)
      if (!confirmed) {
        return
      }
    }

    await runBusy(`asset-delete:${asset.id}`, async () => {
      await dashboardApi.deleteAsset(asset.id)
      input.setGlobalToast({ type: 'success', message: `${assetLabel} deleted from the library.` })
      await refreshAll()
    })
  }

  const generateCopy = async (itemId: string) => {
    await runBusy(`copy:${itemId}`, async () => {
      await dashboardApi.generateContentItemCopy(itemId, Number(variantCount || 3))
      input.setGlobalToast({ type: 'success', message: 'Fresh copy options generated.' })
      await refreshAll()
    })
  }

  const renderMedia = async (itemId: string) => {
    await runBusy(`media:${itemId}`, async () => {
      await dashboardApi.generateContentItemMedia(itemId)
      input.setGlobalToast({ type: 'success', message: 'Media render queued.' })
      await refreshAll()
    })
  }

  const approveDraft = async (itemId: string) => {
    await runBusy(`approve:${itemId}`, async () => {
      await dashboardApi.approveContentItem(itemId)
      input.setGlobalToast({ type: 'success', message: 'Draft approved.' })
      await refreshAll()
    })
  }

  const saveDraft = async (itemId: string) => {
    await runBusy(`draft:${itemId}`, async () => {
      await dashboardApi.saveContentItemDraft(itemId)
      input.setGlobalToast({ type: 'success', message: 'Draft saved.' })
      await refreshAll()
    })
  }

  const scheduleDraft = async (itemId: string) => {
    await runBusy(`schedule:${itemId}`, async () => {
      await dashboardApi.scheduleContentItem(itemId, new Date(scheduleDrafts[itemId] || toLocal()).toISOString())
      input.setGlobalToast({ type: 'success', message: 'Post scheduled.' })
      await refreshAll()
    })
  }

  const publishNow = async (itemId: string) => {
    await runBusy(`publish:${itemId}`, async () => {
      await dashboardApi.publishContentItemNow(itemId)
      input.setGlobalToast({ type: 'success', message: 'Post published.' })
      await refreshAll()
    })
  }

  const archiveDraft = async (itemId: string) => {
    await runBusy(`archive:${itemId}`, async () => {
      await dashboardApi.archiveContentItem(itemId)
      input.setGlobalToast({ type: 'success', message: 'Draft archived.' })
      await refreshAll()
    })
  }

  const runPrimaryDraftAction = async () => {
    if (!selectedContentItem || !primaryDraftAction) {
      return
    }

    if (primaryDraftAction.key === 'copy') return generateCopy(selectedContentItem.id)
    if (primaryDraftAction.key === 'media') return renderMedia(selectedContentItem.id)
    if (primaryDraftAction.key === 'approve') return approveDraft(selectedContentItem.id)
    if (primaryDraftAction.key === 'schedule') return scheduleDraft(selectedContentItem.id)
    if (primaryDraftAction.key === 'publish') return publishNow(selectedContentItem.id)
    return saveDraft(selectedContentItem.id)
  }

  const handleNextBestAction = async () => {
    if (nextBestAction.action === 'sync') {
      return runSync()
    }

    goToTab(nextBestAction.tab, {
      contentItemId: nextBestAction.contentItemId,
      opportunityId: nextBestAction.opportunityId
    })
  }

  const workspaceTabs: Array<{
    id: WorkspaceTab
    label: string
    count?: number
  }> = [
    { id: 'today', label: 'Today', count: globalStatusCounts.needsReview + globalStatusCounts.readyToPublish },
    { id: 'create', label: 'Create', count: opportunities.filter((opportunity) => opportunity.operatorStatus === 'open').length },
    { id: 'review', label: 'Review', count: pipeline?.items.length ?? 0 },
    { id: 'library', label: 'Library', count: library?.assets.length ?? 0 },
    { id: 'system', label: 'System', count: systemIntegrity?.issues.length ?? 0 }
  ]

  return (
    <div className="app-shell">
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      {input.globalToast ? <div className={`toast toast--${input.globalToast.type}`}>{input.globalToast.message}</div> : null}

      <div className="operator-shell">
        <header className="operator-hero">
          <div className="operator-hero__copy">
            <span className="operator-hero__eyebrow">ReemTeam HQ</span>
            <h1>Command Center built around the next clear move.</h1>
            <p>
              This layout keeps the daily flow simple for operators: sync the feed, pick the best Growth Play, choose the action, then approve,
              schedule, publish, or route it to the right HQ module.
            </p>

            <div className={`next-action-banner next-action-banner--${nextBestAction.tone}`}>
              <div>
                <span className="next-action-banner__label">What should I do next?</span>
                <strong>{nextBestAction.label}</strong>
                <p>{nextBestAction.description}</p>
              </div>
              <button className="primary-button" onClick={() => void handleNextBestAction()}>
                <ArrowRight size={16} />
                {nextBestAction.buttonLabel}
              </button>
            </div>
          </div>

          <div className="operator-hero__panel">
            <div className="operator-hero__operator">
              <div>
                <span>Signed in</span>
                <strong>{input.operator.name}</strong>
                <p>{input.operator.email}</p>
              </div>
              <div className="chip-row">
                {topHealthSummary.map((item) => (
                  <StatusPill key={item.label} label={item.status} />
                ))}
              </div>
            </div>

            <div className="metric-strip">
              <article className="metric-card">
                <span>Open Growth Plays</span>
                <strong>{globalStatusCounts.opportunitiesToday}</strong>
                <p>Signals waiting for operator action.</p>
              </article>
              <article className="metric-card">
                <span>Needs review</span>
                <strong>{globalStatusCounts.needsReview}</strong>
                <p>Drafts that need an operator decision.</p>
              </article>
              <article className="metric-card">
                <span>Ready to publish</span>
                <strong>{globalStatusCounts.readyToPublish}</strong>
                <p>Approved actions with media or scheduling ready.</p>
              </article>
              <article className="metric-card">
                <span>Scheduled today</span>
                <strong>{globalStatusCounts.scheduledToday}</strong>
                <p>Actions already placed on today's calendar.</p>
              </article>
            </div>

            <div className="operator-hero__actions">
              <button className="ghost-button" onClick={() => void refreshAll()} disabled={isLoading}>
                <RefreshCw size={16} />
                {isLoading ? 'Refreshing...' : 'Refresh workspace'}
              </button>
              <button className="mini-button" onClick={() => void input.onLogout()}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="hq-module-surface" aria-label="ReemTeam HQ modules">
          <div className="workspace-card hq-module-command">
            <div className="workspace-card__header">
              <div>
                <span className="workspace-card__eyebrow">HQ platform</span>
                <h2>{activeModuleMeta.label}</h2>
              </div>
              <StatusPill label={activeModuleReadiness?.status || 'connected'} />
            </div>
            <p className="workspace-card__body-copy">
              {activeModuleReadiness?.detail ||
                'This HQ module is part of the command-center surface. Select a module to inspect its live data and operator actions.'}
            </p>

            <div className="hq-module-nav">
              {hqModules.map((module) => (
                <button
                  key={module.id}
                  className={`hq-module-button ${activeModule === module.id ? 'hq-module-button--active' : ''}`}
                  onClick={() => selectHqModule(module.id)}
                >
                  <span>{module.label}</span>
                  <strong>{getModuleCount(module.id)}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="workspace-card hq-module-detail">
            <div className="workspace-card__header">
              <div>
                <span className="workspace-card__eyebrow">Live module data</span>
                <h2>{activeModuleMeta.label} is connected</h2>
              </div>
              <button className="mini-button" onClick={() => void refreshAll()} disabled={isLoading}>
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {activeModule === 'command_center' ? (
              <div className="summary-list">
                <div className="summary-list__item">
                  <span>Growth Plays</span>
                  <strong>{String(opportunities.length)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Drafts in pipeline</span>
                  <strong>{String(pipeline?.items.length ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Needs review</span>
                  <strong>{String(commandCenter?.needsReview.length ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>System issues</span>
                  <strong>{String(systemIntegrity?.issues.length ?? 0)}</strong>
                </div>
              </div>
            ) : null}

            {activeModule === 'crm' || activeModule === 'users' ? (
              <div className="queue-list queue-list--compact">
                {hqUsers.slice(0, 6).map((user) => (
                  <div key={user.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={user.status} />
                        <StatusPill label={user.role} />
                      </div>
                      <strong>{user.displayName}</strong>
                      <p>
                        {user.username} - {user.profile?.gamesPlayed ?? 0} games, {user.profile?.reems ?? 0} Reems
                      </p>
                    </div>
                  </div>
                ))}
                {!hqUsers.length ? (
                  <EmptyState
                    title="No HQ users loaded"
                    description="The CRM and Users modules are wired, but this environment does not have HQ user records yet."
                    icon={<Users size={18} />}
                  />
                ) : null}
              </div>
            ) : null}

            {activeModule === 'cribs' ? (
              <div className="queue-list queue-list--compact">
                {hqCribs.map((crib) => (
                  <div key={crib.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={crib.status} />
                        {crib.featured ? <StatusPill label="featured" /> : null}
                      </div>
                      <strong>{crib.cribName}</strong>
                      <p>
                        Priority {crib.growthPriority} - {crib.tableCount} table{crib.tableCount === 1 ? '' : 's'} - {crib.stakeTier}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeModule === 'tables' ? (
              <div className="queue-list queue-list--compact">
                {hqTables.map((table) => (
                  <div key={table.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={table.status} />
                        <StatusPill label={table.visibility} />
                      </div>
                      <strong>{table.tableName}</strong>
                      <p>
                        {table.cribName || 'No crib'} - stake {table.stake} - priority {table.priority}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeModule === 'events' ? (
              <div className="queue-list queue-list--compact">
                {hqEvents.map((event) => (
                  <div key={event.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={event.status} />
                        <StatusPill label={event.eventType} />
                      </div>
                      <strong>{event.eventName}</strong>
                      <p>
                        {fmtDate(event.startTime)} - {event.growthGoal || event.contentGoal || 'No goal set'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeModule === 'game_intelligence' ? (
              <div className="queue-list queue-list--compact">
                {hqSignals.slice(0, 8).map((signal) => (
                  <div key={signal.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={signal.status} />
                        <StatusPill label={signal.signalType} />
                      </div>
                      <strong>{signal.summary}</strong>
                      <p>
                        Confidence {Math.round(signal.confidence)} - {fmtDate(signal.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {!hqSignals.length ? (
                  <EmptyState
                    title="No HQ signals loaded"
                    description="Run intelligence sync or ingest HQ gameplay events to populate this module."
                    actionLabel="Sync live feed"
                    onAction={() => void runSync()}
                    icon={<Sparkles size={18} />}
                  />
                ) : null}
              </div>
            ) : null}

            {activeModule === 'growth_plays' ? (
              <div className="queue-list queue-list--compact">
                {hqGrowthPlays.slice(0, 5).map((play) => (
                  <div key={play.id} className="queue-item queue-item--static">
                    <div>
                      <div className="chip-row">
                        <StatusPill label={play.status} />
                        <StatusPill label={play.urgency} />
                        <StatusPill label={play.playType} />
                      </div>
                      <strong>{play.title}</strong>
                      <p>{play.whyItMatters}</p>
                      <p>
                        {play.recommendedAction} via {play.recommendedChannel} - score {Math.round(play.finalScore)}
                      </p>
                      {play.whyThis?.sourceSignals?.length || play.whyThis?.recommendedActionReason ? (
                        <details className="explain-box">
                          <summary>Why this?</summary>
                          {play.whyThis.sourceSignals.length ? <p>{play.whyThis.sourceSignals.join(', ')}</p> : null}
                          {play.whyThis.scoreBoosts.length ? (
                            <p>Boosts: {play.whyThis.scoreBoosts.join(', ')}</p>
                          ) : null}
                          {play.whyThis.penalties.length ? <p>Penalties: {play.whyThis.penalties.join(', ')}</p> : null}
                          {play.whyThis.campaignFit ? <p>{play.whyThis.campaignFit}</p> : null}
                          {play.whyThis.recommendedActionReason ? <p>{play.whyThis.recommendedActionReason}</p> : null}
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!hqGrowthPlays.length ? (
                  <div className="summary-list">
                    <div className="summary-list__item">
                      <span>Compatibility Growth Plays</span>
                      <strong>{String(opportunities.filter((opportunity) => opportunity.operatorStatus === 'open').length)}</strong>
                    </div>
                    <div className="summary-list__item">
                      <span>Top recommendation</span>
                      <strong>{opportunities[0]?.headline || 'No native Growth Plays yet'}</strong>
                    </div>
                    <button className="primary-button" onClick={() => goToTab('create')}>
                      <Rocket size={16} />
                      Open Growth Engine workspace
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeModule === 'content_studio' ? (
              <div className="summary-list">
                <div className="summary-list__item">
                  <span>Content items</span>
                  <strong>{String(pipeline?.items.length ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Ready to publish</span>
                  <strong>{String(commandCenter?.readyToScheduleOrPublish.length ?? 0)}</strong>
                </div>
                <button className="primary-button" onClick={() => goToTab('review')}>
                  <ImageIcon size={16} />
                  Open Content Studio
                </button>
              </div>
            ) : null}

            {['referrals', 'wallet_ops', 'support', 'analytics', 'system_health'].includes(activeModule) ? (
              <div className="summary-list">
                <div className="summary-list__item">
                  <span>Referral codes</span>
                  <strong>{String(growthLoops?.summary.referralCodes ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Clicks</span>
                  <strong>{fmtCompact(performance?.totals.clicks ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Wallet ledger records</span>
                  <strong>{String(readinessByModule.get('wallet_ops')?.counts?.walletLedger ?? 0)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>System issues</span>
                  <strong>{String(systemIntegrity?.issues.length ?? 0)}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <nav className="workspace-tabs" aria-label="Operator workspaces">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              className={`workspace-tab ${activeTab === tab.id ? 'workspace-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <strong>{tab.count ?? 0}</strong>
            </button>
          ))}
        </nav>

        <div className="workspace-layout">
          <main className="workspace-main">
            {activeTab === 'today' ? (
              <div className="workspace-stack">
                {firstTimeChecklist ? (
                  <article className="workspace-card getting-started-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Getting started</span>
                        <h2>First-time operator checklist</h2>
                      </div>
                    </div>
                    <div className="step-ladder">
                      {[
                        '1. Sync the feed so Game Intelligence can detect fresh signals.',
                        '2. Open a Growth Play and create the right action from it.',
                        '3. Generate copy, then render media until the preview appears here in the app.',
                        '4. Approve the draft and choose schedule or publish now.'
                      ].map((step) => (
                        <div key={step} className="step-ladder__item">
                          <CheckCircle2 size={16} />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                    <button className="primary-button" onClick={() => void runSync()} disabled={busyActionId === 'sync-intelligence'}>
                      <RefreshCw size={16} />
                      Sync live feed
                    </button>
                  </article>
                ) : null}

                <div className="queue-grid">
                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Create next</span>
                        <h2>Best Growth Plays</h2>
                      </div>
                      <button className="mini-button" onClick={() => goToTab('create')}>
                        Open create view
                      </button>
                    </div>
                    <div className="queue-list">
                      {opportunities.slice(0, 4).map((opportunity) => (
                        <button
                          key={opportunity.id}
                          className={`queue-item ${selectedOpportunity?.id === opportunity.id ? 'queue-item--selected' : ''}`}
                          onClick={() => goToTab('create', { opportunityId: opportunity.id })}
                        >
                          <div>
                            <div className="chip-row">
                              <StatusPill label={opportunity.operatorStatus} />
                              <StatusPill label={opportunity.urgency} />
                            </div>
                            <strong>{opportunity.headline}</strong>
                            <p>{opportunity.whyItMatters}</p>
                          </div>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                      {opportunities.length === 0 ? (
                        <EmptyState
                          title="No Growth Plays yet"
                          description="Run a sync to pull the latest gameplay moments into the creation queue."
                          actionLabel="Sync now"
                          onAction={() => void runSync()}
                          icon={<Sparkles size={18} />}
                        />
                      ) : null}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Review next</span>
                        <h2>Drafts waiting on you</h2>
                      </div>
                      <button className="mini-button" onClick={() => goToTab('review')}>
                        Open review view
                      </button>
                    </div>
                    <div className="queue-list">
                      {(commandCenter?.needsReview ?? []).slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          className={`queue-item ${selectedContentItem?.id === item.id ? 'queue-item--selected' : ''}`}
                          onClick={() => goToTab('review', { contentItemId: item.id })}
                        >
                          <div>
                            <div className="chip-row">
                              <StatusPill label={item.stage} />
                              <StatusPill label={item.selectedVariant?.media.status || 'not_started'} />
                            </div>
                            <strong>{item.title}</strong>
                            <p>{getDraftNextStep(item).label}</p>
                          </div>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                      {(commandCenter?.needsReview.length ?? 0) === 0 ? (
                        <EmptyState
                          title="No drafts waiting right now"
                          description="When media finishes or new drafts are created, they will appear here automatically."
                          icon={<ShieldCheck size={18} />}
                        />
                      ) : null}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Publishing queue</span>
                        <h2>Ready or scheduled</h2>
                      </div>
                    </div>
                    <div className="queue-list">
                      {(commandCenter?.readyToScheduleOrPublish ?? []).slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          className={`queue-item ${selectedContentItem?.id === item.id ? 'queue-item--selected' : ''}`}
                          onClick={() => goToTab('review', { contentItemId: item.id })}
                        >
                          <div>
                            <div className="chip-row">
                              <StatusPill label={item.stage} />
                              <StatusPill label={item.schedule.status} />
                            </div>
                            <strong>{item.title}</strong>
                            <p>Best time window: {item.schedule.bestTimeWindow || 'Not calculated yet'}</p>
                          </div>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                      {(commandCenter?.readyToScheduleOrPublish.length ?? 0) === 0 ? (
                        <EmptyState
                          title="Nothing is ready to publish yet"
                          description="Approve a draft with completed media and it will move into this queue."
                          icon={<Rocket size={18} />}
                        />
                      ) : null}
                    </div>
                  </article>
                </div>

                <div className="today-bottom-grid">
                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Performance snapshot</span>
                        <h2>What content is working</h2>
                      </div>
                    </div>
                    <div className="compact-stats-grid">
                      <div className="compact-stat">
                        <span>Engagement</span>
                        <strong>{fmtCompact(performance?.totals.engagement ?? 0)}</strong>
                      </div>
                      <div className="compact-stat">
                        <span>Clicks</span>
                        <strong>{fmtCompact(performance?.totals.clicks ?? 0)}</strong>
                      </div>
                      <div className="compact-stat">
                        <span>Signups</span>
                        <strong>{fmtCompact(performance?.totals.signups ?? 0)}</strong>
                      </div>
                      <div className="compact-stat">
                        <span>Deposits</span>
                        <strong>{fmtCompact(performance?.totals.deposits ?? 0)}</strong>
                      </div>
                    </div>
                    <div className="queue-list queue-list--compact">
                      {(performance?.bestPerformers ?? []).slice(0, 3).map((item) => (
                        <button key={item.id} className="queue-item" onClick={() => goToTab('review', { contentItemId: item.id })}>
                          <div>
                            <strong>{item.title}</strong>
                            <p>
                              Score {item.analyticsSummary.performanceScore.toFixed(1)} - {item.analyticsSummary.clicks} clicks -{' '}
                              {item.analyticsSummary.signups} signups
                            </p>
                          </div>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">System confidence</span>
                        <h2>Can you trust the machine?</h2>
                      </div>
                    </div>
                    <div className="health-badges">
                      {topHealthSummary.map((entry) => (
                        <div key={entry.label} className="health-badge">
                          <span>{entry.label}</span>
                          <StatusPill label={entry.status} />
                        </div>
                      ))}
                    </div>
                    <p className="workspace-card__body-copy">
                      Failed items: <strong>{globalStatusCounts.failedItems}</strong>. Average media processing time:{' '}
                      <strong>{formatDuration(mediaDiagnostics?.averageProcessingTimeMs)}</strong>.
                    </p>
                    <button className="mini-button" onClick={() => goToTab('system')}>
                      <Settings2 size={16} />
                      Open system view
                    </button>
                  </article>
                </div>
              </div>
            ) : null}

            {activeTab === 'create' ? (
              <div className="workspace-stack">
                <article className="workspace-card selection-card">
                  <div className="workspace-card__header">
                    <div>
                      <span className="workspace-card__eyebrow">Selected Growth Play</span>
                      <h2>{selectedOpportunity?.headline || 'Choose a Growth Play'}</h2>
                    </div>
                    {selectedOpportunity ? <StatusPill label={selectedOpportunity.urgency} /> : null}
                  </div>

                  {selectedOpportunity ? (
                    <div className="selection-card__grid">
                      <div className="selection-card__story">
                        <p>{selectedOpportunity.whyAmISeeingThis}</p>
                        <div className="selection-card__facts">
                          <div>
                            <span>Recommended angle</span>
                            <strong>{selectedOpportunity.recommendedContentAngle}</strong>
                          </div>
                          <div>
                            <span>Suggested format</span>
                            <strong>{selectedOpportunity.recommendedFormat}</strong>
                          </div>
                          <div>
                            <span>Confidence</span>
                            <strong>{Math.round(selectedOpportunity.confidenceScore)}%</strong>
                          </div>
                          <div>
                            <span>Estimated value</span>
                            <strong>{fmtCompact(selectedOpportunity.estimatedValue)}</strong>
                          </div>
                          <div>
                            <span>Final score</span>
                            <strong>{Math.round(selectedOpportunity.finalScore)}</strong>
                          </div>
                        </div>
                        <div className="chip-row">
                          {selectedOpportunity.recommendedPlatforms.map((platform) => (
                            <span key={platform} className="chip">
                              {platform}
                            </span>
                          ))}
                        </div>
                        {selectedOpportunity.explanation ? (
                          <details className="explain-box">
                            <summary>Why this?</summary>
                            <p>{selectedOpportunity.explanation.summary}</p>
                            <div className="summary-list">
                              <div className="summary-list__item">
                                <span>Boosted by</span>
                                <strong>{selectedOpportunity.explanation.scoreBoosts.join(', ') || 'Freshness'}</strong>
                              </div>
                              <div className="summary-list__item">
                                <span>Penalties</span>
                                <strong>{selectedOpportunity.explanation.penalties.join(', ') || 'None'}</strong>
                              </div>
                              <div className="summary-list__item">
                                <span>Format reason</span>
                                <strong>{selectedOpportunity.explanation.formatReason}</strong>
                              </div>
                              <div className="summary-list__item">
                                <span>Timing</span>
                                <strong>{selectedOpportunity.explanation.timing}</strong>
                              </div>
                            </div>
                          </details>
                        ) : null}
                        <button
                          className="primary-button"
                          onClick={() => void createContentItem(selectedOpportunity.id)}
                          disabled={busyActionId === `create-item:${selectedOpportunity.id}`}
                        >
                          <Sparkles size={16} />
                          {busyActionId === `create-item:${selectedOpportunity.id}` ? 'Creating draft...' : 'Create draft from this moment'}
                        </button>
                      </div>

                      <div className="selection-card__signals">
                        <h3>Signals behind this recommendation</h3>
                        {selectedOpportunity.sourceIndicators.length ? (
                          <div className="chip-row">
                            {selectedOpportunity.sourceIndicators.map((indicator) => (
                              <span key={indicator.id} className="chip">
                                {indicator.type} {Math.round(indicator.confidence)}%
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="signal-list">
                          {selectedOpportunity.sourceSignals.map((signal) => (
                            <article key={signal.id} className="signal-row">
                              <div>
                                <strong>{signal.player}</strong>
                                <p>
                                  {signal.type} at {signal.tableName}
                                </p>
                              </div>
                              <div className="signal-row__score">
                                <span>{fmtDate(signal.occurredAt)}</span>
                                <strong>{fmtCompact(signal.amount)}</strong>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="No Growth Play selected"
                      description="As soon as the system detects a strong gameplay moment, it will appear here."
                      actionLabel="Sync feed"
                      onAction={() => void runSync()}
                      icon={<Sparkles size={18} />}
                    />
                  )}
                </article>

                <article className="workspace-card">
                  <div className="workspace-card__header">
                    <div>
                      <span className="workspace-card__eyebrow">Growth Play queue</span>
                      <h2>Choose the next HQ action</h2>
                    </div>
                  </div>
                  <div className="card-grid">
                    {opportunities.map((opportunity) => (
                      <button
                        key={opportunity.id}
                        className={`selection-tile ${selectedOpportunity?.id === opportunity.id ? 'selection-tile--selected' : ''}`}
                        onClick={() => setSelectedOpportunityId(opportunity.id)}
                      >
                        <div className="chip-row">
                          <StatusPill label={opportunity.operatorStatus} />
                          <StatusPill label={opportunity.urgency} />
                        </div>
                        <strong>{opportunity.headline}</strong>
                        <p>{opportunity.whyItMatters}</p>
                        <span>
                          {opportunity.recommendedFormat} - score {Math.round(opportunity.finalScore)}
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}
            
            {activeTab === 'review' ? (
              <div className="workspace-stack">
                <article className="workspace-card">
                  <div className="workspace-card__header">
                    <div>
                      <span className="workspace-card__eyebrow">Review workspace</span>
                      <h2>{selectedContentItem?.title || 'Select a draft'}</h2>
                    </div>
                    {selectedContentItem ? (
                      <div className="chip-row">
                        <StatusPill label={selectedContentItem.stage} />
                        <StatusPill label={selectedVariant?.media.status || 'not_started'} />
                        <StatusPill label={selectedContentItem.operatorMode} />
                      </div>
                    ) : null}
                  </div>

                  {selectedContentItem ? (
                    <>
                      <div className="review-board">
                        <div className="preview-panel">
                          <div className="preview-panel__header">
                            <div>
                              <span className="workspace-card__eyebrow">Generated media</span>
                              <h3>Preview the asset here</h3>
                            </div>
                            {selectedPreview ? (
                              <div className="preview-panel__actions">
                                <button className="mini-button" onClick={() => void copyPreviewLink(selectedPreview.url)}>
                                  <Copy size={16} />
                                  Copy link
                                </button>
                                <a className="mini-button" href={selectedPreview.url} target="_blank" rel="noreferrer">
                                  <ExternalLink size={16} />
                                  Open media
                                </a>
                                <a className="mini-button" href={selectedPreview.url} download>
                                  <Download size={16} />
                                  Download
                                </a>
                              </div>
                            ) : null}
                          </div>

                          <div className="preview-frame">
                            {selectedPreview?.kind === 'video' ? (
                              <video controls src={selectedPreview.url} />
                            ) : selectedPreview?.kind === 'image' ? (
                              <img src={selectedPreview.url} alt={selectedVariant?.hook || selectedContentItem.title} />
                            ) : (
                              <div className="preview-placeholder">
                                <ImagePlus size={22} />
                                <strong>No preview yet</strong>
                                <p>When you click Render media, the image or video will appear here inside the dashboard.</p>
                              </div>
                            )}
                          </div>

                          <div className="preview-panel__meta">
                            <div>
                              <span>Render status</span>
                              <strong>{selectedVariant?.media.status.replace(/_/g, ' ') || 'not started'}</strong>
                            </div>
                            <div>
                              <span>Last finished</span>
                              <strong>{fmtDate(selectedVariant?.media.lastFinishedAt)}</strong>
                            </div>
                            <div>
                              <span>Preview source</span>
                              <strong>{selectedPreview ? 'Available in app' : 'Waiting for render'}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="review-summary">
                          {selectedDraftNextStep ? (
                            <div className="attention-card attention-card--accent">
                              <span>Next operator step</span>
                              <strong>{selectedDraftNextStep.label}</strong>
                              <p>{selectedDraftNextStep.description}</p>
                            </div>
                          ) : null}

                          {selectedVariant?.media.errorMessage || selectedContentItem.schedule.lastError ? (
                            <div className="attention-card attention-card--danger">
                              <span>Failure visible</span>
                              <strong>Something needs a retry</strong>
                              <p>{selectedContentItem.schedule.lastError || selectedVariant?.media.errorMessage}</p>
                            </div>
                          ) : null}

                          <div className="summary-list">
                            <div className="summary-list__item">
                              <span>Why this matters</span>
                              <strong>{selectedContentItem.whyItMatters}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Recommended angle</span>
                              <strong>{selectedContentItem.strategyAngle}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Hook direction</span>
                              <strong>{selectedContentItem.hookDirection}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Best publish window</span>
                              <strong>{selectedContentItem.schedule.bestTimeWindow || 'Not calculated yet'}</strong>
                            </div>
                          </div>

                          <div className="action-stack">
                            <div className="action-stack__primary">
                              <button
                                className="primary-button"
                                onClick={() => void runPrimaryDraftAction()}
                                disabled={!primaryDraftAction || primaryDraftAction.label === 'Render in progress'}
                              >
                                {primaryDraftAction?.key === 'approve' ? <ShieldCheck size={16} /> : null}
                                {primaryDraftAction?.key === 'media' ? <ImagePlus size={16} /> : null}
                                {primaryDraftAction?.key === 'schedule' ? <CalendarRange size={16} /> : null}
                                {primaryDraftAction?.key === 'publish' ? <Rocket size={16} /> : null}
                                {primaryDraftAction?.key === 'copy' ? <Sparkles size={16} /> : null}
                                {primaryDraftAction?.key === 'save' ? <Save size={16} /> : null}
                                {primaryDraftAction?.label || 'Choose an action'}
                              </button>
                              {primaryDraftAction ? <p>{primaryDraftAction.helper}</p> : null}
                            </div>

                            <div className="action-stack__grid">
                              <button className="mini-button" onClick={() => void generateCopy(selectedContentItem.id)} disabled={busyActionId === `copy:${selectedContentItem.id}`}>
                                <Sparkles size={16} />
                                Generate copy
                              </button>
                              <button className="mini-button" onClick={() => void renderMedia(selectedContentItem.id)} disabled={busyActionId === `media:${selectedContentItem.id}`}>
                                <ImagePlus size={16} />
                                Render media
                              </button>
                              <button className="mini-button" onClick={() => void approveDraft(selectedContentItem.id)} disabled={busyActionId === `approve:${selectedContentItem.id}`}>
                                <ShieldCheck size={16} />
                                Approve
                              </button>
                              <button className="mini-button" onClick={() => void saveDraft(selectedContentItem.id)} disabled={busyActionId === `draft:${selectedContentItem.id}`}>
                                <Save size={16} />
                                Save
                              </button>
                              <button className="mini-button mini-button--accent" onClick={() => void scheduleDraft(selectedContentItem.id)} disabled={busyActionId === `schedule:${selectedContentItem.id}`}>
                                <CalendarRange size={16} />
                                Schedule
                              </button>
                              <button className="mini-button" onClick={() => void publishNow(selectedContentItem.id)} disabled={busyActionId === `publish:${selectedContentItem.id}`}>
                                <Rocket size={16} />
                                Publish now
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="workflow-lane">
                        {workflowSteps.map((step) => (
                          <article key={step.label} className={`workflow-card workflow-card--${step.state}`}>
                            <span>{step.label}</span>
                            <p>{step.detail}</p>
                          </article>
                        ))}
                      </div>

                      <div className="review-detail-grid">
                        <article className="workspace-card workspace-card--inner">
                          <div className="workspace-card__header">
                            <div>
                              <span className="workspace-card__eyebrow">Selected version</span>
                              <h2>{selectedVariant?.hook || 'Choose a version'}</h2>
                            </div>
                          </div>
                          <p className="workspace-card__body-copy">{selectedVariant?.caption || 'Generate copy to create the first caption options.'}</p>
                          <div className="chip-row">
                            {(selectedVariant?.hashtags ?? []).map((hashtag) => (
                              <span key={hashtag} className="chip">
                                {hashtag}
                              </span>
                            ))}
                          </div>
                          <div className="summary-list">
                            <div className="summary-list__item">
                              <span>CTA</span>
                              <strong>{selectedVariant?.cta || selectedContentItem.brief?.cta || 'Not set'}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Overlay text</span>
                              <strong>{selectedVariant?.overlayText || 'Not set'}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Performance score</span>
                              <strong>{selectedContentItem.analyticsSummary.performanceScore.toFixed(1)}</strong>
                            </div>
                            <div className="summary-list__item">
                              <span>Clicks / signups</span>
                              <strong>
                                {selectedContentItem.analyticsSummary.clicks} / {selectedContentItem.analyticsSummary.signups}
                              </strong>
                            </div>
                          </div>
                        </article>

                        <article className="workspace-card workspace-card--inner">
                          <div className="workspace-card__header">
                            <div>
                              <span className="workspace-card__eyebrow">Version picker</span>
                              <h2>Choose the best hook and caption</h2>
                            </div>
                          </div>
                          <div className="variant-list">
                            {selectedContentItem.variants.map((variant) => (
                              <button
                                key={variant.id}
                                className={`variant-choice ${selectedContentItem.selectedVariantId === variant.id ? 'variant-choice--selected' : ''}`}
                                onClick={() =>
                                  void runBusy(`select-variant:${variant.id}`, async () => {
                                    await dashboardApi.selectContentItemVariant(selectedContentItem.id, variant.id)
                                    await refreshAll()
                                  })
                                }
                              >
                                <div className="chip-row">
                                  <StatusPill label={variant.status} />
                                  <StatusPill label={variant.media.status} />
                                </div>
                                <strong>{variant.variantLabel}</strong>
                                <p>{variant.hook}</p>
                              </button>
                            ))}
                          </div>
                        </article>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="No draft selected"
                      description="Choose a draft from Today or Create, and its media preview plus approval actions will open here."
                      actionLabel="Open create view"
                      onAction={() => setActiveTab('create')}
                      icon={<ImageIcon size={18} />}
                    />
                  )}
                </article>
              </div>
            ) : null}

            {activeTab === 'library' ? (
              <div className="workspace-stack">
                <div className="review-detail-grid">
                  <form className="workspace-card" onSubmit={uploadAsset}>
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Upload media</span>
                        <h2>Add an image or video to the library</h2>
                      </div>
                    </div>
                    <div className="field-grid">
                      <label>
                        Title
                        <input
                          value={assetUploadForm.title}
                          onChange={(event) => setAssetUploadForm((current) => ({ ...current, title: event.target.value }))}
                          placeholder="ReemTeam highlight"
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={assetUploadForm.tags}
                          onChange={(event) => setAssetUploadForm((current) => ({ ...current, tags: event.target.value }))}
                          placeholder="highlight, big win, promo"
                        />
                      </label>
                      <label>
                        File
                        <input type="file" accept="image/*,video/*" onChange={(event) => setAssetUploadFile(event.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <button className="primary-button" type="submit" disabled={busyActionId === 'asset-upload'}>
                      <Upload size={16} />
                      {busyActionId === 'asset-upload' ? 'Uploading...' : 'Upload to library'}
                    </button>
                  </form>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Creative helpers</span>
                        <h2>Reusable presets and patterns</h2>
                      </div>
                    </div>
                    <div className="summary-list">
                      <div className="summary-list__item">
                        <span>Visual presets</span>
                        <strong>{library?.visualPresets.map((preset) => preset.name).join(', ') || 'Not loaded yet'}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Overlay starters</span>
                        <strong>{library?.overlays.slice(0, 3).join(', ') || 'No overlays yet'}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Hook patterns</span>
                        <strong>{library?.hookPatterns.slice(0, 3).map((pattern) => pattern.hook).join(' | ') || 'No patterns yet'}</strong>
                      </div>
                    </div>
                  </article>
                </div>

                <article className="workspace-card">
                  <div className="workspace-card__header">
                    <div>
                      <span className="workspace-card__eyebrow">Asset library</span>
                      <h2>Preview every upload in one place</h2>
                    </div>
                  </div>
                  <div className="asset-grid asset-grid--library">
                    {library?.assets.length ? (
                      library.assets.map((asset) => (
                        <article key={asset.id} className="asset-card">
                          <div className="asset-card__preview">
                            {asset.preferredUrl ? (
                              asset.kind === 'video' ? (
                                <video src={asset.preferredUrl} controls />
                              ) : (
                                <img src={asset.preferredUrl} alt={asset.title || 'Asset'} />
                              )
                            ) : (
                              <div className="media-placeholder">Preview unavailable</div>
                            )}
                          </div>
                          <div className="asset-card__body">
                            <div className="chip-row">
                              <StatusPill label={asset.editorStatus} />
                              <StatusPill label={asset.kind} />
                            </div>
                            <h3>{asset.title || 'Untitled asset'}</h3>
                            <div className="field-grid field-grid--two">
                              <label>
                                Preset
                                <select
                                  value={assetEditDrafts[asset.id]?.preset ?? 'square'}
                                  onChange={(event) =>
                                    setAssetEditDrafts((current) => ({
                                      ...current,
                                      [asset.id]: {
                                        preset: event.target.value as 'square' | 'story' | 'reel',
                                        overlayText: current[asset.id]?.overlayText ?? asset.title ?? 'ReemTeam Highlight'
                                      }
                                    }))
                                  }
                                >
                                  <option value="square">Square</option>
                                  <option value="story">Story</option>
                                  <option value="reel">Reel</option>
                                </select>
                              </label>
                              <label>
                                Overlay
                                <input
                                  value={assetEditDrafts[asset.id]?.overlayText ?? ''}
                                  onChange={(event) =>
                                    setAssetEditDrafts((current) => ({
                                      ...current,
                                      [asset.id]: {
                                        preset: current[asset.id]?.preset ?? 'square',
                                        overlayText: event.target.value
                                      }
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <div className="post-card__actions">
                              <button
                                className="mini-button"
                                onClick={() =>
                                  void runBusy(`asset-edit:${asset.id}`, async () => {
                                    await dashboardApi.autoEditAsset(asset.id, assetEditDrafts[asset.id])
                                    input.setGlobalToast({ type: 'success', message: 'Asset auto-edited.' })
                                    await refreshAll()
                                  })
                                }
                                disabled={busyActionId === `asset-edit:${asset.id}`}
                              >
                                <Sparkles size={16} />
                                {busyActionId === `asset-edit:${asset.id}` ? 'Editing...' : 'Auto-edit'}
                              </button>
                              {asset.preferredUrl ? (
                                <a className="mini-button" href={asset.preferredUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink size={16} />
                                  Open
                                </a>
                              ) : null}
                              <button className="mini-button mini-button--danger" onClick={() => void removeAsset(asset)} disabled={busyActionId === `asset-delete:${asset.id}`}>
                                <AlertTriangle size={16} />
                                {busyActionId === `asset-delete:${asset.id}` ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        title="No assets yet"
                        description="Upload an image or video so the library becomes a real source for future drafts."
                        icon={<Upload size={18} />}
                      />
                    )}
                  </div>
                </article>
              </div>
            ) : null}

            {activeTab === 'system' ? (
              <div className="workspace-stack">
                <div className="review-detail-grid">
                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Operator mode</span>
                        <h2>Choose how much automation you want</h2>
                      </div>
                    </div>
                    <div className="mode-switcher">
                      {(['assisted', 'autopilot', 'manual'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={`workspace-tab ${settings?.mode === mode ? 'workspace-tab--active' : ''}`}
                          onClick={() =>
                            void runBusy(`mode:${mode}`, async () => {
                              await dashboardApi.updateSettings({ mode })
                              input.setGlobalToast({ type: 'success', message: `Mode switched to ${mode}.` })
                              await refreshAll()
                            })
                          }
                        >
                          <span>{mode}</span>
                        </button>
                      ))}
                    </div>
                    <p className="workspace-card__body-copy">
                      Assisted is best for new operators. Autopilot moves safe items automatically after media succeeds. Manual keeps each step in your hands.
                    </p>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Media diagnostics</span>
                        <h2>Can renders complete successfully?</h2>
                      </div>
                    </div>
                    <div className="summary-list">
                      <div className="summary-list__item">
                        <span>Queue length</span>
                        <strong>{String(mediaDiagnostics?.queueLength ?? 0)}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Active jobs</span>
                        <strong>{String(mediaDiagnostics?.activeJobs ?? 0)}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Average processing</span>
                        <strong>{formatDuration(mediaDiagnostics?.averageProcessingTimeMs)}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Last success</span>
                        <strong>{fmtDate(mediaDiagnostics?.lastSuccess)}</strong>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="review-detail-grid">
                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Health checks</span>
                        <h2>Core systems</h2>
                      </div>
                    </div>
                    <div className="queue-list queue-list--compact">
                      {systemHealth
                        ? Object.entries({
                            backendConnectivity: systemHealth.backendConnectivity,
                            intelligenceSync: systemHealth.intelligenceSync,
                            mongo: systemHealth.mongo,
                            redis: systemHealth.redis,
                            mediaQueue: systemHealth.mediaQueue,
                            publishingQueue: systemHealth.publishingQueue
                          }).map(([key, value]) => (
                            <div key={key} className="queue-item queue-item--static">
                              <div>
                                <strong>{key}</strong>
                                <p>{value.detail}</p>
                              </div>
                              <StatusPill label={value.status} />
                            </div>
                          ))
                        : null}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Workers</span>
                        <h2>Background jobs and heartbeats</h2>
                      </div>
                    </div>
                    <div className="queue-list queue-list--compact">
                      {workersStatus
                        ? Object.values(workersStatus.workers).map((worker) => (
                            <div key={worker.workerName} className="queue-item queue-item--static">
                              <div>
                                <strong>{worker.workerName}</strong>
                                <p>
                                  {worker.detail} - Last heartbeat {fmtDate(worker.lastHeartbeatAt)}
                                </p>
                              </div>
                              <StatusPill label={worker.status} />
                            </div>
                          ))
                        : null}
                    </div>
                  </article>
                </div>

                <div className="review-detail-grid">
                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Integrity issues</span>
                        <h2>Failures or broken workflow steps</h2>
                      </div>
                    </div>
                    <div className="queue-list queue-list--compact">
                      {systemIntegrity?.issues.length ? (
                        systemIntegrity.issues.map((issue) => (
                          <div key={`${issue.code}-${issue.entityId || issue.detectedAt}`} className="attention-card attention-card--danger">
                            <span>{issue.severity}</span>
                            <strong>{issue.summary}</strong>
                            <p>{issue.details || issue.action || 'Review this issue in the relevant workspace.'}</p>
                            {issue.entityType === 'content_item' && issue.entityId ? (
                              <button className="mini-button" onClick={() => goToTab('review', { contentItemId: issue.entityId || undefined })}>
                                Open draft
                              </button>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title="No integrity issues detected"
                          description="The workflow does not currently show broken steps or missing handoffs."
                          icon={<CheckCircle2 size={18} />}
                        />
                      )}
                    </div>
                  </article>

                  <article className="workspace-card">
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Insights and growth</span>
                        <h2>Performance summary and referral tools</h2>
                      </div>
                    </div>
                    <div className="summary-list">
                      <div className="summary-list__item">
                        <span>Winning hook styles</span>
                        <strong>{performance?.recommendations.winningHookStyles.join(', ') || 'No pattern yet'}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Best content types</span>
                        <strong>{performance?.recommendations.winningContentTypes.join(', ') || 'No pattern yet'}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Referral codes</span>
                        <strong>{String(growthLoops?.summary.referralCodes ?? 0)}</strong>
                      </div>
                      <div className="summary-list__item">
                        <span>Total invites</span>
                        <strong>{String(growthLoops?.summary.totalInvites ?? 0)}</strong>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="review-detail-grid">
                  <form
                    className="workspace-card"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void runBusy('referral-create', async () => {
                        await dashboardApi.createReferral(referralCreateUserId)
                        setReferralCreateUserId('')
                        input.setGlobalToast({ type: 'success', message: 'Referral code created.' })
                        await refreshAll()
                      })
                    }}
                  >
                    <div className="workspace-card__header">
                      <div>
                        <span className="workspace-card__eyebrow">Growth loops</span>
                        <h2>Create referral code</h2>
                      </div>
                    </div>
                    <label>
                      Owner user ID
                      <input value={referralCreateUserId} onChange={(event) => setReferralCreateUserId(event.target.value)} required />
                    </label>
                    <button className="primary-button" type="submit" disabled={busyActionId === 'referral-create'}>
                      <Users size={16} />
                      Create code
                    </button>
                  </form>

                  <div className="workspace-stack">
                    <form
                      className="workspace-card"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void runBusy('referral-invite', async () => {
                          await dashboardApi.createInvite(inviteForm.code, inviteForm.invitedUserId)
                          setInviteForm({ code: '', invitedUserId: '' })
                          input.setGlobalToast({ type: 'success', message: 'Invite recorded.' })
                          await refreshAll()
                        })
                      }}
                    >
                      <div className="workspace-card__header">
                        <div>
                          <span className="workspace-card__eyebrow">Growth loops</span>
                          <h2>Record invite</h2>
                        </div>
                      </div>
                      <div className="field-grid">
                        <label>
                          Referral code
                          <input value={inviteForm.code} onChange={(event) => setInviteForm((current) => ({ ...current, code: event.target.value }))} required />
                        </label>
                        <label>
                          Invited user ID
                          <input value={inviteForm.invitedUserId} onChange={(event) => setInviteForm((current) => ({ ...current, invitedUserId: event.target.value }))} required />
                        </label>
                      </div>
                      <button className="mini-button" type="submit" disabled={busyActionId === 'referral-invite'}>
                        <Send size={16} />
                        Save invite
                      </button>
                    </form>

                    <form
                      className="workspace-card"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void runBusy('referral-reward', async () => {
                          await dashboardApi.rewardInvite(rewardForm.code, rewardForm.invitedUserId, Number(rewardForm.rewardCents || 0))
                          setRewardForm({ code: '', invitedUserId: '', rewardCents: '500' })
                          input.setGlobalToast({ type: 'success', message: 'Referral reward applied.' })
                          await refreshAll()
                        })
                      }}
                    >
                      <div className="workspace-card__header">
                        <div>
                          <span className="workspace-card__eyebrow">Growth loops</span>
                          <h2>Apply reward</h2>
                        </div>
                      </div>
                      <div className="field-grid">
                        <label>
                          Referral code
                          <input value={rewardForm.code} onChange={(event) => setRewardForm((current) => ({ ...current, code: event.target.value }))} required />
                        </label>
                        <label>
                          Invited user ID
                          <input value={rewardForm.invitedUserId} onChange={(event) => setRewardForm((current) => ({ ...current, invitedUserId: event.target.value }))} required />
                        </label>
                        <label>
                          Reward cents
                          <input type="number" value={rewardForm.rewardCents} onChange={(event) => setRewardForm((current) => ({ ...current, rewardCents: event.target.value }))} />
                        </label>
                      </div>
                      <button className="mini-button" type="submit" disabled={busyActionId === 'referral-reward'}>
                        <Sparkles size={16} />
                        Apply reward
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : null}
          </main>

          <aside className="workspace-sidebar">
            <article className="workspace-card helper-card">
              <div className="workspace-card__header">
                <div>
                  <span className="workspace-card__eyebrow">Operator guide</span>
                  <h2>Keep the job simple</h2>
                </div>
              </div>
              <div className="step-ladder">
                {[
                  '1. Open Today to see what needs attention.',
                  '2. Use Create when you are turning a fresh Growth Play into a draft or action.',
                  '3. Use Review to see the media preview, approve, and publish.',
                  '4. Use Library only when you need raw media uploads.',
                  '5. Use System when something looks broken or confusing.'
                ].map((step) => (
                  <div key={step} className="step-ladder__item">
                    <CheckCircle2 size={16} />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="workspace-card helper-card">
              <div className="workspace-card__header">
                <div>
                  <span className="workspace-card__eyebrow">Current focus</span>
                  <h2>{selectedContentItem?.title || selectedOpportunity?.headline || 'Nothing selected yet'}</h2>
                </div>
              </div>
              {selectedContentItem ? (
                <div className="summary-list">
                  <div className="summary-list__item">
                    <span>Stage</span>
                    <strong>{selectedContentItem.stageLabel}</strong>
                  </div>
                  <div className="summary-list__item">
                    <span>Selected version</span>
                    <strong>{selectedVariant?.variantLabel || 'No variant chosen'}</strong>
                  </div>
                  <div className="summary-list__item">
                    <span>Next step</span>
                    <strong>{selectedDraftNextStep?.label || 'Select a draft to continue'}</strong>
                  </div>
                </div>
              ) : selectedOpportunity ? (
                <div className="summary-list">
                  <div className="summary-list__item">
                    <span>Format</span>
                    <strong>{selectedOpportunity.recommendedFormat}</strong>
                  </div>
                  <div className="summary-list__item">
                    <span>Angle</span>
                    <strong>{selectedOpportunity.recommendedContentAngle}</strong>
                  </div>
                  <div className="summary-list__item">
                    <span>Confidence</span>
                    <strong>{Math.round(selectedOpportunity.confidenceScore)}%</strong>
                  </div>
                </div>
              ) : (
                <p className="workspace-card__body-copy">Select a Growth Play or a draft and this summary will keep the key facts in view.</p>
              )}
            </article>

            <article className="workspace-card helper-card">
              <div className="workspace-card__header">
                <div>
                  <span className="workspace-card__eyebrow">Plain-language glossary</span>
                  <h2>What the labels mean</h2>
                </div>
              </div>
              <div className="summary-list">
                <div className="summary-list__item">
                  <span>Growth Play</span>
                  <strong>A gameplay, CRM, table, crib, event, or campaign signal HQ recommends acting on.</strong>
                </div>
                <div className="summary-list__item">
                  <span>Draft</span>
                  <strong>The working content or operator action with copy options and media state.</strong>
                </div>
                <div className="summary-list__item">
                  <span>Render media</span>
                  <strong>The step that creates the image or video preview you approve.</strong>
                </div>
                <div className="summary-list__item">
                  <span>Approve</span>
                  <strong>The operator says the draft and preview are safe to publish.</strong>
                </div>
              </div>
            </article>

            <article className="workspace-card helper-card">
              <div className="workspace-card__header">
                <div>
                  <span className="workspace-card__eyebrow">Live status</span>
                  <h2>Quick machine readout</h2>
                </div>
              </div>
              <div className="summary-list">
                <div className="summary-list__item">
                  <span>Media queue</span>
                  <strong>{String(mediaDiagnostics?.queueLength ?? 0)} jobs</strong>
                </div>
                <div className="summary-list__item">
                  <span>Average render time</span>
                  <strong>{formatDuration(mediaDiagnostics?.averageProcessingTimeMs)}</strong>
                </div>
                <div className="summary-list__item">
                  <span>Integrity issues</span>
                  <strong>{String(systemIntegrity?.issues.length ?? 0)}</strong>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </div>
    </div>
  )
}
