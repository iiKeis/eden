import { analyzePlantImage, recommendRecipes } from '../services/edenAi';
import type { Plant, PlantScanResult, RecipeRecommendation } from '../types';

export type ScanPlantRequest = {
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

  return maybeProcess.process?.env?.EXPO_PUBLIC_EDEN_API_URL?.replace(/\/$/, '');
}
