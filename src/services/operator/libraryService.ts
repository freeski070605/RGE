import { AssetModel } from '../../db/models/Asset';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { toAssetUrl } from '../../utils/publicPaths';

const visualPresets = [
  { id: 'momentum-spotlight', name: 'Momentum Spotlight', description: 'High-energy gameplay moments with bold outcome-first overlays.' },
  { id: 'board-breakdown', name: 'Board Breakdown', description: 'Multi-beat carousel framing for leaderboards and teaching moments.' },
  { id: 'community-spark', name: 'Community Spark', description: 'Lighter social framing for referral and community storylines.' },
  { id: 'high-stakes-heat', name: 'High Stakes Heat', description: 'Pressure-first visual framing for high-stakes wins.' }
];

const brandVoicePresets = [
  { id: 'competitive-social', name: 'Competitive and social-first' },
  { id: 'celebratory-hype', name: 'Celebratory and high-energy' },
  { id: 'sharp-conversion', name: 'Sharp and conversion-focused' }
];

export const getLibraryView = async () => {
  const [assets, variants] = await Promise.all([
    AssetModel.find().sort({ updatedAt: -1 }).limit(40).lean(),
    ContentVariantModel.find().sort({ updatedAt: -1 }).limit(60).lean()
  ]);

  const hookPatterns = variants
    .map((variant) => variant.hook)
    .filter(Boolean)
    .slice(0, 12)
    .map((hook, index) => ({ id: `hook-${index}`, hook }));
  const ctaTemplates = [...new Set(variants.map((variant) => variant.cta).filter(Boolean))]
    .slice(0, 12)
    .map((cta, index) => ({ id: `cta-${index}`, cta }));

  return {
    assets: assets.map((asset) => ({
      id: String(asset._id),
      title: asset.title,
      kind: asset.kind,
      tags: asset.tags ?? [],
      editorStatus: asset.editorStatus,
      preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath)
    })),
    visualPresets,
    overlays: [
      'Outcome first',
      'Table pressure',
      'Leaderboard movement',
      'Community callout'
    ],
    templates: visualPresets,
    hookPatterns,
    ctaTemplates,
    brandVoicePresets,
    reusableCaptionComponents: [
      'Lead with the visible result.',
      'Add the stakes in one short line.',
      'Close with a community-first CTA.'
    ]
  };
};
