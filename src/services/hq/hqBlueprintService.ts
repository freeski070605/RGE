import {
  campaignKeys,
  contentFormats,
  gameIntelligenceSignalTypes,
  growthPlayScoreParts,
  growthPlayTypes,
  hqModules,
  hqPipeline,
  hqRoles,
  userTags
} from '../../hq/domain';

export const getHqBlueprint = () => ({
  productName: 'ReemTeam HQ',
  moduleName: 'RGE Growth Engine',
  language: {
    primaryWorkItem: 'Growth Play',
    mainDashboard: 'Command Center',
    intelligenceLayer: 'Game Intelligence',
    contentWorkspace: 'Content Studio'
  },
  modules: hqModules,
  pipeline: hqPipeline,
  roles: hqRoles,
  userTags,
  gameIntelligenceSignalTypes,
  growthPlayTypes,
  growthPlayScoreParts,
  campaigns: campaignKeys,
  contentFormats,
  commandCenterQuestion: 'What needs attention today?'
});
