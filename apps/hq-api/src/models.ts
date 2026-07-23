import { hqRoles, playerTags, signalTypes, growthPlayTypes, campaignTypes } from '@reemteam/shared';
import { InferSchemaType, Schema, model } from 'mongoose';

const objectId = Schema.Types.ObjectId;

const AdminActionLogSchema = new Schema(
  {
    actorId: { type: String, index: true },
    actorRole: { type: String, enum: hqRoles, required: true, index: true },
    actionType: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_action_logs' }
);

const UserSchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['active', 'disabled', 'suspended'], default: 'active', index: true },
    role: { type: String, enum: hqRoles, default: 'player', index: true },
    tags: { type: [String], enum: playerTags, default: [], index: true },
    adminNotes: {
      type: [
        {
          note: String,
          actorId: String,
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    lastActiveAt: Date,
    favoriteCrib: String,
    averageStake: { type: Number, default: 0 },
    highestStake: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    reems: { type: Number, default: 0 },
    drops: { type: Number, default: 0 },
    caughtDrops: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    rtcBalance: { type: Number, default: 0 },
    walletSummary: {
      credits: { type: Number, default: 0 },
      winnings: { type: Number, default: 0 },
      promotionalCredits: { type: Number, default: 0 },
      referralCredits: { type: Number, default: 0 }
    },
    supportHistory: { type: [Schema.Types.Mixed], default: [] },
    riskFlags: { type: [String], default: [] },
    contentSafe: { type: Boolean, default: true },
    legacy: {
      sourceCollection: { type: String, index: true },
      sourceId: { type: String, index: true },
      profileId: { type: String, index: true },
      importedAt: Date
    }
  },
  { timestamps: true, collection: 'users' }
);

const UserProfileSchema = new Schema(
  {
    userId: { type: objectId, ref: 'User', required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    contact: {
      email: String,
      phone: String
    },
    tags: { type: [String], enum: playerTags, default: [], index: true },
    summary: { type: Schema.Types.Mixed, default: {} },
    riskFlags: { type: [String], default: [] },
    contentSafe: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'user_profiles' }
);

const AdminNoteSchema = new Schema(
  {
    userId: { type: objectId, ref: 'User', required: true, index: true },
    actorId: { type: String, index: true },
    note: { type: String, required: true },
    visibility: { type: String, enum: ['internal', 'owner_only'], default: 'internal' }
  },
  { timestamps: true, collection: 'admin_notes' }
);

const CribSchema = new Schema(
  {
    cribName: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '' },
    stakeTier: { type: String, required: true, index: true },
    theme: { type: String, default: 'classic' },
    status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active', index: true },
    featured: { type: Boolean, default: false },
    growthPriority: { type: Number, default: 0 },
    eventEligible: { type: Boolean, default: true },
    visualStyle: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'cribs' }
);

const TableSchema = new Schema(
  {
    tableName: { type: String, required: true, trim: true },
    cribId: { type: objectId, ref: 'Crib', required: true, index: true },
    stake: { type: Number, required: true },
    maxSeats: { type: Number, default: 4 },
    status: { type: String, enum: ['open', 'active', 'paused', 'closed'], default: 'open', index: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    eventTable: { type: Boolean, default: false },
    aiFillEnabled: { type: Boolean, default: false },
    minimumBalance: { type: Number, default: 0 },
    ruleset: { type: String, default: 'standard' },
    theme: { type: String, default: 'classic' },
    priority: { type: Number, default: 0 },
    featured: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'tables' }
);

const EventSchema = new Schema(
  {
    eventName: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    eligibleCribs: { type: [objectId], ref: 'Crib', default: [] },
    eligibleTables: { type: [objectId], ref: 'Table', default: [] },
    stakeRange: { min: Number, max: Number },
    rewardRules: { type: Schema.Types.Mixed, default: {} },
    leaderboardRules: { type: Schema.Types.Mixed, default: {} },
    contentGoal: { type: String, default: '' },
    growthGoal: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'scheduled', 'running', 'paused', 'ended', 'archived'], default: 'draft', index: true }
  },
  { timestamps: true, collection: 'events' }
);

