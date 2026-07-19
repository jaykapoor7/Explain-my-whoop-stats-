import "server-only";
import { DayRecord } from "../../types";
import { syncWhoop } from "./whoop";
import { syncOura } from "./oura";
import { syncFitbit } from "./fitbit";

export function syncProvider(provider: string, accessToken: string): Promise<DayRecord[]> {
  switch (provider) {
    case "whoop":
      return syncWhoop(accessToken);
    case "oura":
      return syncOura(accessToken);
    case "fitbit":
      return syncFitbit(accessToken);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
