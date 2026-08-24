import AsyncStorage from "@react-native-async-storage/async-storage";
import { createHealthService } from "../scrapers/health";
import { createStorageBreakerStore } from "../scrapers/resilient";

export const healthService = createHealthService(AsyncStorage);
export const breakerStore = createStorageBreakerStore(AsyncStorage);
