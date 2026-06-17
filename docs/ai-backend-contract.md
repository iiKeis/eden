# Eden AI Backend Contract

## POST /scan-plant

Input:

```json
{
  "plantId": "basil",
  "image": "multipart image upload or signed image URL",
  "context": {
    "userPlantName": "Basil",
    "location": "Kitchen window",
    "light": "Bright indirect",
    "waterEveryDays": 2,
    "priorScanIds": [],
    "recipeProfile": {
      "cuisines": ["Mediterranean"],
      "dietaryPreferences": ["vegetarian"],
      "allergies": [],
      "availableIngredients": ["olive oil", "lemon", "salt"],
      "dislikes": [],
      "mealType": "quick dinner",
      "skillLevel": "easy"
    }
  }
}
```

Output:

```json
{
  "scan": {
    "id": "scan-123",
    "plantId": "basil",
    "imageUri": "https://...",
    "createdAt": "2026-06-12T12:00:00.000Z",
    "detectedName": "Basil",
    "scientificName": "Ocimum basilicum",
    "confidence": 0.96,
    "confidenceLevel": "high",
    "edibleStatus": "edible",
    "edibleConfidence": 0.94,
    "harvestStatus": "ready",
    "daysUntilHarvestEstimate": 0,
    "growthStage": "Leafing with harvestable tips",
    "healthScore": 90,
    "findings": ["Leaf color appears mostly even."],
    "careInstructions": ["Harvest a small amount and leave enough growth for recovery."],
    "safetyNote": "Confirm growing conditions before eating.",
    "userConfirmationRequired": false
  }
}
```

Accuracy rules:

- Return `confidenceLevel: "low"` when identification is uncertain.
- Return `harvestStatus: "not_ready"` for edible crops that are not fully grown.
- Never unlock recipes unless `confidence >= 0.9`, `edibleConfidence >= 0.85`, and `harvestStatus === "ready"`.
- If the crop is not ready, prioritize exact care instructions and the next scan window.
- While the crop grows, the app may show a future recipe profile, but not final recipe recommendations.

## POST /recommend-recipes

Input:

```json
{
  "plantId": "basil",
  "scanId": "scan-123",
  "recipeProfile": {
    "cuisines": ["Mediterranean"],
    "dietaryPreferences": ["vegetarian"],
    "allergies": [],
    "availableIngredients": ["olive oil", "lemon", "salt"],
    "dislikes": [],
    "mealType": "quick dinner",
    "skillLevel": "easy"
  }
}
```

Output:

```json
{
  "recipes": [
    {
      "id": "recipe-123",
      "scanId": "scan-123",
      "title": "Tomato Basil Toast",
      "readyInMinutes": 12,
      "difficulty": "easy",
      "ingredients": ["Fresh Basil", "Toast", "Olive oil"],
      "steps": ["Rinse only the amount you plan to use."],
      "harvestNote": "Use a small harvest so the plant keeps growing.",
      "matchReason": "Tailored for Mediterranean quick dinner preferences.",
      "safetyNote": "Confirm growing conditions before eating."
    }
  ]
}
```
