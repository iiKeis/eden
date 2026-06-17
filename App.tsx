import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import './global.css';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  careEntries as seedEntries,
  plants as seedPlants,
  rewards,
} from './src/data/edenData';
import { getRecipeRecommendations, scanPlant } from './src/api/edenBackend';
import { canAwardScanXp, rewardPolicy } from './src/services/rewards';
import type {
  CareEntry,
  CareTask,
  Plant,
  PlantScanResult,
  RecipeRecommendation,
  TabKey,
} from './src/types';

type EdenState = {
  completedTasks: string[];
  entries: CareEntry[];
  entrySavedDate: string | null;
  plants: Plant[];
  points: number;
  recipes: RecipeRecommendation[];
  scans: PlantScanResult[];
  streak: number;
};

type PlantDraft = {
  allergies: string;
  availableIngredients: string;
  cuisines: string;
  dietaryPreferences: string;
  dislikes: string;
  name: string;
  variety: string;
  location: string;
  mealType: string;
  skillLevel: 'easy' | 'medium' | 'advanced';
  waterEveryDays: string;
  light: string;
};

const STORAGE_KEY = 'eden-mobile:v2';
const today = new Date().toISOString().slice(0, 10);

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: 'H' },
  { key: 'garden', label: 'Garden', icon: 'P' },
  { key: 'log', label: 'Log', icon: '+' },
  { key: 'rewards', label: 'Rewards', icon: 'R' },
  { key: 'profile', label: 'Profile', icon: 'U' },
];

