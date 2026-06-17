const http = require('http');
const jpeg = require('jpeg-js');

const PORT = Number(process.env.PORT || 8787);

const knownPlants = {
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, service: 'eden-api' });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const body = await readJson(req);

  if (req.url === '/scan-plant') {
    return sendJson(res, 200, { scan: scanPlant(body) });
  }

  if (req.url === '/recommend-recipes') {
    return sendJson(res, 200, { recipes: recommendRecipes(body) });
  }

  if (req.url === '/sync') {
    return sendJson(res, 200, { syncedAt: new Date().toISOString(), state: body });
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Eden API mock listening on http://localhost:${PORT}`);
});

function scanPlant({ imageBase64, imageUri, plant }) {
  const imageAssessment = assessPlantImage(imageBase64);
  const isPlantImage = imageAssessment.confidence >= 0.22;

  if (!isPlantImage) {
    return {
      id: `scan-${Date.now()}`,
      plantId: plant?.id || 'unknown',
      imageUri,
      createdAt: new Date().toISOString(),
      detectedName: 'No plant detected',
      scientificName: 'Unknown',
      confidence: 0.12,
      confidenceLevel: 'low',
      isPlantImage: false,
      plantImageConfidence: imageAssessment.confidence,
      edibleStatus: 'unknown',
      edibleConfidence: 0,
      harvestStatus: 'unknown',
      daysUntilHarvestEstimate: null,
      growthStage: 'Not assessed',
      healthScore: Number(plant?.health || 0),
      findings: [
        'The image does not contain enough plant-like visual information.',
        `Green leaf signal: ${Math.round(imageAssessment.greenRatio * 100)}%.`,
      ],
      careInstructions: [
        'Retake the photo with one plant centered in frame.',
        'Use natural light and include leaves, stems, flowers, or fruit.',
        'Avoid scanning labels, pots, soil-only images, or dark/blurry photos.',
      ],
      safetyNote: 'Eden cannot identify or recommend recipes from this image.',
      userConfirmationRequired: false,
      qualityIssues: imageAssessment.qualityIssues,
      retakeRecommended: true,
    };
  }

  const profile = knownPlants[String(plant?.name || '').toLowerCase()] || {
    detectedName: plant?.name || 'Unknown plant',
    scientificName: 'Needs confirmation',
    growthStage: plant?.stage || 'Unknown',
    edibleStatus: 'unknown',
    harvestStatus: 'unknown',
    daysUntilHarvestEstimate: null,
    confidence: 0.58,
    edibleConfidence: 0.2,
  };

  const highConfidence = profile.confidence >= 0.9;

  return {
    id: `scan-${Date.now()}`,
    plantId: plant?.id || 'unknown',
    imageUri,
    createdAt: new Date().toISOString(),
    detectedName: profile.detectedName,
    scientificName: profile.scientificName,
    confidence: profile.confidence,
    confidenceLevel: highConfidence ? 'high' : profile.confidence >= 0.65 ? 'medium' : 'low',
    isPlantImage: true,
    plantImageConfidence: imageAssessment.confidence,
    edibleStatus: profile.edibleStatus,
    edibleConfidence: profile.edibleConfidence,
    harvestStatus: profile.harvestStatus,
    daysUntilHarvestEstimate: profile.daysUntilHarvestEstimate,
    growthStage: profile.growthStage,
    healthScore: Math.min(96, Math.max(40, Number(plant?.health || 70) + 4)),
    findings: [
      'Leaf color appears mostly even.',
      'No obvious pest pattern detected in the visible area.',
      `Plant image signal: ${Math.round(imageAssessment.confidence * 100)}%.`,
      highConfidence ? 'Image quality is acceptable for this scan.' : 'Image quality may limit identification.',
    ],
    careInstructions: buildCareInstructions(plant, profile.harvestStatus),
    safetyNote:
      profile.edibleStatus === 'edible'
        ? 'Confirm growing conditions before eating any harvest.'
        : 'Do not eat this plant from AI identification alone. Confirm identity and edible parts first.',
    userConfirmationRequired: false,
    qualityIssues: highConfidence && imageAssessment.qualityIssues.length === 0
      ? []
      : [...imageAssessment.qualityIssues, 'Move closer to the leaves or fruit.', 'Center one plant in frame.'],
    retakeRecommended: !highConfidence || imageAssessment.confidence < 0.35,
  };
}

