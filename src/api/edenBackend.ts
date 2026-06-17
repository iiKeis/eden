import Constants from 'expo-constants';
import { analyzePlantImage, recommendRecipes } from '../services/edenAi';
import type { Plant, PlantScanResult, RecipeRecommendation } from '../types';

export type ScanPlantRequest = {
  imageBase64?: string;
  imageUri: string;
  plant: Plant;
};

export type ScanPlantResponse = {
  scan: PlantScanResult;
};

export type RecipeRequest = {
  plant: Plant;
  scan: PlantScanResult;
};

export type RecipeResponse = {
  recipes: RecipeRecommendation[];
};

export async function scanPlant(
  request: ScanPlantRequest,
): Promise<ScanPlantResponse> {
  const remote = await postToApi<ScanPlantResponse>('/scan-plant', request);

  if (remote) {
    return remote;
  }

  if (request.imageBase64) {
    return {
      scan: createUnavailableScan(request),
    };
  }

  const scan = await analyzePlantImage(request);

  return { scan };
}

export async function getRecipeRecommendations(
  request: RecipeRequest,
): Promise<RecipeResponse> {
  const remote = await postToApi<RecipeResponse>('/recommend-recipes', request);

  if (remote) {
    return remote;
  }

  const recipes = await recommendRecipes(request);

  return { recipes };
}

async function postToApi<T>(path: string, body: unknown): Promise<T | null> {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getApiBaseUrl() {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const envUrl = maybeProcess.process?.env?.EXPO_PUBLIC_EDEN_API_URL?.replace(
    /\/$/,
    '',
  );

  if (envUrl) {
    return envUrl;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    return `http://${host}:8787`;
  }

  return undefined;
}

export function getConfiguredApiBaseUrl() {
  return getApiBaseUrl() ?? 'local fallback only';
}

function createUnavailableScan(request: ScanPlantRequest): PlantScanResult {
  return {
    id: `scan-unavailable-${Date.now()}`,
    plantId: request.plant.id,
    imageUri: request.imageUri,
    createdAt: new Date().toISOString(),
    detectedName: 'Scan unavailable',
    scientificName: 'Backend required',
    confidence: 0,
    confidenceLevel: 'low',
    isPlantImage: false,
    plantImageConfidence: 0,
    edibleStatus: 'unknown',
    edibleConfidence: 0,
    harvestStatus: 'unknown',
    daysUntilHarvestEstimate: null,
    growthStage: 'Not assessed',
    healthScore: request.plant.health,
    findings: ['Eden could not reach the scan backend for this photo.'],
    careInstructions: [
      'Make sure the Eden API is running.',
      'Use LAN or tunnel mode so your phone can reach the backend.',
      'Retake or resubmit the photo after the backend is reachable.',
    ],
    safetyNote: 'No plant identification or recipe recommendation was made.',
    userConfirmationRequired: false,
    qualityIssues: ['Scan backend unavailable.'],
    retakeRecommended: true,
  };
}
