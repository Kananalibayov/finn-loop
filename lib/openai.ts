// OpenAI client wrapper.
// AC-10 (original): key read from env, never hardcoded.
// AC-4 (issue #46): the key is now resolved via getEffectiveOpenAiKey()
//  (DB override first, env fallback). The module-level client cache is REMOVED
//  so a runtime key change from the Settings UI takes effect on the next
//  generation without an app restart.

import OpenAI from "openai";
import { getEffectiveOpenAiKey } from "@/lib/db";

/** The model used when no DB/env override is set (default). Callers that want
 *  the actually-effective model should use getEffectiveGenerationModel(). */
export const GENERATION_MODEL = "gpt-4o-mini";

/** Build an OpenAI client from the currently-effective key. Throws clearly
 *  if no key is configured in either the DB or .env. A new client per call —
 *  cheap relative to a generation, and required so runtime key edits apply. */
export function getOpenAI(): OpenAI {
  const apiKey = getEffectiveOpenAiKey();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it in Settings (Application) or set it in .env.",
    );
  }
  // CI injection point for the OpenAI mock; undefined preserves the default endpoint.
  return new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
}
