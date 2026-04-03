import { EventModel } from '../../db/models/Event';
import { PostModel } from '../../db/models/Post';

type CreateEventInput = {
  eventType: 'reem' | 'win' | 'streak' | 'table_amount' | 'deposit' | 'signup' | 'custom';
  playerId: string;
  amount?: number;
  turns?: number;
  streak?: number;
  tableAmount?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

export const createEventAndDraftPost = async (input: CreateEventInput, platforms: string[]) => {
  const event = await EventModel.create({
    eventType: input.eventType,
    playerId: input.playerId,
    amount: input.amount ?? 0,
    turns: input.turns ?? 0,
    streak: input.streak ?? 0,
    tableAmount: input.tableAmount ?? 0,
    source: input.source ?? 'api',
    metadata: input.metadata ?? {}
  });

  const post = await PostModel.create({
    eventId: event._id,
    platforms,
    schedule: {
      status: 'draft'
    },
    media: {
      status: 'pending'
    }
  });

  return { event, post };
};
