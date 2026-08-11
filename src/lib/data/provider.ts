import { Dataset } from "../types";
import { generateDataset } from "../mock/generate";

/**
 * Data source abstraction. V1 ships only the mock provider; a future
 * GoogleHealthProvider (Fitbit Air via Health Connect / Google Health APIs)
 * implements the same interface without touching UI or scoring code.
 * Later still: AppleHealthProvider, GarminProvider, WhoopProvider, OuraProvider.
 */
export interface HealthDataProvider {
  id: string;
  label: string;
  getDataset(): Promise<Dataset>;
}

export class MockHealthDataProvider implements HealthDataProvider {
  id = "mock";
  label = "Sample data (deterministic mock)";
  private cache: Dataset | null = null;

  async getDataset(): Promise<Dataset> {
    if (!this.cache) this.cache = generateDataset();
    return this.cache;
  }
}

/** Synchronous access for client components; same deterministic dataset. */
let syncCache: Dataset | null = null;
export function getMockDataset(): Dataset {
  if (!syncCache) syncCache = generateDataset();
  return syncCache;
}
