import { AdminActionLog } from './models.js';
import { Operator } from './auth.js';

export const logAdminAction = async (
  actor: Operator,
  input: {
    actionType: string;
    targetType: string;
    targetId: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
) => {
  await AdminActionLog.create({
    actorId: actor.id,
    actorRole: actor.role,
    ...input
  });
};
