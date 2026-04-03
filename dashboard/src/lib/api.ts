import axios from 'axios';
import {
  AssetRecord,
  CalendarView,
  CommandCenterView,
  ContentItemRecord,
  GrowthLoopsView,
  LibraryView,
  MediaDiagnosticsView,
  OperatorSessionResponse,
  OperatorSettingsRecord,
  OpportunityRecord,
  PerformanceView,
  PipelineView,
  ReferralRecord,
  SystemIntegrityView,
  SystemHealthView,
  WorkersStatusView
} from './types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

export const dashboardApi = {
  getSession: async () => (await api.get<OperatorSessionResponse>('/auth/me')).data,
  login: async (payload: { email: string; password: string }) =>
    (await api.post<OperatorSessionResponse>('/auth/login', payload)).data,
  logout: async () => api.post('/auth/logout'),
  syncIntelligence: async (payload?: { days?: number; mode?: 'sync' | 'queue' }) =>
    (await api.post('/v2/intelligence/sync', payload ?? {})).data,
  getCommandCenter: async () => (await api.get<CommandCenterView>('/command-center')).data,
  getOpportunities: async () => (await api.get<OpportunityRecord[]>('/opportunities')).data,
  createContentItemFromOpportunity: async (opportunityId: string) =>
    (await api.post<ContentItemRecord>(`/opportunities/${opportunityId}/create-content-item`)).data,
  saveOpportunityForLater: async (opportunityId: string) =>
    (await api.post(`/opportunities/${opportunityId}/save-for-later`)).data,
  dismissOpportunity: async (opportunityId: string) => (await api.post(`/opportunities/${opportunityId}/dismiss`)).data,
  getPipeline: async () => (await api.get<PipelineView>('/pipeline')).data,
  getContentItem: async (itemId: string) => (await api.get<ContentItemRecord>(`/content-items/${itemId}`)).data,
  generateContentItemCopy: async (itemId: string, count = 3) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/generate-copy`, { count })).data,
  generateContentItemMedia: async (itemId: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/generate-media`)).data,
  approveContentItem: async (itemId: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/approve`)).data,
  saveContentItemDraft: async (itemId: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/save-draft`)).data,
  selectContentItemVariant: async (itemId: string, variantId: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/select-variant`, { variantId })).data,
  selectContentItemVisualPreset: async (itemId: string, preset: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/select-visual-preset`, { preset })).data,
  scheduleContentItem: async (itemId: string, scheduledFor: string, platforms?: string[]) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/schedule`, { scheduledFor, platforms })).data,
  publishContentItemNow: async (itemId: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/publish-now`)).data,
  archiveContentItem: async (itemId: string, reason?: string) =>
    (await api.post<ContentItemRecord>(`/content-items/${itemId}/archive`, reason ? { reason } : {})).data,
  getCalendar: async () => (await api.get<CalendarView>('/calendar')).data,
  getPerformance: async () => (await api.get<PerformanceView>('/performance')).data,
  getLibrary: async () => (await api.get<LibraryView>('/library')).data,
  getGrowthLoops: async () => (await api.get<GrowthLoopsView>('/growth-loops')).data,
  getSettings: async () => (await api.get<OperatorSettingsRecord>('/settings')).data,
  updateSettings: async (payload: Partial<Pick<OperatorSettingsRecord, 'mode'>>) =>
    (await api.patch<OperatorSettingsRecord>('/settings', payload)).data,
  getSystemHealth: async () => (await api.get<SystemHealthView>('/system-health')).data,
  getSystemIntegrity: async () => (await api.get<SystemIntegrityView>('/system-integrity')).data,
  getWorkersStatus: async () => (await api.get<WorkersStatusView>('/workers/status')).data,
  getMediaDiagnostics: async () => (await api.get<MediaDiagnosticsView>('/media/diagnostics')).data,
  getAssets: async () => (await api.get<AssetRecord[]>('/assets')).data,
  uploadAsset: async (payload: FormData) =>
    (await api.post('/assets/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  autoEditAsset: async (assetId: string, payload: Record<string, unknown>) =>
    (await api.post(`/assets/${assetId}/auto-edit`, payload)).data,
  deleteAsset: async (assetId: string) => (await api.delete(`/assets/${assetId}`)).data,
  createReferral: async (ownerUserId: string) => (await api.post('/referral', { action: 'create', ownerUserId })).data,
  createInvite: async (code: string, invitedUserId: string) =>
    (await api.post('/referral', { action: 'invite', code, invitedUserId })).data,
  rewardInvite: async (code: string, invitedUserId: string, rewardCents?: number) =>
    (await api.post('/referral', { action: 'reward', code, invitedUserId, rewardCents })).data,
  getReferrals: async () => (await api.get<ReferralRecord[]>('/referrals')).data
};

export const extractApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected request error';
};

export const isUnauthorizedError = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 401;
