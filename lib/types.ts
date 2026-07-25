// Shared types for the generator pipeline.

export type Mode = "full" | "home";

export type PageKey = "home" | "services" | "gallery" | "contact" | "about";

export const ALL_PAGES: PageKey[] = [
  "home",
  "services",
  "gallery",
  "contact",
  "about",
];

export interface BusinessInput {
  businessName: string;
  tagline: string;
  description: string;
  services: string[]; // free-form list, one per line in the form
  phone: string;
  email: string;
  address: string;
  logoUrl?: string; // optional
  brandColors?: string; // optional, free text
}

export interface GenerateRequest {
  input: BusinessInput;
  mode: Mode;
  themeId: import("./themes").ThemeId;
}

export interface GeneratedPage {
  key: PageKey;
  title: string;
  html: string; // full <html>...</html> document (standalone)
}

export interface GenerateResponse {
  pages: GeneratedPage[];
  themeId: import("./themes").ThemeId;
  defaultsApplied: { logo: boolean; colors: boolean };
  /** AC-3 (issue #4): id of the persisted site row, if save succeeded. */
  id?: number;
}
