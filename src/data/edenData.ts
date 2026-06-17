import type { CareEntry, CareTask, Plant, Reward } from '../types';

const defaultRecipeProfile = {
  allergies: [],
  availableIngredients: ['olive oil', 'lemon', 'salt'],
  cuisines: ['Mediterranean'],
  dietaryPreferences: ['vegetarian'],
  dislikes: [],
  mealType: 'quick dinner',
  skillLevel: 'easy' as const,
};

export const plants: Plant[] = [
  {
    id: 'basil',
    name: 'Basil',
    variety: 'Genovese basil',
    location: 'Kitchen window',
    stage: 'Leafing',
    health: 86,
    waterEveryDays: 2,
    light: 'Bright indirect',
    nextCare: 'Water this morning',
    careTip: 'Keep the top inch damp and rotate the pot after watering.',
    color: '#32A852',
    createdAt: '2026-06-01',
    recipeProfile: defaultRecipeProfile,
  },
  {
    id: 'tomato',
    name: 'Tomato',
    variety: 'Cherry tomato',
    location: 'Patio planter',
    stage: 'Flowering',
    health: 72,
    waterEveryDays: 1,
    light: 'Full sun',
    nextCare: 'Check dry edge',
    careTip: 'Water deeply at soil level and avoid splashing leaves.',
    color: '#E5553F',
    createdAt: '2026-06-02',
    recipeProfile: {
      ...defaultRecipeProfile,
      cuisines: ['Italian', 'Mexican'],
      mealType: 'dinner',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    variety: 'Sweet mint',
    location: 'Herb rail',
    stage: 'Harvestable',
    health: 91,
    waterEveryDays: 2,
    light: 'Morning sun',
    nextCare: 'Trim top growth',
    careTip: 'Pinch above a leaf pair so the plant branches outward.',
    color: '#43A28C',
    createdAt: '2026-06-03',
    recipeProfile: {
      ...defaultRecipeProfile,
      cuisines: ['Mediterranean', 'Thai'],
      mealType: 'drink or salad',
    },
  },
  {
    id: 'thyme',
    name: 'Thyme',
    variety: 'Common thyme',
    location: 'South shelf',
    stage: 'Settling',
    health: 80,
    waterEveryDays: 5,
    light: 'Strong sun',
    nextCare: 'Rest day',
    careTip: 'Let the soil dry between watering sessions.',
    color: '#A89545',
    createdAt: '2026-06-04',
    recipeProfile: {
      ...defaultRecipeProfile,
      cuisines: ['French', 'Mediterranean'],
      mealType: 'side dish',
    },
  },
];

export const careTasks: CareTask[] = [
  {
    id: 'water-basil',
    plantId: 'basil',
    action: 'Water basil',
    instruction: 'Slow pour 12 oz until the soil is evenly damp.',
    xp: 20,
    order: 1,
  },
  {
    id: 'soil-tomato',
    plantId: 'tomato',
    action: 'Check tomato soil',
    instruction: 'Press the edge of the planter and water if it feels dry.',
    xp: 15,
    order: 2,
  },
  {
    id: 'photo-mint',
    plantId: 'mint',
    action: 'Save a progress photo',
    instruction: 'Capture one clear photo before harvesting mint tops.',
    xp: 35,
    order: 3,
  },
];

export const careEntries: CareEntry[] = [
  {
    id: 'entry-001',
    plantId: 'basil',
    date: '2026-06-08',
    note: 'New leaves opened near the window side.',
    xp: 45,
  },
  {
    id: 'entry-002',
    plantId: 'tomato',
    date: '2026-06-09',
    note: 'First yellow flower appeared.',
    xp: 40,
  },
  {
    id: 'entry-003',
    plantId: 'mint',
    date: '2026-06-10',
    note: 'Trimmed two stems and kept the photo streak alive.',
    xp: 50,
  },
];

export const rewards: Reward[] = [
  {
    id: 'seed-pack',
    title: 'Seed Pack Drop',
    cost: 500,
    partner: 'Eden trial reward',
    status: 'soon',
  },
  {
    id: 'garden-card-5',
    title: '$5 Garden Center Card',
    cost: 1200,
    partner: 'Local nursery',
    status: 'locked',
  },
  {
    id: 'coffee-card-10',
    title: '$10 Coffee Card',
    cost: 2200,
    partner: 'Morning care bonus',
    status: 'locked',
  },
];
