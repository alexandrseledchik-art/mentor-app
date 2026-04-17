import { readFile } from "node:fs/promises";

import type { BusinessArchitectureSource } from "./types";

const SOURCE_PATH =
  "/Users/aleksandrseledcik/Downloads/business_architecture_framework_full.json";

let cachedSourcePromise: Promise<BusinessArchitectureSource> | null = null;

export async function getBusinessArchitectureSource(): Promise<BusinessArchitectureSource> {
  if (!cachedSourcePromise) {
    cachedSourcePromise = readFile(SOURCE_PATH, "utf-8").then((content) => {
      const parsed = JSON.parse(content) as BusinessArchitectureSource;
      return parsed;
    });
  }

  return cachedSourcePromise;
}
