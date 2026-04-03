import axios from 'axios';
import {
  AnalyticsDashboard,
  AssetRecord,
  ContentIdeaRecord,
  ContentVariantRecord,
  CreativeBriefRecord,
  DashboardSummary,
  EventRecord,
  GrowthDashboard,
  GrowthInsightsDashboard,
  ImplementationSpec,
  LeaderboardRecord,
  OperatorSessionResponse,
  PlayerSnapshotRecord,
  PostRecord,
  PublishingJobRecord,
  ReferralRecord,
  SignalRecord
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
  getSummary: async () => (await api.get<DashboardSummary>('/dashboard')).data,
  getGrowthDashboard: async () => (await api.get<GrowthDashboard>('/v2/dashboard')).data,
  getImplementationSpec: async () => (await api.get<ImplementationSpec>('/v2/spec')).data,
  syncIntelligence: async (payload?: { days?: number; mode?: 'sync' | 'queue' }) =>
    (await api.post('/v2/intelligence/sync', payload ?? {})).data,
  getPlayerSnapshots: async (window: '24h' | '7d' | '30d') =>
    (await api.get<PlayerSnapshotRecord[]>('/v2/player-snapshots', { params: { window } })).data,
  getLeaderboards: async (window: '24h' | '7d' | '30d') =>
    (await api.get<LeaderboardRecord[]>('/v2/leaderboards', { params: { window } })).data,
  getSignals: async () => (await api.get<SignalRecord[]>('/v2/signals')).data,
  getContentIdeas: async () => (await api.get<ContentIdeaRecord[]>('/v2/content-ideas')).data,
  createBrief: async (ideaId: string, payload: Record<string, unknown>) =>
    (await api.post<CreativeBriefRecord>(`/v2/content-ideas/${ideaId}/briefs`, payload)).data,
  getCreativeBriefs: async () => (await api.get<CreativeBriefRecord[]>('/v2/creative-briefs')).data,
  generateVariants: async (briefId: string, count = 3) =>
    (await api.post<ContentVariantRecord[]>(`/v2/creative-briefs/${briefId}/variants`, { count })).data,
  getContentVariants: async () => (await api.get<ContentVariantRecord[]>('/v2/content-variants')).data,
  queueVariantMedia: async (variantId: string) => (await api.post(`/v2/content-variants/${variantId}/create-media`)).data,
  scheduleVariant: async (variantId: string, payload: Record<string, unknown>) =>
    (await api.post<PublishingJobRecord[]>(`/v2/content-variants/${variantId}/schedule`, payload)).data,
  publishVariantNow: async (variantId: string, platforms?: string[]) =>
    (await api.post<PublishingJobRecord[]>(`/v2/content-variants/${variantId}/publish-now`, platforms ? { platforms } : {})).data,
  getPublishingJobs: async () => (await api.get<PublishingJobRecord[]>('/v2/publishing-jobs')).data,
  trackPublishingJob: async (publishingJobId: string, payload: Record<string, unknown>) =>
    (await api.post<PublishingJobRecord>(`/v2/publishing-jobs/${publishingJobId}/track`, payload)).data,
  getInsights: async () => (await api.get<GrowthInsightsDashboard>('/v2/insights')).data,
  getPosts: async () => (await api.get<PostRecord[]>('/posts')).data,
  getPost: async (postId: string) => (await api.get<PostRecord>(`/posts/${postId}`)).data,
  getAnalytics: async () => (await api.get<AnalyticsDashboard>('/analytics')).data,
  getEvents: async () => (await api.get<EventRecord[]>('/events')).data,
  getReferrals: async () => (await api.get<ReferralRecord[]>('/referrals')).data,
  getAssets: async () => (await api.get<AssetRecord[]>('/assets')).data,
  generateContent: async (payload: Record<string, unknown>) => (await api.post('/generate-content', payload)).data,
  uploadAsset: async (payload: FormData) =>
    (await api.post('/assets/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  autoEditAsset: async (assetId: string, payload: Record<string, unknown>) =>
    (await api.post(`/assets/${assetId}/auto-edit`, payload)).data,
  attachAssetsToPost: async (postId: string, assetIds: string[]) =>
    (await api.post(`/posts/${postId}/assets`, { assetIds })).data,
  queueMedia: async (postId: string) => (await api.post(`/posts/${postId}/create-media`)).data,
  schedulePost: async (payload: Record<string, unknown>) => (await api.post('/schedule-post', payload)).data,
  publishNow: async (postId: string, platforms?: string[]) =>
    (await api.post(`/posts/${postId}/publish-now`, platforms ? { platforms } : {})).data,
  trackAnalytics: async (payload: Record<string, unknown>) => (await api.post('/analytics/track', payload)).data,
  createReferral: async (ownerUserId: string) => (await api.post('/referral', { action: 'create', ownerUserId })).data,
  createInvite: async (code: string, invitedUserId: string) =>
    (await api.post('/referral', { action: 'invite', code, invitedUserId })).data,
  rewardInvite: async (code: string, invitedUserId: string, rewardCents?: number) =>
    (await api.post('/referral', { action: 'reward', code, invitedUserId, rewardCents })).data
};

export const extractApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected request error';
};

export const isUnauthorizedError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 401;