const initialState: EdenState = {
  completedTasks: [],
  entries: seedEntries,
  entrySavedDate: null,
  plants: seedPlants,
  points: 340,
  recipes: [],
  scans: [],
  streak: 7,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [completedTasks, setCompletedTasks] = useState(initialState.completedTasks);
  const [entries, setEntries] = useState(initialState.entries);
  const [entrySavedDate, setEntrySavedDate] = useState<string | null>(
    initialState.entrySavedDate,
  );
  const [plants, setPlants] = useState(initialState.plants);
  const [points, setPoints] = useState(initialState.points);
  const [recipes, setRecipes] = useState(initialState.recipes);
  const [scans, setScans] = useState(initialState.scans);
  const [aiBusy, setAiBusy] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [streak, setStreak] = useState(initialState.streak);
  const [hydrated, setHydrated] = useState(false);

  const dailyTasks = useMemo(() => buildDailyTasks(plants), [plants]);
  const earnedToday = useMemo(
    () =>
      dailyTasks
        .filter((task) => completedTasks.includes(task.id))
        .reduce((total, task) => total + task.xp, 0),
    [completedTasks, dailyTasks],
  );
  const allTasksDone =
    dailyTasks.length > 0 && completedTasks.length === dailyTasks.length;
  const entrySavedToday = entrySavedDate === today;
  const levelProgress = Math.min(1, (points % 500) / 500);

  useEffect(() => {
    async function loadState() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);

        if (stored) {
          const nextState = JSON.parse(stored) as EdenState;

          setCompletedTasks(nextState.completedTasks ?? []);
          setEntries(nextState.entries ?? seedEntries);
          setEntrySavedDate(nextState.entrySavedDate ?? null);
          setPlants(normalizePlants(nextState.plants ?? seedPlants));
          setPoints(nextState.points ?? 340);
          setRecipes(nextState.recipes ?? []);
          setScans(nextState.scans ?? []);
          setStreak(nextState.streak ?? 7);
        }
      } catch {
        Alert.alert('Storage issue', 'Eden could not load saved garden data.');
      } finally {
        setHydrated(true);
      }
    }

    loadState();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const state: EdenState = {
      completedTasks,
      entries,
      entrySavedDate,
      plants,
      points,
      recipes,
      scans,
      streak,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      Alert.alert('Storage issue', 'Eden could not save the latest changes.');
    });
  }, [
    completedTasks,
    entries,
    entrySavedDate,
    hydrated,
    plants,
    points,
    recipes,
    scans,
    streak,
  ]);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  };

  const addPlant = (draft: PlantDraft) => {
    const name = draft.name.trim();

    if (!name) {
      Alert.alert('Plant name needed', 'Add a name before saving this plant.');
      return;
    }

    const newPlant: Plant = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      name,
      variety: draft.variety.trim() || 'House plant',
      location: draft.location.trim() || 'My garden',
      stage: 'New',
      health: 78,
      waterEveryDays: Number(draft.waterEveryDays) || 3,
      light: draft.light.trim() || 'Bright indirect',
      nextCare: 'Start care path',
      careTip: 'Watch the soil, light, and leaves for the first week.',
      color: pickPlantColor(plants.length),
      createdAt: today,
      recipeProfile: {
        allergies: parseList(draft.allergies),
        availableIngredients: parseList(draft.availableIngredients),
        cuisines: parseList(draft.cuisines),
        dietaryPreferences: parseList(draft.dietaryPreferences),
        dislikes: parseList(draft.dislikes),
        mealType: draft.mealType.trim() || 'quick dinner',
        skillLevel: draft.skillLevel,
      },
    };

    setPlants((current) => [newPlant, ...current]);
    setCompletedTasks([]);
  };

  const capturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to save proof.');
      return undefined;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });

    if (result.canceled) {
      return undefined;
    }

    return result.assets[0]?.uri;
  };

  const saveEntry = async (
    photoUri?: string,
    scan?: PlantScanResult,
    scannedPlantId?: string,
  ) => {
    const scanQualifies = canAwardScanXp({ hasPhoto: Boolean(photoUri), scan });
    const baseXp = Math.max(earnedToday, allTasksDone ? 70 : 25);
    const candidateXp = scan ? (scanQualifies ? baseXp : 10) : baseXp;
    const xpEarnedToday = entries
      .filter((entry) => entry.date === today)
      .reduce((total, entry) => total + entry.xp, 0);
    const xp = Math.max(
      0,
      Math.min(candidateXp, rewardPolicy.dailyXpCap - xpEarnedToday),
    );
    const plantId = scannedPlantId ?? dailyTasks[0]?.plantId ?? plants[0]?.id ?? 'unknown';
    const newEntry: CareEntry = {
      id: `entry-${Date.now()}`,
      plantId,
      date: today,
      note: photoUri
        ? scan
          ? `AI scan found ${scan.detectedName} with ${Math.round(
              scan.confidence * 100,
            )}% confidence. ${scanQualifies ? 'Reward approved.' : 'Care logged with limited XP.'}`
          : 'Saved care proof with a plant photo.'
        : allTasksDone
          ? 'Completed the full care path.'
          : 'Saved a quick care check-in.',
      photoUri,
      scanId: scan?.id,
      xp,
    };

    setEntries((current) => [newEntry, ...current]);
    setPoints((current) => current + xp);
    setCompletedTasks(dailyTasks.map((task) => task.id));

    if (!entrySavedToday) {
      setStreak((current) => current + 1);
      setEntrySavedDate(today);
    }

    setActiveTab('log');
  };

  const saveEntryWithPhoto = async (plantId?: string) => {
    const photoUri = await capturePhoto();

    if (!photoUri) {
      return;
    }

    const plant = plants.find((item) => item.id === plantId) ?? plants[0];

    if (!plant) {
      Alert.alert('Add a plant first', 'Eden needs a saved plant before scanning.');
      return;
    }

    setAiBusy(true);

    try {
      const { scan } = await scanPlant({ imageUri: photoUri, plant });
      const { recipes: nextRecipes } = await getRecipeRecommendations({ plant, scan });

      setScans((current) => [scan, ...current]);
      setRecipes((current) => [...nextRecipes, ...current]);
      setPlants((current) =>
        current.map((item) =>
          item.id === plant.id
            ? {
                ...item,
                health: scan.healthScore,
                lastScanId: scan.id,
                nextCare: scan.careInstructions[0],
                stage: scan.growthStage,
                variety:
                  scan.confidenceLevel === 'high'
                    ? scan.detectedName
                    : item.variety,
              }
            : item,
        ),
      );

      await saveEntry(photoUri, scan, plant.id);
    } catch {
      Alert.alert('AI scan issue', 'Eden could not analyze this photo yet.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F3E8]">
      <StatusBar style="dark" backgroundColor="#F8F3E8" />

      <View className="flex-1">
        <ScreenTransition screenKey={activeTab}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-28 pt-3"
            showsVerticalScrollIndicator={false}
          >
            <TopStats points={points} streak={streak} />
            {activeTab === 'today' ? (
              <TodayScreen
                completedTasks={completedTasks}
                dailyTasks={dailyTasks}
                earnedToday={earnedToday}
                entrySavedToday={entrySavedToday}
                levelProgress={levelProgress}
                onSave={() => saveEntry()}
                onToggleTask={toggleTask}
                plants={plants}
              />
            ) : null}
            {activeTab === 'garden' ? (
              <GardenScreen
                entries={entries}
                onAddPlant={addPlant}
                onScanPlant={(plantId) => saveEntryWithPhoto(plantId)}
                onSelectPlant={setSelectedPlantId}
                plants={plants}
                recipes={recipes}
                scans={scans}
                selectedPlantId={selectedPlantId}
              />
            ) : null}
            {activeTab === 'log' ? (
              <LogScreen
                aiBusy={aiBusy}
                entries={entries}
                onSavePhoto={() => saveEntryWithPhoto()}
                plants={plants}
                recipes={recipes}
                scans={scans}
              />
            ) : null}
            {activeTab === 'rewards' ? (
              <RewardsScreen points={points} progress={levelProgress} recipes={recipes} />
            ) : null}
            {activeTab === 'profile' ? (
              <ProfileScreen
                entries={entries}
                onReset={() => {
                  setCompletedTasks([]);
                  setEntries(seedEntries);
                  setEntrySavedDate(null);
                  setPlants(seedPlants);
                  setPoints(340);
                  setRecipes([]);
                  setScans([]);
                  setStreak(7);
                }}
                plants={plants}
                points={points}
                scans={scans}
                streak={streak}
              />
            ) : null}
          </ScrollView>
        </ScreenTransition>

        <MobileTabBar activeTab={activeTab} onSelect={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

function buildDailyTasks(userPlants: Plant[]): CareTask[] {
  return userPlants.slice(0, 4).map((plant, index) => {
    const isPhotoTask = index === 2;
    const action = isPhotoTask
      ? `Photo check ${plant.name}`
      : plant.waterEveryDays <= 2
        ? `Water ${plant.name}`
        : `Inspect ${plant.name}`;

    return {
      id: `${today}-${plant.id}-${index}`,
      plantId: plant.id,
      action,
      instruction: isPhotoTask
        ? `Save a clear progress photo of ${plant.name}.`
        : plant.careTip,
      order: index + 1,
      xp: isPhotoTask ? 35 : plant.waterEveryDays <= 2 ? 25 : 15,
    };
  });
}

function pickPlantColor(index: number) {
  const colors = ['#32A852', '#E5553F', '#43A28C', '#A89545', '#6C70D8'];
  return colors[index % colors.length];
}

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePlants(userPlants: Plant[]) {
  return userPlants.map((plant) => ({
    ...plant,
    recipeProfile: plant.recipeProfile ?? {
      allergies: [],
      availableIngredients: ['olive oil', 'lemon', 'salt'],
      cuisines: ['Mediterranean'],
      dietaryPreferences: ['vegetarian'],
      dislikes: [],
      mealType: 'quick dinner',
      skillLevel: 'easy' as const,
    },
  }));
}

function ScreenTransition({
  children,
  screenKey,
}: {
  children: React.ReactNode;
  screenKey: string;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        friction: 8,
        tension: 80,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, screenKey, translateY]);

  return (
    <Animated.View
      className="flex-1"
      style={{ opacity, transform: [{ translateY }] }}
    >
      {children}
    </Animated.View>
  );
}

function TopStats({ points, streak }: { points: number; streak: number }) {
  return (
    <View className="mb-5 flex-row items-center justify-between rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] px-4 py-3">
      <View>
        <Text className="text-xs font-black uppercase text-[#5F7E3A]">Eden</Text>
        <Text className="mt-1 text-lg font-black text-[#183B27]">
          Daily plant care
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pill label="Streak" value={`${streak}`} />
        <Pill label="XP" value={`${points}`} warm />
      </View>
    </View>
  );
}

function TodayScreen({
  completedTasks,
  dailyTasks,
  earnedToday,
  entrySavedToday,
  levelProgress,
  onSave,
  onToggleTask,
  plants,
}: {
  completedTasks: string[];
  dailyTasks: CareTask[];
  earnedToday: number;
  entrySavedToday: boolean;
  levelProgress: number;
  onSave: () => void;
  onToggleTask: (taskId: string) => void;
  plants: Plant[];
}) {
  const heroPlant = plants[0];

  return (
    <View>
      <Text className="text-[34px] font-black leading-[40px] text-[#183B27]">
        Keep your streak alive
      </Text>
      <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
        Finish today's plant path, save a photo entry, and earn care points.
      </Text>

      <View className="mt-6 rounded-[30px] border-b-[6px] border-[#1D5F35] bg-[#36B657] p-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-xs font-black uppercase text-[#DDF8D9]">
              Next up
            </Text>
            <Text className="mt-2 text-3xl font-black leading-9 text-white">
              {heroPlant
                ? `${heroPlant.name} needs a focused check-in.`
                : 'Add your first plant to start a care path.'}
            </Text>
          </View>
          <View className="h-20 w-20 items-center justify-center rounded-full border-b-[5px] border-[#C5901F] bg-[#FFC744]">
            <Text className="text-2xl font-black text-[#3B2A0A]">
              {heroPlant?.health ?? 0}
            </Text>
            <Text className="text-[10px] font-black uppercase text-[#6D4D0F]">
              health
            </Text>
          </View>
        </View>

        <View className="mt-6 h-4 overflow-hidden rounded-full bg-[#1D7C3B]">
          <View
            className="h-full rounded-full bg-[#FFC744]"
            style={{ width: `${levelProgress * 100}%` }}
          />
        </View>

        <View className="mt-5 flex-row justify-between">
          <SmallStat label="Today" value={`+${earnedToday} XP`} />
          <SmallStat label="Proof" value={entrySavedToday ? 'Saved' : 'Needed'} />
        </View>
      </View>

      <View className="mt-7 gap-4">
        {dailyTasks.map((task, index) => (
          <CareStep
            key={task.id}
            checked={completedTasks.includes(task.id)}
            index={index + 1}
            onPress={() => onToggleTask(task.id)}
            plants={plants}
            task={task}
          />
        ))}
      </View>

      <PrimaryAction label="Save daily entry" onPress={onSave} />
    </View>
  );
}

function GardenScreen({
  entries,
  onAddPlant,
  onScanPlant,
  onSelectPlant,
  plants,
  recipes,
  scans,
  selectedPlantId,
}: {
  entries: CareEntry[];
  onAddPlant: (draft: PlantDraft) => void;
  onScanPlant: (plantId: string) => void;
  onSelectPlant: (plantId: string | null) => void;
  plants: Plant[];
  recipes: RecipeRecommendation[];
  scans: PlantScanResult[];
  selectedPlantId: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PlantDraft>({
    allergies: '',
    availableIngredients: 'olive oil, lemon, salt',
    cuisines: 'Mediterranean',
    dietaryPreferences: 'vegetarian',
    dislikes: '',
    name: '',
    variety: '',
    location: '',
    mealType: 'quick dinner',
    skillLevel: 'easy',
    waterEveryDays: '3',
    light: '',
  });

  const savePlant = () => {
    onAddPlant(draft);
    setDraft({
      allergies: '',
      availableIngredients: 'olive oil, lemon, salt',
      cuisines: 'Mediterranean',
      dietaryPreferences: 'vegetarian',
      dislikes: '',
      name: '',
      variety: '',
      location: '',
      mealType: 'quick dinner',
      skillLevel: 'easy',
      waterEveryDays: '3',
      light: '',
    });
    setAdding(false);
  };
  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);

  return (
    <View>
      {selectedPlant ? (
        <PlantDetailScreen
          entries={entries.filter((entry) => entry.plantId === selectedPlant.id)}
          onBack={() => onSelectPlant(null)}
          onScan={() => onScanPlant(selectedPlant.id)}
          plant={selectedPlant}
          recipes={recipes}
          scans={scans.filter((scan) => scan.plantId === selectedPlant.id)}
        />
      ) : (
        <>
          <ScreenTitle
            kicker="My garden"
            title="Plants you are growing"
            body="Add plants, then Eden turns them into a daily care path."
          />

          {adding ? (
            <View className="mt-6 rounded-[30px] border border-[#E2D8C2] bg-[#FFFDF7] p-5">
              <Text className="text-2xl font-black text-[#183B27]">New plant</Text>
              <Input
                label="Plant name"
                onChangeText={(name) =>
                  setDraft((current) => ({ ...current, name }))
                }
                placeholder="Basil"
                value={draft.name}
              />
              <Input
                label="Type"
                onChangeText={(variety) =>
                  setDraft((current) => ({ ...current, variety }))
                }
                placeholder="Genovese basil"
                value={draft.variety}
              />
              <Input
                label="Location"
                onChangeText={(location) =>
                  setDraft((current) => ({ ...current, location }))
                }
                placeholder="Kitchen window"
                value={draft.location}
              />
              <Input
                keyboardType="number-pad"
                label="Water every"
                onChangeText={(waterEveryDays) =>
                  setDraft((current) => ({ ...current, waterEveryDays }))
                }
                placeholder="3"
                suffix="days"
                value={draft.waterEveryDays}
              />
              <Input
                label="Light"
                onChangeText={(light) =>
                  setDraft((current) => ({ ...current, light }))
                }
                placeholder="Bright indirect"
                value={draft.light}
              />
              <Text className="mt-6 text-2xl font-black text-[#183B27]">
                Recipe profile
              </Text>
              <Text className="mt-1 text-sm font-bold leading-5 text-[#756D5D]">
                Eden shapes recipe ideas while the crop grows, then unlocks the
                final recommendation only when the crop is edible and harvest-ready.
              </Text>
              <Input
                label="Favorite cuisines"
                onChangeText={(cuisines) =>
                  setDraft((current) => ({ ...current, cuisines }))
                }
                placeholder="Mediterranean, Mexican"
                value={draft.cuisines}
              />
              <Input
                label="Dietary preferences"
                onChangeText={(dietaryPreferences) =>
                  setDraft((current) => ({ ...current, dietaryPreferences }))
                }
                placeholder="vegetarian, gluten-free"
                value={draft.dietaryPreferences}
              />
              <Input
                label="Allergies"
                onChangeText={(allergies) =>
                  setDraft((current) => ({ ...current, allergies }))
                }
                placeholder="nuts, dairy"
                value={draft.allergies}
              />
              <Input
                label="Pantry staples"
                onChangeText={(availableIngredients) =>
                  setDraft((current) => ({ ...current, availableIngredients }))
                }
                placeholder="olive oil, lemon, rice"
                value={draft.availableIngredients}
              />
              <Input
                label="Meal type"
                onChangeText={(mealType) =>
                  setDraft((current) => ({ ...current, mealType }))
                }
                placeholder="quick dinner"
                value={draft.mealType}
              />
              <Input
                label="Dislikes"
                onChangeText={(dislikes) =>
                  setDraft((current) => ({ ...current, dislikes }))
                }
                placeholder="cilantro, spicy food"
                value={draft.dislikes}
              />
              <View className="mt-4">
                <Text className="mb-2 text-xs font-black uppercase text-[#8B741F]">
                  Cooking skill
                </Text>
                <View className="flex-row gap-2">
                  {(['easy', 'medium', 'advanced'] as const).map((skill) => (
                    <Pressable
                      key={skill}
                      className={`flex-1 rounded-2xl px-3 py-4 ${
                        draft.skillLevel === skill ? 'bg-[#36B657]' : 'bg-[#F8F3E8]'
                      }`}
                      onPress={() =>
                        setDraft((current) => ({ ...current, skillLevel: skill }))
                      }
                    >
                      <Text
                        className={`text-center text-xs font-black uppercase ${
                          draft.skillLevel === skill
                            ? 'text-white'
                            : 'text-[#756D5D]'
                        }`}
                      >
                        {skill}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <PrimaryAction label="Save plant" onPress={savePlant} />
              <SecondaryAction label="Cancel" onPress={() => setAdding(false)} />
            </View>
          ) : (
            <PrimaryAction label="Add a plant" onPress={() => setAdding(true)} />
          )}

          <View className="mt-6 gap-4">
            {plants.map((plant) => {
              const latestScan = scans.find((scan) => scan.plantId === plant.id);

              return (
                <PlantRow
                  key={plant.id}
                  latestScan={latestScan}
                  onPress={() => onSelectPlant(plant.id)}
                  plant={plant}
                />
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function LogScreen({
  aiBusy,
  entries,
  onSavePhoto,
  plants,
  recipes,
  scans,
}: {
  aiBusy: boolean;
  entries: CareEntry[];
  onSavePhoto: () => void;
  plants: Plant[];
  recipes: RecipeRecommendation[];
  scans: PlantScanResult[];
}) {
  const latest = entries[0];
  const plant = plants.find((item) => item.id === latest?.plantId) ?? plants[0];
  const latestScan =
    scans.find((scan) => scan.id === latest?.scanId) ?? scans[0];
  const latestRecipes = latestScan
    ? recipes.filter((recipe) => recipe.scanId === latestScan.id)
    : [];

  return (
    <View>
      <ScreenTitle
        kicker="AI scan"
        title="Identify, verify, cook"
        body="Snap a plant photo. Eden returns identification, care guidance, edible confidence, and recipes when it is ready."
      />

      <Pressable
        className="mt-6 rounded-[32px] border-b-[6px] border-[#1D5F35] bg-[#36B657] p-5"
        onPress={onSavePhoto}
      >
        <View className="h-64 items-center justify-center overflow-hidden rounded-[28px] bg-[#1D7C3B]">
          {latest?.photoUri && !aiBusy ? (
            <Image
              className="h-full w-full"
              resizeMode="cover"
              source={{ uri: latest.photoUri }}
            />
          ) : (
            <>
              <View className="h-20 w-20 items-center justify-center rounded-full border-b-[5px] border-[#C5901F] bg-[#FFC744]">
                <Text className="text-4xl font-black text-[#3B2A0A]">
                  {aiBusy ? 'AI' : '+'}
                </Text>
              </View>
              <Text className="mt-5 text-2xl font-black text-white">
                {aiBusy ? 'Scanning plant...' : 'Scan plant photo'}
              </Text>
              <Text className="mt-2 px-8 text-center text-sm font-bold leading-5 text-[#DDF8D9]">
                {aiBusy
                  ? 'Checking identity, growth stage, health, and edible readiness.'
                  : "Tap here to open the camera and save today's proof."}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {latestScan ? (
        <ScanResultCard scan={latestScan} />
      ) : (
        <View className="mt-5 rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] p-5">
          <Text className="text-xs font-black uppercase text-[#8B741F]">
            Latest entry
          </Text>
          <Text className="mt-2 text-2xl font-black text-[#183B27]">
            {plant?.name ?? 'Plant'} earned +{latest?.xp ?? 0} XP
          </Text>
          <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
            {latest?.note ?? 'No care entries yet.'}
          </Text>
        </View>
      )}

      {latestRecipes.length > 0 ? (
        <RecipeList recipes={latestRecipes} />
      ) : latestScan ? (
        <View className="mt-5 rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] p-5">
          <Text className="text-xl font-black text-[#183B27]">
            Keep growing
          </Text>
          <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
            Recipes unlock only when AI marks the plant as edible and fully
            harvest-ready. Until then, Eden gives care instructions instead.
          </Text>
        </View>
      ) : null}

      <PrimaryAction label={aiBusy ? 'Scanning...' : 'Scan with AI'} onPress={onSavePhoto} />
    </View>
  );
}

function RewardsScreen({
  points,
  progress,
  recipes,
}: {
  points: number;
  progress: number;
  recipes: RecipeRecommendation[];
}) {
  return (
    <View>
      <ScreenTitle
        kicker="Rewards"
        title="Points with a purpose"
        body={`Photo rewards require high-confidence scans. Daily XP cap: ${rewardPolicy.dailyXpCap}.`}
      />

      <View className="mt-6 rounded-[30px] border-b-[6px] border-[#B88A1C] bg-[#FFC744] p-5">
        <Text className="text-xs font-black uppercase text-[#6D4D0F]">
          Eden balance
        </Text>
        <Text className="mt-2 text-6xl font-black text-[#3B2A0A]">
          {points}
        </Text>
        <View className="mt-4 h-4 overflow-hidden rounded-full bg-[#DFA72A]">
          <View
            className="h-full rounded-full bg-white"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      </View>

      <View className="mt-6 gap-4">
        {recipes.slice(0, 1).map((recipe) => (
          <View
            key={recipe.id}
            className="rounded-3xl border-2 border-[#36B657] bg-[#E9F9E8] p-5"
          >
            <Text className="text-xs font-black uppercase text-[#1D5F35]">
              Recipe unlocked
            </Text>
            <Text className="mt-2 text-xl font-black text-[#183B27]">
              {recipe.title}
            </Text>
            <Text className="mt-1 text-sm font-bold text-[#756D5D]">
              {recipe.readyInMinutes} minutes | {recipe.difficulty}
            </Text>
          </View>
        ))}
        {rewards.map((reward) => (
          <View
            key={reward.id}
            className="rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] p-5"
          >
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-xl font-black text-[#183B27]">
                  {reward.title}
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#756D5D]">
                  {reward.partner}
                </Text>
              </View>
              <View className="rounded-2xl bg-[#EDE5D4] px-4 py-3">
                <Text className="text-sm font-black text-[#183B27]">
                  {reward.cost}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProfileScreen({
  entries,
  onReset,
  plants,
  points,
  scans,
  streak,
}: {
  entries: CareEntry[];
  onReset: () => void;
  plants: Plant[];
  points: number;
  scans: PlantScanResult[];
  streak: number;
}) {
  return (
    <View>
      <ScreenTitle
        kicker="Profile"
        title="Growing record"
        body="Local user data is now persisted on this device."
      />

      <View className="mt-6 flex-row gap-3">
        <BigMetric label="Day streak" value={`${streak}`} />
        <BigMetric label="Total XP" value={`${points}`} warm />
      </View>
      <View className="mt-4 rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] p-5">
        <Text className="text-2xl font-black text-[#183B27]">
          {entries.length} saved entries
        </Text>
        <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
          {plants.length} plants and {scans.length} AI scans are saved on this
          device. Next step is replacing local storage with accounts and cloud
          sync.
        </Text>
      </View>
      <SecondaryAction label="Reset demo data" onPress={onReset} />
    </View>
  );
}

function CareStep({
  checked,
  index,
  onPress,
  plants,
  task,
}: {
  checked: boolean;
  index: number;
  onPress: () => void;
  plants: Plant[];
  task: CareTask;
}) {
  const plant = plants.find((item) => item.id === task.plantId) ?? plants[0];

  return (
    <Pressable
      className={`rounded-[28px] border-2 p-4 ${
        checked
          ? 'border-[#36B657] bg-[#E9F9E8]'
          : 'border-[#E2D8C2] bg-[#FFFDF7]'
      }`}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-16 w-16 items-center justify-center rounded-full border-b-[5px]"
          style={{
            backgroundColor: checked ? '#36B657' : plant?.color ?? '#36B657',
            borderBottomColor: checked ? '#1D5F35' : '#C8BEA9',
          }}
        >
          <Text className="text-2xl font-black text-white">
            {checked ? 'Y' : index}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-black uppercase text-[#8B741F]">
              {plant?.name ?? 'Plant'}
            </Text>
            <Text className="text-xs font-black text-[#36B657]">
              +{task.xp} XP
            </Text>
          </View>
          <Text className="mt-1 text-xl font-black text-[#183B27]">
            {task.action}
          </Text>
          <Text className="mt-1 text-sm font-bold leading-5 text-[#756D5D]">
            {task.instruction}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function PlantDetailScreen({
  entries,
  onBack,
  onScan,
  plant,
  recipes,
  scans,
}: {
  entries: CareEntry[];
  onBack: () => void;
  onScan: () => void;
  plant: Plant;
  recipes: RecipeRecommendation[];
  scans: PlantScanResult[];
}) {
  const latestScan = scans[0];
  const plantRecipes = latestScan
    ? recipes.filter((recipe) => recipe.scanId === latestScan.id)
    : [];

  return (
    <View>
      <Pressable className="mb-4 self-start rounded-2xl bg-[#EDE5D4] px-4 py-3" onPress={onBack}>
        <Text className="text-sm font-black text-[#756D5D]">Back</Text>
      </Pressable>

      <View className="rounded-[32px] border-b-[6px] border-[#1D5F35] bg-[#36B657] p-5">
        <View className="flex-row items-center gap-4">
          <View
            className="h-24 w-24 items-center justify-center rounded-[30px] border-b-[5px] border-[#C8BEA9]"
            style={{ backgroundColor: plant.color }}
          >
            <Text className="text-4xl font-black text-white">
              {plant.name.slice(0, 1)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black uppercase text-[#DDF8D9]">
              {plant.location}
            </Text>
            <Text className="mt-1 text-4xl font-black text-white">
              {plant.name}
            </Text>
            <Text className="mt-1 text-sm font-black text-[#DDF8D9]">
              {plant.variety}
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row justify-between">
          <SmallStat label="Health" value={`${plant.health}`} />
          <SmallStat label="Stage" value={plant.stage} />
        </View>
      </View>

      <RecipeProfileCard plant={plant} scan={latestScan} />

      <PrimaryAction label="Run AI scan" onPress={onScan} />

      {latestScan ? (
        <ScanResultCard scan={latestScan} />
      ) : (
        <View className="mt-5 rounded-3xl border border-[#E2D8C2] bg-[#FFFDF7] p-5">
          <Text className="text-xl font-black text-[#183B27]">
            No scans yet
          </Text>
          <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
            Run an AI scan to identify this plant, check harvest readiness, and
            get exact care instructions.
          </Text>
        </View>
      )}

      {plantRecipes.length > 0 ? <RecipeList recipes={plantRecipes} /> : null}

      <View className="mt-6 rounded-[28px] border border-[#E2D8C2] bg-[#FFFDF7] p-5">
        <Text className="text-2xl font-black text-[#183B27]">
          Scan history
        </Text>
        <View className="mt-3 gap-3">
          {scans.length === 0 ? (
            <Text className="text-base font-bold text-[#756D5D]">
              This plant has no AI history yet.
            </Text>
          ) : (
            scans.map((scan) => (
              <View key={scan.id} className="rounded-2xl bg-[#F8F3E8] p-4">
                <Text className="text-sm font-black text-[#183B27]">
                  {scan.detectedName} | {Math.round(scan.confidence * 100)}%
                </Text>
                <Text className="mt-1 text-xs font-bold uppercase text-[#756D5D]">
                  {scan.harvestStatus === 'ready'
                    ? 'Ready to harvest'
                    : 'Not harvest ready'}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View className="mt-5 rounded-[28px] border border-[#E2D8C2] bg-[#FFFDF7] p-5">
        <Text className="text-2xl font-black text-[#183B27]">
          Care entries
        </Text>
        <View className="mt-3 gap-3">
          {entries.length === 0 ? (
            <Text className="text-base font-bold text-[#756D5D]">
              No entries saved for this plant yet.
            </Text>
          ) : (
            entries.slice(0, 4).map((entry) => (
              <View key={entry.id} className="rounded-2xl bg-[#F8F3E8] p-4">
                <Text className="text-sm font-black text-[#183B27]">
                  +{entry.xp} XP on {entry.date}
                </Text>
                <Text className="mt-1 text-sm font-bold text-[#756D5D]">
                  {entry.note}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

function PlantRow({
  latestScan,
  onPress,
  plant,
}: {
  latestScan?: PlantScanResult;
  onPress: () => void;
  plant: Plant;
}) {
  return (
    <Pressable
      className="rounded-[28px] border border-[#E2D8C2] bg-[#FFFDF7] p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center gap-4">
        <View
          className="h-20 w-20 items-center justify-center rounded-[26px] border-b-[5px] border-[#C8BEA9]"
          style={{ backgroundColor: plant.color }}
        >
          <Text className="text-3xl font-black text-white">
            {plant.name.slice(0, 1)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-black text-[#183B27]">
            {plant.name}
          </Text>
          <Text className="mt-1 text-sm font-bold text-[#756D5D]">
            {plant.variety} | {plant.stage}
          </Text>
          <Text className="mt-2 text-sm font-black text-[#8B741F]">
            {plant.nextCare}
          </Text>
        </View>
        <Text className="text-lg font-black text-[#36B657]">
          {plant.health}
        </Text>
      </View>
      {latestScan ? (
        <View className="mt-4 rounded-2xl bg-[#E9F9E8] p-3">
          <Text className="text-xs font-black uppercase text-[#5F7E3A]">
            Latest AI scan
          </Text>
          <Text className="mt-1 text-sm font-black text-[#183B27]">
            {latestScan.detectedName} | {Math.round(latestScan.confidence * 100)}%
          </Text>
          <Text className="mt-1 text-xs font-bold uppercase text-[#756D5D]">
            {latestScan.harvestStatus === 'ready'
              ? 'Recipes can unlock'
              : 'Care instructions active'}
          </Text>
        </View>
      ) : null}
      <Text className="mt-4 text-base font-bold leading-6 text-[#756D5D]">
        {plant.careTip}
      </Text>
    </Pressable>
  );
}

function RecipeProfileCard({
  plant,
  scan,
}: {
  plant: Plant;
  scan?: PlantScanResult;
}) {
  const profile = plant.recipeProfile;
  const ready = scan?.harvestStatus === 'ready';

  return (
    <View className="mt-5 rounded-[28px] border border-[#E2D8C2] bg-[#FFFDF7] p-5">
      <Text className="text-xs font-black uppercase text-[#8B741F]">
        Future recipe profile
      </Text>
      <Text className="mt-2 text-2xl font-black text-[#183B27]">
        {ready ? 'Final recipes unlocked' : 'Eden is tailoring the meal path'}
      </Text>
      <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
        {ready
          ? 'This crop is ready, so recipes can use your preferences now.'
          : 'Until harvest, Eden uses these preferences to prepare the ideal recipe direction without showing final recommendations.'}
      </Text>

      <View className="mt-4 flex-row flex-wrap gap-2">
        {[...profile.cuisines, ...profile.dietaryPreferences, profile.mealType]
          .filter(Boolean)
          .slice(0, 6)
          .map((tag) => (
            <View key={tag} className="rounded-full bg-[#E9F9E8] px-3 py-2">
              <Text className="text-xs font-black uppercase text-[#1D5F35]">
                {tag}
              </Text>
            </View>
          ))}
      </View>

      {profile.allergies.length > 0 || profile.dislikes.length > 0 ? (
        <Text className="mt-4 text-sm font-bold leading-5 text-[#756D5D]">
          Avoiding: {[...profile.allergies, ...profile.dislikes].join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function ScanResultCard({ scan }: { scan: PlantScanResult }) {
  const confidenceLabel = `${Math.round(scan.confidence * 100)}%`;
  const edibleLabel =
    scan.edibleStatus === 'edible'
      ? `${Math.round(scan.edibleConfidence * 100)}% edible confidence`
      : 'Edible status needs review';
  const harvestLabel =
    scan.harvestStatus === 'ready'
      ? 'Ready to harvest'
      : scan.daysUntilHarvestEstimate
        ? `Not ready | about ${scan.daysUntilHarvestEstimate} days`
        : 'Harvest readiness unknown';

  return (
    <View className="mt-5 rounded-[30px] border border-[#E2D8C2] bg-[#FFFDF7] p-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="text-xs font-black uppercase text-[#8B741F]">
            Latest scan
          </Text>
          <Text className="mt-2 text-3xl font-black text-[#183B27]">
            {scan.detectedName}
          </Text>
          <Text className="mt-1 text-sm font-bold italic text-[#756D5D]">
            {scan.scientificName}
          </Text>
        </View>
        <View
          className={`rounded-2xl px-4 py-3 ${
            scan.confidenceLevel === 'high' ? 'bg-[#E9F9E8]' : 'bg-[#FFF0C9]'
          }`}
        >
          <Text className="text-center text-lg font-black text-[#183B27]">
            {confidenceLabel}
          </Text>
          <Text className="text-center text-[10px] font-black uppercase text-[#756D5D]">
            confidence
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <MiniResult label="Stage" value={scan.growthStage} />
        <MiniResult label="Harvest" value={harvestLabel} />
      </View>

      <View className="mt-4 rounded-2xl bg-[#F8F3E8] p-4">
        <Text className="text-xs font-black uppercase text-[#8B741F]">
          Edible check
        </Text>
        <Text className="mt-1 text-lg font-black text-[#183B27]">
          {edibleLabel}
        </Text>
        <Text className="mt-2 text-sm font-bold leading-5 text-[#756D5D]">
          {scan.safetyNote}
        </Text>
      </View>

      <View className="mt-4 rounded-2xl bg-[#E9F9E8] p-4">
        <Text className="text-xs font-black uppercase text-[#5F7E3A]">
          {scan.harvestStatus === 'ready'
            ? 'Harvest guidance'
            : 'Care instructions'}
        </Text>
        <View className="mt-2 gap-2">
          {scan.careInstructions.map((instruction) => (
            <Text
              key={instruction}
              className="text-sm font-bold leading-5 text-[#183B27]"
            >
              - {instruction}
            </Text>
          ))}
        </View>
      </View>

      <View className="mt-4 gap-2">
        {scan.findings.map((finding) => (
          <Text
            key={finding}
            className="text-sm font-bold leading-5 text-[#756D5D]"
          >
            - {finding}
          </Text>
        ))}
      </View>
    </View>
  );
}

function RecipeList({ recipes }: { recipes: RecipeRecommendation[] }) {
  return (
    <View className="mt-6 gap-4">
      <Text className="text-2xl font-black text-[#183B27]">
        Recipe ideas
      </Text>
      {recipes.map((recipe) => (
        <View
          key={recipe.id}
          className="rounded-[28px] border-b-[6px] border-[#B88A1C] bg-[#FFC744] p-5"
        >
          <Text className="text-xs font-black uppercase text-[#6D4D0F]">
            Ready in {recipe.readyInMinutes} min
          </Text>
          <Text className="mt-2 text-2xl font-black text-[#3B2A0A]">
            {recipe.title}
          </Text>
          <Text className="mt-2 text-sm font-black uppercase text-[#6D4D0F]">
            {recipe.harvestNote}
          </Text>
          <Text className="mt-2 text-sm font-bold text-[#6D4D0F]">
            {recipe.matchReason}
          </Text>
          <View className="mt-4 gap-1">
            {recipe.ingredients.slice(0, 4).map((ingredient) => (
              <Text key={ingredient} className="text-sm font-bold text-[#3B2A0A]">
                - {ingredient}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function MiniResult({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-[#E9F9E8] p-3">
      <Text className="text-[10px] font-black uppercase text-[#5F7E3A]">
        {label}
      </Text>
      <Text className="mt-1 text-base font-black text-[#183B27]">{value}</Text>
    </View>
  );
}

function MobileTabBar({
  activeTab,
  onSelect,
}: {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-[#F8F3E8] px-4 pb-5 pt-2">
      <View className="flex-row items-center justify-between rounded-[30px] border border-[#E2D8C2] bg-[#FFFDF7] px-3 py-2">
        {tabs.map((tab) => (
          <AnimatedTabButton
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            selected={activeTab === tab.key}
            onPress={() => onSelect(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

function AnimatedTabButton({
  icon,
  label,
  onPress,
  selected,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const scale = useRef(new Animated.Value(selected ? 1.08 : 1)).current;
  const lift = useRef(new Animated.Value(selected ? -5 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.08 : 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.spring(lift, {
        toValue: selected ? -5 : 0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lift, scale, selected]);

  return (
    <Pressable className="items-center" onPress={onPress}>
      <Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>
        <View
          className={`h-12 w-12 items-center justify-center rounded-2xl border-b-[5px] ${
            selected
              ? 'border-[#1D5F35] bg-[#36B657]'
              : 'border-[#D6CCB8] bg-[#F0E7D6]'
          }`}
        >
          <Text
            className={`text-lg font-black ${
              selected ? 'text-white' : 'text-[#756D5D]'
            }`}
          >
            {icon}
          </Text>
        </View>
      </Animated.View>
      <Text
        className={`mt-1 text-[10px] font-black ${
          selected ? 'text-[#183B27]' : 'text-[#8B8374]'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ScreenTitle({
  body,
  kicker,
  title,
}: {
  body: string;
  kicker: string;
  title: string;
}) {
  return (
    <View>
      <Text className="text-xs font-black uppercase text-[#5F7E3A]">
        {kicker}
      </Text>
      <Text className="mt-1 text-[34px] font-black leading-[40px] text-[#183B27]">
        {title}
      </Text>
      <Text className="mt-2 text-base font-bold leading-6 text-[#756D5D]">
        {body}
      </Text>
    </View>
  );
}

function Input({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  suffix,
  value,
}: {
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix?: string;
  value: string;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-xs font-black uppercase text-[#8B741F]">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl border border-[#E2D8C2] bg-[#F8F3E8] px-4">
        <TextInput
          className="h-14 flex-1 text-lg font-black text-[#183B27]"
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9C9485"
          value={value}
        />
        {suffix ? (
          <Text className="text-sm font-black uppercase text-[#756D5D]">
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="mt-6 rounded-[26px] border-b-[6px] border-[#1D5F35] bg-[#36B657] px-5 py-5"
      onPress={onPress}
    >
      <Text className="text-center text-xl font-black text-white">{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="mt-3 rounded-[22px] border border-[#E2D8C2] bg-[#FFFDF7] px-5 py-4"
      onPress={onPress}
    >
      <Text className="text-center text-base font-black text-[#756D5D]">
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({
  label,
  value,
  warm,
}: {
  label: string;
  value: string;
  warm?: boolean;
}) {
  return (
    <View
      className={`min-w-16 items-center rounded-2xl px-3 py-2 ${
        warm ? 'bg-[#FFC744]' : 'bg-[#E9F9E8]'
      }`}
    >
      <Text className="text-[10px] font-black uppercase text-[#756D5D]">
        {label}
      </Text>
      <Text className="text-lg font-black text-[#183B27]">{value}</Text>
    </View>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs font-black uppercase text-[#DDF8D9]">
        {label}
      </Text>
      <Text className="mt-1 text-xl font-black text-white">{value}</Text>
    </View>
  );
}

function BigMetric({
  label,
  value,
  warm,
}: {
  label: string;
  value: string;
  warm?: boolean;
}) {
  return (
    <View
      className={`flex-1 rounded-[28px] border-b-[6px] p-5 ${
        warm
          ? 'border-[#B88A1C] bg-[#FFC744]'
          : 'border-[#1D5F35] bg-[#36B657]'
      }`}
    >
      <Text
        className={`text-xs font-black uppercase ${
          warm ? 'text-[#6D4D0F]' : 'text-[#DDF8D9]'
        }`}
      >
        {label}
      </Text>
      <Text
        className={`mt-2 text-4xl font-black ${
          warm ? 'text-[#3B2A0A]' : 'text-white'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
