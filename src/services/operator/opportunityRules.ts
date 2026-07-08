type SignalLike = {
  signalType: string;
  sourceType?: string;
  sourceId?: string;
  username?: string;
  playerId?: string;
  amount?: number;
  stake?: number;
  tableId?: string;
  tableName?: string;
  matchId?: string;
  mode?: string;
  occurredAt: string | Date;
  window: '24h' | '7d' | '30d';
  metadata?: Record<string, unknown>;
  scores?: {
    noveltyScore?: number;
    performancePotentialScore?: number;
    brandFitScore?: number;
    urgencyScore?: number;
    overallPriorityScore?: number;
  };
  recommendedPlatforms?: string[];
};

type OpportunityBlueprint = {
  opportunityType: string;
  title: (player: string, signal: SignalLike) => string;
  whyItMatters: (player: string, signal: SignalLike) => string;
  angle: string;
  format: 'reel' | 'carousel' | 'story' | 'square';
  platforms: string[];
  goal: 'engagement' | 'community' | 'conversion';
  audience: 'social_audience' | 'active_players' | 'vip_players';
  cta: string;
  hook: string;
  templateRecommendation: string;
};

const leaderboardBlueprint = (metric: string): OpportunityBlueprint => {
  if (metric.includes('top_earners')) {
    return {
      opportunityType: 'biggest_earner',
      title: (player) => `${player} just climbed into top-earner territory`,
      whyItMatters: (player, signal) =>
        `${player} is leading the board with ${Math.round(signal.amount ?? 0)} in visible winnings.`,
      angle: 'Frame the player as the benchmark everyone else is chasing.',
      format: 'carousel',
      platforms: ['instagram', 'story'],
      goal: 'engagement',
      audience: 'social_audience',
      cta: 'Ask the audience who can knock them off the board next.',
      hook: 'Open with rank, then show what makes the climb impressive.',
      templateRecommendation: 'Leaderboard Lockup'
    };
  }

  if (metric.includes('most_reems')) {
    return {
      opportunityType: 'most_reems',
      title: (player) => `${player} is stacking the most reems right now`,
      whyItMatters: (player, signal) =>
        `${player} is turning repeated reem finishes into a clear community talking point.`,
      angle: 'Celebrate repeatable skill and let the board back up the claim.',
      format: 'carousel',
      platforms: ['instagram', 'story'],
      goal: 'engagement',
      audience: 'social_audience',
      cta: 'Invite the audience to call who is next to match the streak.',
      hook: 'Lead with the count, then connect it to dominance.',
      templateRecommendation: 'Board Proof'
    };
  }

  if (metric.includes('longest_streak')) {
    return {
      opportunityType: 'leaderboard_movement',
      title: (player) => `${player} keeps pushing the streak leaderboard`,
      whyItMatters: (player, signal) =>
        `${player} is extending a visible run and making the leaderboard shift around them.`,
      angle: 'Treat the leaderboard as live competitive tension, not just a static stat.',
      format: 'reel',
      platforms: ['instagram', 'story'],
      goal: 'engagement',
      audience: 'social_audience',
      cta: 'Ask viewers if they would fade the streak or ride it.',
      hook: 'Show the movement first, then the threat behind it.',
      templateRecommendation: 'Streak Tracker'
    };
  }

  return {
    opportunityType: 'hot_player',
    title: (player) => `${player} is heating up across the leaderboard`,
    whyItMatters: (player, signal) =>
      `${player} is showing up near the top of the board and creating a timely story for the feed.`,
    angle: 'Use leaderboard proof to make the player feel like the current headline.',
    format: 'carousel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'social_audience',
    cta: 'Invite viewers to pick the next player who will break through.',
    hook: 'Make the leaderboard change feel current and competitive.',
    templateRecommendation: 'Leaderboard Watch'
  };
};

