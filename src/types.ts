export type TabKey = 'today' | 'garden' | 'log' | 'rewards' | 'profile';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type Plant = {
  id: string;
  name: string;
  variety: string;
  location: string;
  stage: string;
  health: number;
  waterEveryDays: number;
  light: string;
  nextCare: string;
  careTip: string;
  color: string;
  createdAt: string;
  lastScanId?: string;
  recipeProfile: RecipeProfile;
};

export type CareTask = {
  id: string;
  plantId: string;
  action: string;
  instruction: string;
  xp: number;
  order: number;
};

export type CareEntry = {
  id: string;
  plantId: string;
  date: string;
  note: string;
  xp: number;
  photoUri?: string;
  scanId?: string;
};

export type Reward = {
  id: string;
  title: string;
  cost: number;
  partner: string;
  status: 'available' | 'locked' | 'soon';
};

export type PlantScanResult = {
  id: string;
  plantId: string;
  imageUri: string;
  createdAt: string;
  detectedName: string;
  scientificName: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  edibleStatus: 'edible' | 'not_edible' | 'unknown';
  edibleConfidence: number;
  harvestStatus: 'ready' | 'not_ready' | 'unknown';
  daysUntilHarvestEstimate: number | null;
  growthStage: string;
  healthScore: number;
  findings: string[];
  careInstructions: string[];
  safetyNote: string;
  userConfirmationRequired: boolean;
  qualityIssues: string[];
  retakeRecommended: boolean;
};

export type RecipeRecommendation = {
  id: string;
  scanId: string;
  title: string;
  readyInMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: string[];
  steps: string[];
  harvestNote: string;
  matchReason: string;
  safetyNote: string;
};

export type RecipeProfile = {
  dietaryPreferences: string[];
  allergies: string[];
  availableIngredients: string[];
  cuisines: string[];
  dislikes: string[];
  mealType: string;
  skillLevel: 'easy' | 'medium' | 'advanced';
};

export type UserProfile = {
  id: string;
  displayName: string;
  recipeProfile: RecipeProfile;
};

export type RewardPolicy = {
  dailyXpCap: number;
  requiresPhotoProof: boolean;
  requiresHighConfidenceScan: boolean;
  duplicateWindowHours: number;
};
