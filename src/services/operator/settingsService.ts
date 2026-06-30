import { OperatorSettingModel } from '../../db/models/OperatorSetting';

const serializeSettings = (settings: any, operatorEmail: string) => ({
  operatorEmail,
  mode: settings?.mode ?? 'assisted',
  approvedPlatforms: settings?.approvedPlatforms ?? ['instagram', 'story'],
  approvedFormats: settings?.approvedFormats ?? ['reel', 'carousel', 'story', 'square'],
  avoidNarrativeRepeatHours: settings?.avoidNarrativeRepeatHours ?? 24,
  activeCampaign: settings?.activeCampaign ?? 'none',
  updatedAt: settings?.updatedAt ?? null
});

export const getOperatorSettings = async (operatorEmail: string) => {
  const settings = await OperatorSettingModel.findOneAndUpdate(
    { operatorEmail },
    {
      $setOnInsert: {
        operatorEmail,
        mode: 'assisted',
        approvedPlatforms: ['instagram', 'story'],
        approvedFormats: ['reel', 'carousel', 'story', 'square'],
        avoidNarrativeRepeatHours: 24,
        activeCampaign: 'none'
      }
    },
    { upsert: true, new: true }
  ).lean();

  return serializeSettings(settings, operatorEmail);
};

export const updateOperatorSettings = async (
  operatorEmail: string,
  updates: {
    mode?: 'autopilot' | 'assisted' | 'manual';
    activeCampaign?:
      | 'none'
      | 'weekend_push'
      | 'event_night'
      | 'referral_growth'
      | 'leaderboard_race'
      | 'high_stakes_promo'
      | 'new_player_activation'
      | 'inactive_player_reactivation';
  }
) => {
  const settings = await OperatorSettingModel.findOneAndUpdate(
    { operatorEmail },
    {
      $set: {
        ...(updates.mode ? { mode: updates.mode } : {}),
        ...(updates.activeCampaign ? { activeCampaign: updates.activeCampaign } : {})
      },
      $setOnInsert: {
        operatorEmail
      }
    },
    { upsert: true, new: true }
  ).lean();

  return serializeSettings(settings, operatorEmail);
};
