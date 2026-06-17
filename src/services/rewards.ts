import type { PlantScanResult, RewardPolicy } from '../types';

export const rewardPolicy: RewardPolicy = {
  dailyXpCap: 120,
  duplicateWindowHours: 12,
  requiresHighConfidenceScan: true,
  requiresPhotoProof: true,
};

export function canAwardScanXp({
  hasPhoto,
  scan,
}: {
  hasPhoto: boolean;
  scan?: PlantScanResult;
}) {
  if (rewardPolicy.requiresPhotoProof && !hasPhoto) {
    return false;
  }

  if (rewardPolicy.requiresHighConfidenceScan && scan?.confidenceLevel !== 'high') {
    return false;
  }

  return true;
}
