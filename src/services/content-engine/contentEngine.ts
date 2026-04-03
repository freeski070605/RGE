import OpenAI from 'openai';
import { env } from '../../config/env';
import { EventModel } from '../../db/models/Event';
import { PostModel } from '../../db/models/Post';
import { AppError } from '../../utils/errors';
import { getStrategySnapshot } from '../strategy/strategyService';

type GeneratedContent = {
  captions: string[];
  hook: string;
  hashtags: string[];
  overlayText: string;
  cta: string;
};

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      organization: env.OPENAI_ORGANIZATION || undefined
    })
  : null;

const safeParseJson = (value: string): GeneratedContent | null => {
  try {
    return JSON.parse(value) as GeneratedContent;
  } catch {
    return null;
  }
};

const buildFallbackContent = (event: {
  eventType: string;
  playerId: string;
  amount: number;
  turns: number;
  streak: number;
  tableAmount: number;
}): GeneratedContent => {
  const baseAmount = event.amount > 0 ? `$${event.amount}` : `${event.tableAmount} chips`;
  const hook = `ReemTeam just saw ${event.playerId} hit a ${event.eventType.toUpperCase()} moment`;
  const captions = [
    `${event.playerId} turned ${event.turns || 1} moves into a ${baseAmount} swing. Momentum changed fast at the table.`,
    `That ${event.eventType} landed hard. ${event.playerId} pushed the table with ${baseAmount} on the line.`,
    `${event.playerId} is building heat${event.streak ? ` with a ${event.streak}-play streak` : ''}. This is why ReemTeam rounds stay loud.`
  ];
  const hashtags = ['#ReemTeam', '#CardGameClips', '#GamingMoments', '#Reem', '#BigWin'];

  return {
    captions,
    hook,
    hashtags,
    overlayText: `${event.eventType.toUpperCase()} ${baseAmount}`,
    cta: 'Tap in for the next table swing.'
  };
};

const generateWithOpenAI = async (input: {
  event: {
    eventType: string;
    playerId: string;
    amount: number;
    turns: number;
    streak: number;
    tableAmount: number;
    metadata: Record<string, unknown>;
  };
  strategy: string;
}): Promise<GeneratedContent> => {
  if (!openaiClient) {
    return buildFallbackContent(input.event);
  }

  const response = await openaiClient.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are ReemGrowth Engine, a social content strategist for a competitive card gaming brand. Produce concise, high-energy output that feels social-first and authentic.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Create marketing copy for this gameplay event.\nStrategy guidance: ${input.strategy}\nEvent JSON: ${JSON.stringify(
              input.event
            )}\nReturn JSON with keys captions, hook, hashtags, overlayText, cta. Captions must contain exactly 3 strings.`
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_object'
      }
    }
  } as never);

  const parsed = safeParseJson(response.output_text);
  if (!parsed || parsed.captions.length < 3) {
    return buildFallbackContent(input.event);
  }

  return {
    captions: parsed.captions.slice(0, 3),
    hook: parsed.hook,
    hashtags: parsed.hashtags.map((hashtag) => (hashtag.startsWith('#') ? hashtag : `#${hashtag}`)).slice(0, 8),
    overlayText: parsed.overlayText,
    cta: parsed.cta
  };
};

export const generateContentForPost = async (postId: string) => {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  const event = await EventModel.findById(post.eventId).lean();
  if (!event) {
    throw new AppError('Source event not found', 404);
  }

  const strategy = await getStrategySnapshot();
  const content = await generateWithOpenAI({
    event: {
      eventType: event.eventType,
      playerId: event.playerId,
      amount: event.amount,
      turns: event.turns,
      streak: event.streak,
      tableAmount: event.tableAmount,
      metadata: event.metadata ?? {}
    },
    strategy: strategy.instructions
  });

  post.caption = content.captions[0];
  post.captionOptions = content.captions;
  post.hook = content.hook;
  post.hashtags = content.hashtags;
  post.cta = content.cta;
  post.overlayText = content.overlayText;
  post.aiMetadata = {
    model: openaiClient ? env.OPENAI_MODEL : 'deterministic-fallback',
    promptVersion: 'v1',
    strategyNotes: strategy.winningHooks.concat(strategy.winningHashtags)
  };
  const schedule = post.schedule ?? ((post.schedule = { status: 'draft' } as never), post.schedule);
  schedule.status = 'content_ready';

  await post.save();
  await EventModel.findByIdAndUpdate(post.eventId, { status: 'processed' });

  return post;
};