function assessPlantImage(imageBase64) {
  if (!imageBase64) {
    return {
      confidence: 0.3,
      greenRatio: 0.2,
      qualityIssues: ['Image data was not available for plant-image precheck.'],
    };
  }

  try {
    const cleanBase64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    const raw = Buffer.from(cleanBase64, 'base64');
    const decoded = jpeg.decode(raw, { useTArray: true });
    const { data, height, width } = decoded;
    const stride = Math.max(1, Math.floor((width * height) / 18000));
    let sampled = 0;
    let greenPixels = 0;
    let saturatedPixels = 0;
    let veryDarkPixels = 0;

    for (let pixel = 0; pixel < width * height; pixel += stride) {
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = (red + green + blue) / 3;
      const greenDominant = green > red * 1.08 && green > blue * 1.08;
      const leafLike = greenDominant && saturation > 0.18 && brightness > 35;

      sampled += 1;

      if (leafLike) {
        greenPixels += 1;
      }

      if (saturation > 0.2) {
        saturatedPixels += 1;
      }

      if (brightness < 28) {
        veryDarkPixels += 1;
      }
    }

    const greenRatio = sampled ? greenPixels / sampled : 0;
    const saturationRatio = sampled ? saturatedPixels / sampled : 0;
    const darkRatio = sampled ? veryDarkPixels / sampled : 0;
    const confidence = Math.max(
      0,
      Math.min(0.99, greenRatio * 1.8 + saturationRatio * 0.25 - darkRatio * 0.35),
    );
    const qualityIssues = [];

    if (greenRatio < 0.12) {
      qualityIssues.push('Not enough visible green leaf or stem area.');
    }

    if (darkRatio > 0.35) {
      qualityIssues.push('The image looks too dark for a reliable scan.');
    }

    if (saturationRatio < 0.18) {
      qualityIssues.push('The image may be blurry, washed out, or low contrast.');
    }

    return { confidence, greenRatio, qualityIssues };
  } catch {
    return {
      confidence: 0.18,
      greenRatio: 0,
      qualityIssues: ['Eden could not decode this image. Retake the photo.'],
    };
  }
}

function recommendRecipes({ plant, scan }) {
  if (
    scan?.isPlantImage !== true ||
    scan?.edibleStatus !== 'edible' ||
    scan?.confidence < 0.9 ||
    scan?.edibleConfidence < 0.85 ||
    scan?.harvestStatus !== 'ready'
  ) {
    return [];
  }

  const profile = knownPlants[String(scan.detectedName || plant?.name || '').toLowerCase()];
  const titles = profile?.recipes?.length ? profile.recipes : [`Fresh ${plant?.name || 'Plant'} Bowl`];

  return titles.map((title, index) => ({
    id: `recipe-${scan.id}-${index}`,
    scanId: scan.id,
    title,
    readyInMinutes: index === 0 ? 12 : 18,
    difficulty: plant?.recipeProfile?.skillLevel || 'easy',
    ingredients: [
      `Fresh ${scan.detectedName}`,
      ...(plant?.recipeProfile?.availableIngredients || ['Olive oil', 'Lemon or vinegar', 'Salt']).slice(0, 3),
    ],
    steps: [
      'Rinse only the amount you plan to use.',
      'Trim healthy edible parts from the plant.',
      'Combine with pantry ingredients and taste before serving.',
    ],
    harvestNote: `Use a small harvest from ${plant?.name || scan.detectedName} so the plant keeps growing.`,
    matchReason: `Tailored for ${(plant?.recipeProfile?.cuisines || ['seasonal'])[0]} ${plant?.recipeProfile?.mealType || 'meal'} preferences.`,
    safetyNote: scan.safetyNote,
  }));
}

function buildCareInstructions(plant, harvestStatus) {
  if (harvestStatus === 'ready') {
    return [
      `Harvest a small amount from ${plant?.name || 'this plant'} and leave enough growth for recovery.`,
      plant?.careTip || 'Keep monitoring leaf color and soil moisture.',
      `Scan again after harvesting.`,
    ];
  }

  return [
    `Do not harvest ${plant?.name || 'this plant'} yet.`,
    Number(plant?.waterEveryDays || 3) <= 2
      ? `Water every ${plant.waterEveryDays} day(s), keeping soil evenly damp but not soaked.`
      : 'Wait until the top inch of soil is dry, then water deeply.',
    `Scan again in 5-7 days to check growth progress.`,
  ];
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}
