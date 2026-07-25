// OpenAI client wrapper.
// AC-10: key read from env, never hardcoded.

import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.",
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export const GENERATION_MODEL = "gpt-4o-mini";
