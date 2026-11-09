import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_jmTPdVvnc3l9@ep-twilight-rice-be9v7edz-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require',
  },
});
