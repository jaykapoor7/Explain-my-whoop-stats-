import { DayRecord } from "../types";

export interface ParsedFile {
  name: string;
  text: string;
}

/**
 * A Provider adapts one platform's export format into DayRecords.
 * To add a platform: implement this interface and register it in ./index.ts.
 */
export interface Provider {
  id: string;
  label: string;
  /** Return 0..1 confidence that this file belongs to this provider. */
  detect(file: ParsedFile): number;
  /** Parse all files claimed by this provider into day records (merged later). */
  parse(files: ParsedFile[]): DayRecord[];
}
