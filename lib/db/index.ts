import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for cloud mode");
  return url;
};

let _db: ReturnType<typeof createDb> | undefined;

const createDb = () => {
  const sql = neon(getDatabaseUrl());
  return drizzle(sql, { schema });
};

export const getDb = () => {
  if (!_db) _db = createDb();
  return _db;
};

export type Database = ReturnType<typeof getDb>;
