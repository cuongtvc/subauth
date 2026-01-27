import { execSync } from 'child_process';
import path from 'path';

/**
 * Global setup for integration tests.
 * Generates Prisma client before tests run.
 */
export async function setup() {
  if (process.env.TEST_INTEGRATION !== 'true') {
    return;
  }

  const prismaPackageDir = path.resolve(__dirname, 'packages/adapter-prisma');

  console.log('\n📦 Generating Prisma client for integration tests...');

  try {
    // Generate Prisma client with a dummy DATABASE_URL
    // The actual URL will be set when connecting to the container
    execSync('pnpm prisma generate', {
      cwd: prismaPackageDir,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/subauth_test'
      },
      stdio: 'inherit',
    });
    console.log('✅ Prisma client generated.\n');
  } catch (error) {
    console.error('❌ Failed to generate Prisma client:', error);
    throw error;
  }
}

export async function teardown() {
  // Cleanup if needed
}
