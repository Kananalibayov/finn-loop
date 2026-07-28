import { resolve } from "node:path";
import Database from "better-sqlite3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_FILE = resolve(process.env.DATABASE_FILE ?? "data/app.db");

function canReachDatabase(): boolean {
  let connection: Database.Database | undefined;
  try {
    connection = new Database(DB_FILE, { readonly: true, fileMustExist: true });
    connection.prepare("SELECT 1").get();
    return true;
  } catch (err) {
    console.error("[health] db unreachable:", err);
    return false;
  } finally {
    connection?.close();
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    sha: process.env.COMMIT_SHA ?? "unknown",
    db: {
      path: DB_FILE,
      reachable: canReachDatabase(),
    },
    time: new Date().toISOString(),
  });
}
