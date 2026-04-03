import { OperatorSettingModel } from '../../db/models/OperatorSetting';

const serializeSettings = (settings: any, operatorEmail: string) => ({
  operatorEmail,
  mode: settings?.mode ?? 'assisted',
  approvedPlatforms: settings?.approvedPlatforms ?? ['instagram', 'story'],
  approvedFormats: settings?.approvedFormats ?? ['reel', 'carousel', 'story', 'square'],
  avoidNarrativeRepeatHours: settings?.avoidNarrativeRepeatHours ?? 24,
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
        avoidNarrativeRepeatHours: 24
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
  }
) => {
  const settings = await OperatorSettingModel.findOneAndUpdate(
    { operatorEmail },
    {
      $set: {
        ...(updates.mode ? { mode: updates.mode } : {})
      },
      $setOnInsert: {
        operatorEmail
      }
    },
    { upsert: true, new: true }
  ).lean();

  return serializeSettings(settings, operatorEmail);
};
