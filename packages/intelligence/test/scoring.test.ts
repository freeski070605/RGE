import assert from 'node:assert/strict';
import test from 'node:test';
import { explainGrowthPlay, scoreGrowthPlay } from '../src/index.js';

test('Growth Play scoring rewards campaign fit and explains Why this', () => {
  const result = scoreGrowthPlay({
    playType: 'crib_promo',
    signalTypes: ['reem_detected', 'crib_heating_up_detected'],
    confidence: 91,
    occurredAt: new Date(),
    visibilitySafe: true,
    activeCampaign: 'promote_high_stake_cribs'
  });

  assert.equal(result.scoreParts.campaignFit, 92);
  assert.ok(result.finalScore > 70);

  const whyThis = explainGrowthPlay({
    signalTitles: ['The Back Room is heating up'],
    scoreParts: result.scoreParts,
    activeCampaign: 'promote_high_stake_cribs',
    recommendedAction: 'Promote the crib and raise its lobby priority.',
    visibilitySafe: true,
    riskFlags: []
  });

  assert.equal(whyThis.sourceSignals[0], 'The Back Room is heating up');
  assert.ok(whyThis.scoreBoosts.includes('campaignFit'));
  assert.equal(whyThis.penalties.length, 0);
});
