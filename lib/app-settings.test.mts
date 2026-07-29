import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "finn-loop-app-settings-test-"));
process.env.DATABASE_FILE = join(dir, "test.db");

const { getAppSettings, getPleskConfig, saveEmailSettings, savePleskSettings } = await import("./db.ts");

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
});

test("savePleskSettings upserts a fresh app_settings row", () => {
  savePleskSettings({
    pleskUrl: "https://plesk.example:8443",
    pleskUser: "admin",
    pleskPassword: "secret",
  });
  assert.deepEqual(getPleskConfig(), {
    pleskUrl: "https://plesk.example:8443",
    pleskUser: "admin",
    pleskPassword: "secret",
  });
});

test("saveEmailSettings upserts SMTP values", () => {
  saveEmailSettings({
    smtpHost: "smtp.example",
    smtpPort: "587",
    smtpUser: "u",
    smtpPass: "p",
    smtpFrom: "f@example",
    notifyOperatorEmail: "ops@example",
  });
  const settings = getAppSettings();
  assert.equal(settings?.smtp_host, "smtp.example");
  assert.equal(settings?.smtp_port, "587");
  assert.equal(settings?.smtp_pass, "p");
  assert.equal(settings?.notify_operator_email, "ops@example");
});

test("saveEmailSettings preserves the password when passed an empty value", () => {
  saveEmailSettings({ smtpHost: "smtp2.example", smtpPass: "" });
  const settings = getAppSettings();
  assert.equal(settings?.smtp_host, "smtp2.example");
  assert.equal(settings?.smtp_pass, "p");
});
