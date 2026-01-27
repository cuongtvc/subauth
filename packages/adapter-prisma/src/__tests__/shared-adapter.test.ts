import { describe } from 'vitest';
import { createDatabaseAdapterTests } from '@subauth/adapter-test-utils';
import { PrismaAdapter } from '../index';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Shared adapter tests for PrismaAdapter using Testcontainers.
 * These tests verify that the adapter implements the DatabaseAdapter contract correctly.
 *
 * Prerequisites: Docker must be running
 *
 * Run with: TEST_INTEGRATION=true pnpm test
 */

const isIntegrationTest = process.env.TEST_INTEGRATION === 'true';

describe.skipIf(!isIntegrationTest)('PrismaAdapter - Shared Contract Tests', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: any;
  let adapter: PrismaAdapter;

  const setup = async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('subauth_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    const databaseUrl = container.getConnectionUri();

    // Get the package directory
    const packageDir = path.resolve(__dirname, '../..');

    // Generate Prisma client first (with schema)
    execSync('pnpm prisma generate', {
      cwd: packageDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    // Push the schema to the database
    execSync('pnpm prisma db push --skip-generate', {
      cwd: packageDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    // Dynamically import PrismaClient after generation
    const { PrismaClient } = await import('@prisma/client');

    // Create Prisma client with the container's connection URL
    prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });

    await prisma.$connect();

    // Create the adapter
    adapter = new PrismaAdapter({
      models: prisma,
      separateTokenTables: true,
    });
  };

  const cleanup = async () => {
    // Clean data in correct order (respecting foreign keys)
    await prisma.transaction.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.user.deleteMany();
  };

  const teardown = async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (container) {
      await container.stop();
    }
  };

  createDatabaseAdapterTests({
    name: 'Prisma',
    createAdapter: () => adapter,
    setup,
    cleanup,
    teardown,
  });
});