const opportunityBlueprints: Record<string, OpportunityBlueprint> = {
  reem_moment: {
    opportunityType: 'reem_moment',
    title: (player, signal) => `${player} just landed a reem worth posting`,
    whyItMatters: (player, signal) =>
      `${player} created a clean gameplay headline with a result the audience can understand immediately.`,
    angle: 'Lead with the result and let the table reaction carry the energy.',
    format: 'reel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'social_audience',
    cta: 'Ask viewers if they saw it coming.',
    hook: 'Open on the decisive moment, then widen to the stakes.',
    templateRecommendation: 'Momentum Spotlight'
  },
  big_payout: {
    opportunityType: 'big_payout',
    title: (player, signal) => `${player} just pulled a huge payout on ReemTeam`,
    whyItMatters: (player, signal) =>
      `${player} turned a visible outcome into a strong “stop scrolling” money moment without leaning on deposit messaging.`,
    angle: 'Highlight the payout as the payoff to gameplay, not as a financial pitch.',
    format: 'reel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'social_audience',
    cta: 'Invite the audience to guess what hand changed the table.',
    hook: 'Reveal the payout first, then show how it happened.',
    templateRecommendation: 'Payout Pop'
  },
  high_stakes_win: {
    opportunityType: 'high_stakes_win',
    title: (player, signal) => `${player} closed out a high-stakes table`,
    whyItMatters: (player, signal) =>
      `${player} delivered a strong result in a table with visible pressure and higher perceived stakes.`,
    angle: 'Frame the table size and pressure before the winning beat.',
    format: 'reel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'active_players',
    cta: 'Challenge the audience to say whether they stay in that hand.',
    hook: 'Show the pressure, then the close.',
    templateRecommendation: 'High Stakes Heat'
  },
  win_streak: {
    opportunityType: 'win_streak',
    title: (player, signal) => `${player} is on a win streak the table can feel`,
    whyItMatters: (player, signal) =>
      `${player} is building repeat momentum, which creates a cleaner recurring storyline than a one-off result.`,
    angle: 'Make the streak feel inevitable and let the audience react to the run.',
    format: 'reel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'social_audience',
    cta: 'Ask who can break the run.',
    hook: 'Lead with the streak length, then the confidence around it.',
    templateRecommendation: 'Streak Pulse'
  },
  vip_win: {
    opportunityType: 'vip_win',
    title: (player, signal) => `${player} just gave VIP a loud win moment`,
    whyItMatters: (player, signal) =>
      `${player} pairs status with an actual game result, which makes the story feel earned instead of promotional.`,
    angle: 'Let the win justify the VIP framing rather than the other way around.',
    format: 'reel',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'vip_players',
    cta: 'Invite players to call the next VIP table headline.',
    hook: 'Show the result, then the VIP context.',
    templateRecommendation: 'VIP Signal'
  },
  promo_table_active: {
    opportunityType: 'promo_table_active',
    title: (_player, signal) => `${signal.tableName || 'Promo Content Table'} is ready for a promo story`,
    whyItMatters: (_player, signal) => {
      const aiPlayers = Array.isArray(signal.metadata?.aiPlayers) ? signal.metadata.aiPlayers.length : undefined;
      return `The promo table is live with ${aiPlayers ?? signal.amount ?? 'AI'} players, giving RGE a controlled gameplay setup it can turn into content immediately.`;
    },
    angle: 'Frame the AI-player matchup as a live table prompt and invite players to watch or jump into the next real game.',
    format: 'story',
    platforms: ['instagram', 'story'],
    goal: 'engagement',
    audience: 'active_players',
    cta: 'Ask viewers which AI player they would back at the table.',
    hook: 'Open with the promo table name, then show the AI matchup.',
    templateRecommendation: 'Promo Table Pulse'
  },
  referral_momentum: {
    opportunityType: 'referral_momentum',
    title: (player, signal) => `${player} is bringing new energy into ReemTeam`,
    whyItMatters: (player, signal) =>
      `${player} is creating community momentum that can connect gameplay and growth loops without disrupting the daily posting flow.`,
    angle: 'Treat it as a social proof community moment, not a hard-sell referral pitch.',
    format: 'story',
    platforms: ['instagram', 'story'],
    goal: 'community',
    audience: 'social_audience',
    cta: 'Invite the audience to bring a friend into the next session.',
    hook: 'Open with the community payoff, then the invite action.',
    templateRecommendation: 'Community Spark'
  }
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const isOperatorFacingSignal = (signalType: string) => signalType !== 'deposit_momentum';

export const resolveOpportunityBlueprint = (signal: SignalLike): OpportunityBlueprint => {
  if (signal.signalType.startsWith('leaderboard_')) {
    return leaderboardBlueprint(signal.signalType.replace(/^leaderboard_/, ''));
  }

  return opportunityBlueprints[signal.signalType] ?? {
    opportunityType: 'community_moment',
    title: (player) => `${player} just created a fresh community moment`,
    whyItMatters: (player) =>
      `${player} triggered a new gameplay story that is timely enough to surface for review.`,
    angle: 'Lead with what changed and keep the framing simple.',
    format: 'square',
    platforms: ['instagram'],
    goal: 'engagement',
    audience: 'social_audience',
    cta: 'Ask the audience what they would do next.',
    hook: 'Keep the first line crisp and outcome-first.',
    templateRecommendation: 'Quick Hit'
  };
};

export const computeFreshnessScore = (occurredAt: string | Date) => {
  const eventTime = new Date(occurredAt).getTime();
  const ageHours = Math.max(0, (Date.now() - eventTime) / (60 * 60 * 1000));
  return clamp(Math.round(100 - ageHours * 6), 12, 100);
};

export const computeOpportunityMetrics = (signal: SignalLike) => {
  const freshnessScore = computeFreshnessScore(signal.occurredAt);
  const engagementPotential = signal.scores?.performancePotentialScore ?? 50;
  const conversionPotential = clamp(
    Math.round((signal.scores?.brandFitScore ?? 50) * 0.55 + (signal.amount ?? 0) * 0.4),
    25,
    100
  );
  const noveltyPenalty = signal.scores?.noveltyScore ? clamp(100 - signal.scores.noveltyScore, 0, 60) : 18;
  const brandFitScore = signal.scores?.brandFitScore ?? 50;
  const overallPriority = clamp(
    Math.round(
      freshnessScore * 0.3 +
        engagementPotential * 0.28 +
        conversionPotential * 0.16 +
        brandFitScore * 0.18 +
        (signal.scores?.urgencyScore ?? 50) * 0.16 -
        noveltyPenalty * 0.08
    ),
    1,
    100
  );

  return {
    freshnessScore,
    engagementPotential,
    conversionPotential,
    noveltyPenalty,
    brandFitScore,
    overallPriority
  };
};

export const buildOpportunityDraftFromSignal = (signal: SignalLike) => {
  if (!isOperatorFacingSignal(signal.signalType)) {
    return null;
  }

  const player = signal.username || signal.playerId || 'ReemTeam player';
  const blueprint = resolveOpportunityBlueprint(signal);
  const metrics = computeOpportunityMetrics(signal);
  const urgency =
    metrics.freshnessScore >= 85 || (signal.scores?.urgencyScore ?? 0) >= 85
      ? 'critical'
      : metrics.freshnessScore >= 60
        ? 'high'
        : metrics.freshnessScore >= 35
          ? 'medium'
          : 'low';

  return {
    ideaType: blueprint.opportunityType.includes('leaderboard') ? 'leaderboard' : 'game_highlight',
    opportunityType: blueprint.opportunityType,
    goal: blueprint.goal,
    audience: blueprint.audience,
    platformRecommendation: signal.recommendedPlatforms?.length ? signal.recommendedPlatforms : blueprint.platforms,
    priorityScore: metrics.overallPriority,
    headline: blueprint.title(player, signal),
    reason: `${signal.signalType.replace(/_/g, ' ')} surfaced because it is fresh, visible, and likely to translate into a clean story.`,
    whyItMatters: blueprint.whyItMatters(player, signal),
    hookAngle: blueprint.hook,
    recommendedContentAngle: blueprint.angle,
    recommendedFormat: blueprint.format,
    recommendedPlatforms: signal.recommendedPlatforms?.length ? signal.recommendedPlatforms : blueprint.platforms,
    ctaAngle: blueprint.cta,
    urgency,
    confidenceScore: clamp(
      Math.round((signal.scores?.overallPriorityScore ?? metrics.overallPriority) * 0.65 + metrics.freshnessScore * 0.35),
      1,
      100
    ),
    estimatedValue: clamp(
      Math.round(metrics.engagementPotential * 0.5 + metrics.conversionPotential * 0.3 + metrics.freshnessScore * 0.2),
      1,
      100
    ),
    whyThisRecommendation: [
      `Freshness scored ${metrics.freshnessScore}/100.`,
      `Engagement potential scored ${metrics.engagementPotential}/100.`,
      `Brand fit scored ${metrics.brandFitScore}/100.`,
      `Recommended format is ${blueprint.format} because the moment is easiest to understand in a fast social frame.`
    ].join(' '),
    linkedPlayers: signal.playerId ? [signal.playerId] : [],
    campaignTags: [signal.window, blueprint.opportunityType, signal.signalType],
    sourceEventIds: [signal.sourceId],
    status: 'proposed' as const
  };
};
