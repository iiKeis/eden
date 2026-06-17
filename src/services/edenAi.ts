import type { Plant, PlantScanResult, RecipeRecommendation } from '../types';

const knownPlants: Record<
  string,
  {
    detectedName: string;
    scientificName: string;
    growthStage: string;
    edibleStatus: PlantScanResult['edibleStatus'];
    harvestStatus: PlantScanResult['harvestStatus'];
    daysUntilHarvestEstimate: number | null;
    confidence: number;
    edibleConfidence: number;
    recipes: string[];
  }
> = {
  basil: {
    detectedName: 'Basil',
    scientificName: 'Ocimum basilicum',
    growthStage: 'Leafing with harvestable tips',
    edibleStatus: 'edible',
    harvestStatus: 'ready',
    daysUntilHarvestEstimate: 0,
    confidence: 0.96,
    edibleConfidence: 0.94,
    recipes: ['Tomato Basil Toast', 'Basil Yogurt Sauce'],
  },
  tomato: {
    detectedName: 'Cherry Tomato',
    scientificName: 'Solanum lycopersicum var. cerasiforme',
    growthStage: 'Flowering, not fruit-ready',
    edibleStatus: 'unknown',
    harvestStatus: 'not_ready',
    daysUntilHarvestEstimate: 28,
    confidence: 0.93,
    edibleConfidence: 0.42,
    recipes: ['Quick Tomato Pan Sauce', 'Warm Tomato Herb Bowl'],
  },
  mint: {
    detectedName: 'Mint',
    scientificName: 'Mentha spicata',
    growthStage: 'Harvestable',
    edibleStatus: 'edible',
    harvestStatus: 'ready',
    daysUntilHarvestEstimate: 0,
    confidence: 0.95,
    edibleConfidence: 0.93,
    recipes: ['Mint Cucumber Salad', 'Mint Lime Tea'],
  },
  thyme: {
    detectedName: 'Thyme',
    scientificName: 'Thymus vulgaris',
    growthStage: 'Established herb',
    edibleStatus: 'edible',
    harvestStatus: 'ready',
    daysUntilHarvestEstimate: 0,
    confidence: 0.94,
    edibleConfidence: 0.92,
    recipes: ['Thyme Roasted Potatoes', 'Lemon Thyme Butter'],
  },
};

export async function analyzePlantImage({
  imageUri,
  plant,
}: {
  imageUri: string;
  plant: Plant;
}): Promise<PlantScanResult> {
  await wait(900);

  const profile = knownPlants[plant.name.toLowerCase()] ?? {
    detectedName: plant.name,
    scientificName: 'Needs confirmation',
    growthStage: plant.stage,
    edibleStatus: 'unknown' as const,
    harvestStatus: 'unknown' as const,
    daysUntilHarvestEstimate: null,
    confidence: 0.58,
    edibleConfidence: 0.2,
    recipes: [],
  };
  const confidence = profile.confidence;
  const edibleConfidence = profile.edibleConfidence;

  return {
    id: `scan-${Date.now()}`,
    plantId: plant.id,
    imageUri,
    createdAt: new Date().toISOString(),
    detectedName: profile.detectedName,
    scientificName: profile.scientificName,
    confidence,
    confidenceLevel: confidence >= 0.8 ? 'high' : confidence >= 0.65 ? 'medium' : 'low',
    edibleStatus: profile.edibleStatus,
    edibleConfidence,
    harvestStatus: profile.harvestStatus,
    daysUntilHarvestEstimate: profile.daysUntilHarvestEstimate,
    growthStage: profile.growthStage,
    healthScore: Math.min(96, Math.max(40, plant.health + 4)),
    findings: [
      'Leaf color appears mostly even.',
      'No obvious pest pattern detected in the visible area.',
      plant.waterEveryDays <= 2
        ? 'Soil care should remain consistent this week.'
        : 'Let the top soil dry before watering again.',
    ],
    careInstructions: [
      ...buildCareInstructions(plant, profile.harvestStatus),
    ],
    safetyNote:
      profile.edibleStatus === 'edible'
        ? 'Confirm the plant identity before eating, especially if it was grown near chemicals or unknown soil.'
        : 'Do not eat this plant from AI identification alone. Confirm identity and edible parts first.',
    userConfirmationRequired: confidence < 0.9 || edibleConfidence < 0.9,
    qualityIssues:
      confidence >= 0.9
        ? []
        : [
            'Move closer to the leaves or fruit.',
            'Use natural light and avoid shadows.',
            'Keep one plant centered in the frame.',
          ],
    retakeRecommended: confidence < 0.9,
  };
}

export async function recommendRecipes({
  plant,
  scan,
}: {
  plant: Plant;
  scan: PlantScanResult;
}): Promise<RecipeRecommendation[]> {
  await wait(700);

  if (
    scan.edibleStatus !== 'edible' ||
    scan.confidence < 0.9 ||
    scan.edibleConfidence < 0.85 ||
    scan.harvestStatus !== 'ready'
  ) {
    return [];
  }

  const profile = knownPlants[scan.detectedName.toLowerCase()] ?? knownPlants[plant.name.toLowerCase()];
  const titles = profile?.recipes.length ? profile.recipes : [`Fresh ${plant.name} Bowl`];
  const cuisine = plant.recipeProfile.cuisines[0] ?? 'seasonal';
  const mealType = plant.recipeProfile.mealType || 'meal';

  return titles.map((title, index) => ({
    id: `recipe-${scan.id}-${index}`,
    scanId: scan.id,
    title,
    readyInMinutes: index === 0 ? 12 : 18,
    difficulty: 'easy',
    ingredients: [
      `Fresh ${scan.detectedName}`,
      plant.recipeProfile.availableIngredients[0] ?? 'Olive oil',
      plant.recipeProfile.availableIngredients[1] ?? 'Lemon or vinegar',
      plant.recipeProfile.availableIngredients[2] ?? 'Salt',
      index === 0 ? 'Toast or grains' : 'Yogurt or butter',
    ],
    steps: [
      'Rinse only the amount you plan to use.',
      'Trim healthy leaves or fruit from the plant.',
      'Combine with pantry ingredients and taste before serving.',
    ],
    harvestNote: `Use a small harvest from ${plant.name} so the plant keeps growing.`,
    matchReason: `Tailored for ${cuisine} ${mealType} preferences.`,
    safetyNote: scan.safetyNote,
  }));
}

function buildCareInstructions(
  plant: Plant,
  harvestStatus: PlantScanResult['harvestStatus'],
) {
  if (harvestStatus === 'ready') {
    return [
      `Harvest a small amount from ${plant.name} and leave enough growth for recovery.`,
      plant.careTip,
      `Keep it in ${plant.light.toLowerCase()} and scan again after harvesting.`,
    ];
  }

  if (harvestStatus === 'not_ready') {
    return [
      `Do not harvest ${plant.name} yet.`,
      plant.waterEveryDays <= 2
        ? `Water every ${plant.waterEveryDays} day(s), keeping soil evenly damp but not soaked.`
        : `Wait until the top inch of soil is dry, then water deeply.`,
      `Keep it in ${plant.light.toLowerCase()}.`,
      'Scan again in 5-7 days to check growth progress.',
    ];
  }

  return [
    'Do not harvest until the plant identity and edible stage are confirmed.',
    plant.careTip,
    `Keep it in ${plant.light.toLowerCase()} and scan again with a clearer photo.`,
  ];
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
