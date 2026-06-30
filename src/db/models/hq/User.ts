import { InferSchemaType, Schema, model } from 'mongoose';
import { hqRoles, userTags } from '../../../hq/domain';

const UserProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'HQUser', required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    contact: {
      email: String,
      phone: String
    },
    tags: { type: [String], enum: userTags, default: [], index: true },
    lastActiveAt: { type: Date, index: true },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    reems: { type: Number, default: 0 },
    drops: { type: Number, default: 0 },
    caughtDrops: { type: Number, default: 0 },
    favoriteCribId: { type: Schema.Types.ObjectId, ref: 'Crib' },
    averageStake: { type: Number, default: 0 },
    highestStake: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    walletSummary: {
      balanceCents: { type: Number, default: 0 },
      pendingCents: { type: Number, default: 0 },
      lifetimeCreditsCents: { type: Number, default: 0 }
    },
    supportHistory: { type: [Schema.Types.Mixed], default: [] },
    riskFlags: { type: [String], default: [] }
  },
  {
    timestamps: true,
    collection: 'hq_user_profiles'
  }
);

const AdminNoteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'HQUser', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'HQUser' },
    note: { type: String, required: true },
    visibility: { type: String, enum: ['internal', 'owner_only'], default: 'internal' }
  },
  {
    timestamps: true,
    collection: 'admin_notes'
  }
);

const AdminActionLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'HQUser', index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'admin_action_logs'
  }
);

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    status: { type: String, enum: ['active', 'disabled', 'suspended'], default: 'active', index: true },
    role: { type: String, enum: hqRoles, default: 'player', index: true },
    disabledAt: Date,
    suspendedUntil: Date
  },
  {
    timestamps: true,
    collection: 'hq_users'
  }
);

export type HQUserDocument = InferSchemaType<typeof UserSchema> & { _id: string };
export type UserProfileDocument = InferSchemaType<typeof UserProfileSchema> & { _id: string };
export type AdminNoteDocument = InferSchemaType<typeof AdminNoteSchema> & { _id: string };
export type AdminActionLogDocument = InferSchemaType<typeof AdminActionLogSchema> & { _id: string };

export const HQUserModel = model('HQUser', UserSchema);
export const UserProfileModel = model('UserProfile', UserProfileSchema);
export const AdminNoteModel = model('AdminNote', AdminNoteSchema);
export const AdminActionLogModel = model('AdminActionLog', AdminActionLogSchema);