const GameIntelligenceSignalSchema = new Schema(
  {
    signalType: { type: String, enum: signalTypes, required: true, index: true },
    sourceType: { type: String, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    playerId: { type: objectId, ref: 'User' },
    tableId: { type: objectId, ref: 'Table' },
    cribId: { type: objectId, ref: 'Crib' },
    eventId: { type: objectId, ref: 'Event' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    confidence: { type: Number, default: 50 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    visibilitySafe: { type: Boolean, default: true },
    status: { type: String, enum: ['new', 'ranked', 'converted', 'dismissed'], default: 'new', index: true }
  },
  { timestamps: true, collection: 'game_intelligence_signals' }
);

const GrowthPlaySchema = new Schema(
  {
    title: { type: String, required: true },
    goal: { type: String, required: true },
    playType: { type: String, enum: growthPlayTypes, required: true },
    sourceSignalIds: { type: [objectId], ref: 'GameIntelligenceSignal', default: [] },
    targetUserId: { type: objectId, ref: 'User' },
    targetCribId: { type: objectId, ref: 'Crib' },
    targetTableId: { type: objectId, ref: 'Table' },
    targetEventId: { type: objectId, ref: 'Event' },
    recommendedAction: { type: String, required: true },
    recommendedChannel: { type: String, required: true },
    recommendedFormat: { type: String, required: true },
    whyItMatters: { type: String, required: true },
    whyThis: { type: Schema.Types.Mixed, required: true },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    confidence: { type: Number, default: 50 },
    estimatedValue: { type: Number, default: 0 },
    scoreParts: { type: Schema.Types.Mixed, required: true },
    finalScore: { type: Number, default: 0, index: true },
    riskFlags: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'approved', 'dismissed', 'executed', 'expired'], default: 'open', index: true },
    expiresAt: Date
  },
  { timestamps: true, collection: 'growth_plays' }
);

const CampaignSchema = new Schema(
  {
    campaignName: { type: String, required: true },
    campaignType: { type: String, enum: campaignTypes, required: true },
    description: { type: String, default: '' },
    startTime: Date,
    endTime: Date,
    targetCribs: { type: [objectId], ref: 'Crib', default: [] },
    targetTables: { type: [objectId], ref: 'Table', default: [] },
    targetSegments: { type: [String], default: [] },
    priority: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft' },
    scoringBoosts: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'campaigns' }
);

const ContentDraftSchema = new Schema(
  {
    growthPlayId: { type: objectId, ref: 'GrowthPlay' },
    title: { type: String, required: true },
    format: { type: String, required: true },
    channel: { type: String, required: true },
    caption: { type: String, default: '' },
    hook: { type: String, default: '' },
    overlayText: { type: String, default: '' },
    cta: { type: String, default: '' },
    selectedAssets: { type: [String], default: [] },
    previewUrl: String,
    status: { type: String, enum: ['draft', 'needs_review', 'approved', 'scheduled', 'published', 'archived'], default: 'draft' },
    scheduledFor: Date,
    publishedAt: Date,
    publishedDestination: String,
    publishMode: { type: String, enum: ['internal_record', 'external_adapter'], default: 'internal_record' },
    publishNotes: { type: String, default: 'Marked as published inside ReemTeamHQ. External channel adapters are not connected yet.' },
    performanceResultId: String
  },
  { timestamps: true, collection: 'content_drafts' }
);

const WalletLedgerSchema = new Schema(
  {
    userId: { type: objectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit', 'adjustment'], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    suspicious: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'wallet_ledger' }
);

const ReferralSchema = new Schema(
  {
    ownerUserId: { type: objectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    invitedUserId: { type: objectId, ref: 'User' },
    status: { type: String, enum: ['active', 'converted', 'rewarded', 'flagged'], default: 'active', index: true },
    rewardAmount: { type: Number, default: 0 },
    abuseFlags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'referrals' }
);

const SupportIssueSchema = new Schema(
  {
    userId: { type: objectId, ref: 'User' },
    title: { type: String, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    notes: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'support_issues' }
);

const PerformanceResultSchema = new Schema(
  {
    contentDraftId: { type: objectId, ref: 'ContentDraft' },
    growthPlayId: { type: objectId, ref: 'GrowthPlay' },
    campaignId: { type: objectId, ref: 'Campaign' },
    channel: { type: String, required: true },
    format: { type: String, default: '' },
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    learning: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'performance_results' }
);

const HQSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: '' }
  },
  { timestamps: true, collection: 'hq_settings' }
);

const SystemHealthCheckSchema = new Schema(
  {
    component: { type: String, required: true, index: true },
    status: { type: String, enum: ['Healthy', 'Warning', 'Broken'], required: true, index: true },
    detail: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    checkedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: 'system_health_checks' }
);

export type UserDocument = InferSchemaType<typeof UserSchema> & { _id: unknown };
export type GameIntelligenceSignalDocument = InferSchemaType<typeof GameIntelligenceSignalSchema> & { _id: unknown };

export const AdminActionLog = model('AdminActionLog', AdminActionLogSchema);
export const User = model('User', UserSchema);
export const UserProfile = model('UserProfile', UserProfileSchema);
export const AdminNote = model('AdminNote', AdminNoteSchema);
export const Crib = model('Crib', CribSchema);
export const Table = model('Table', TableSchema);
export const Event = model('Event', EventSchema);
export const GameIntelligenceSignal = model('GameIntelligenceSignal', GameIntelligenceSignalSchema);
export const GrowthPlay = model('GrowthPlay', GrowthPlaySchema);
export const Campaign = model('Campaign', CampaignSchema);
export const ContentDraft = model('ContentDraft', ContentDraftSchema);
export const WalletLedger = model('WalletLedger', WalletLedgerSchema);
export const Referral = model('Referral', ReferralSchema);
export const SupportIssue = model('SupportIssue', SupportIssueSchema);
export const PerformanceResult = model('PerformanceResult', PerformanceResultSchema);
export const HQSetting = model('HQSetting', HQSettingSchema);
export const SystemHealthCheck = model('SystemHealthCheck', SystemHealthCheckSchema);
