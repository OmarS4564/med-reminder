import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./keys";
import { Medication } from "../models/medication";
import { DoseEvent } from "../models/doseEvent";

async function load<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw);
}

async function save<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const DB = {
  getMeds: () => load<Medication[]>(STORAGE_KEYS.meds, []),
  saveMeds: (m: Medication[]) => save(STORAGE_KEYS.meds, m),
  getEvents: () => load<DoseEvent[]>(STORAGE_KEYS.events, []),
  saveEvents: (e: DoseEvent[]) => save(STORAGE_KEYS.events, e),
};
