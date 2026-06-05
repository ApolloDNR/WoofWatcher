import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "woofwatcher.v1.state";

export interface WeightInfo {
  current: number;
  goal: string;
  unit: string;
}

export interface Profile {
  name: string;
  publicLabel: string;
  breed: string;
  background: string;
  careFocus: string;
  weight: WeightInfo;
  vetBoundary: string;
}

export interface Caregiver {
  name: string;
  role: string;
}

export interface Routine {
  id: string;
  label: string;
  type: string;
  time: string;
  owner: string;
  note: string;
}

export interface Goal {
  id: string;
  category: string;
  title: string;
  target: string;
  status: string;
  due: string;
  note: string;
}

export interface Record {
  id: string;
  type: string;
  title: string;
  due: string;
  note: string;
}

export interface Entry {
  id: string;
  type: string;
  title: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes?: number;
  amount?: string;
  mood?: string;
  severity?: string;
  note?: string;
  dogInteractions?: number;
  food?: string;
}

export interface DietProfile {
  primaryFood: string;
  normalPortion: string;
  mealSchedule: string;
  toppers: string;
  supplements: string;
  bedtimeSnack: string;
  treatsAllowed: string;
  avoid: string;
  sensitivities: string;
  appetiteQuirks: string;
  vetNotes: string;
}

export interface CareState {
  version: number;
  createdAt: string;
  updatedAt: string;
  profile: Profile;
  caregivers: Caregiver[];
  dietProfile: DietProfile;
  routines: Routine[];
  goals: Goal[];
  records: Record[];
  entries: Entry[];
}

function getDefaultState(): CareState {
  const now = new Date().toISOString();
  const h = (offset: number) =>
    new Date(Date.now() - offset * 60 * 60 * 1000).toISOString();
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd / Belgian Shepherd mix",
      background:
        "Rescued over a year ago after being underweight and food anxious.",
      careFocus:
        "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
      weight: { current: 56.2, goal: "Slow, vet-guided weight gain", unit: "lb" },
      vetBoundary:
        "WoofWatcher tracks patterns for caregiver and veterinarian review. It is not a veterinary diagnosis.",
    },
    caregivers: [
      { name: "Apollo", role: "Primary caregiver" },
      { name: "Girlfriend", role: "Primary caregiver" },
    ],
    dietProfile: {
      primaryFood: "Regular kibble Phoenix tolerates well",
      normalPortion: "1 to 1.5 cups per meal",
      mealSchedule: "Breakfast, dinner, and a small bedtime snack",
      toppers: "Warm water or gentle topper only when needed",
      supplements: "Only vet-approved supplements",
      bedtimeSnack: "Small snack before sleep",
      treatsAllowed: "Training treats and simple chews",
      avoid: "Rich table scraps and sudden food changes",
      sensitivities: "Food anxiety and long meal gaps",
      appetiteQuirks: "Eats best when the house is calm",
      vetNotes: "Track appetite, refused meals, and yellow bile patterns",
    },
    routines: [
      {
        id: "routine_breakfast",
        label: "Breakfast",
        type: "meal",
        time: "7:30 AM",
        owner: "Whoever is up first",
        note: "Small calm meal; avoid pressure if Phoenix is anxious.",
      },
      {
        id: "routine_morning_walk",
        label: "Morning walk",
        type: "walk",
        time: "8:15 AM",
        owner: "Apollo",
        note: "Decompress walk, sniffing encouraged.",
      },
      {
        id: "routine_midday_check",
        label: "Midday check",
        type: "note",
        time: "12:30 PM",
        owner: "Either caregiver",
        note: "Water, mood, appetite, and anxiety check.",
      },
      {
        id: "routine_dinner",
        label: "Dinner",
        type: "meal",
        time: "6:30 PM",
        owner: "Either caregiver",
        note: "Document amount and whether she needed company to eat.",
      },
      {
        id: "routine_evening_walk",
        label: "Evening walk",
        type: "walk",
        time: "8:15 PM",
        owner: "Whoever is home",
        note: "Short settling walk before bedtime.",
      },
      {
        id: "routine_bedtime_snack",
        label: "Bedtime snack",
        type: "treat",
        time: "10:00 PM",
        owner: "Either caregiver",
        note: "Small snack to reduce empty-stomach bile mornings.",
      },
    ],
    goals: [
      {
        id: "goal_weight_stability",
        category: "weight",
        title: "Stable weight gain",
        target: "Move toward 58 lb with vet-guided pacing",
        status: "active",
        due: "Monthly",
        note: "Use gentle trend tracking; do not force sudden food changes.",
      },
      {
        id: "goal_place_work",
        category: "training",
        title: "Calm place work",
        target: "Three short calm sessions per week",
        status: "active",
        due: "Weekly",
        note: "Track whether she settles faster when food or visitors are involved.",
      },
      {
        id: "goal_social_neutrality",
        category: "social",
        title: "Neutral dog exposure",
        target: "Calm, low-pressure interactions",
        status: "active",
        due: "Ongoing",
        note: "Log dog park visits and sidewalk passes with mood notes.",
      },
    ],
    records: [
      {
        id: "record_vet_baseline",
        type: "vet",
        title: "Next vet discussion",
        due: "Next regular appointment",
        note: "Mention occasional yellow bile vomiting, appetite anxiety, weight goal.",
      },
      {
        id: "record_weight_goal",
        type: "weight",
        title: "Weight goal",
        due: "Monthly",
        note: "Track weight trend gently; avoid aggressive feeding changes without vet guidance.",
      },
      {
        id: "record_vaccines",
        type: "vaccine",
        title: "Vaccine records",
        due: "Add dates",
        note: "Store rabies, DHPP, Bordetella, and any clinic notes here.",
      },
    ],
    entries: [
      {
        id: "e1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: h(7),
        amount: "1 cup",
        mood: "settled",
        note: "Ate after a calm start.",
      },
      {
        id: "e2",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: h(6),
        durationMinutes: 22,
        note: "Loose leash, sniffed calmly.",
      },
      {
        id: "e3",
        type: "training",
        title: "Place work",
        caregiver: "Girlfriend",
        occurredAt: h(5),
        durationMinutes: 10,
        mood: "engaged",
        note: "Held place while food was prepared.",
      },
      {
        id: "e4",
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Apollo",
        occurredAt: h(4),
        severity: "watch",
        note: "Small amount before breakfast. Normal energy after.",
      },
    ],
  };
}

interface CareContextValue {
  state: CareState;
  addEntry: (entry: Omit<Entry, "id">) => void;
  deleteEntry: (id: string) => void;
  isLoaded: boolean;
}

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CareState>(getDefaultState());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setState((prev) => ({ ...prev, ...parsed }));
          }
        } catch {
        }
      }
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const addEntry = useCallback((entry: Omit<Entry, "id">) => {
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setState((prev) => ({
      ...prev,
      entries: [{ id, ...entry }, ...prev.entries],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  return (
    <CareContext.Provider value={{ state, addEntry, deleteEntry, isLoaded }}>
      {children}
    </CareContext.Provider>
  );
}

export function useCare() {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error("useCare must be used within CareProvider");
  return ctx;
}
