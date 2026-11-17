/**
 * Makes someone a platform admin (or takes it away). Deliberately a
 * command-line script and not an API route: nobody can make themselves admin
 * over the network.
 *
 *   npm --workspace server run admin:grant -- --email you@example.com
 *   npm --workspace server run admin:grant -- --email you@example.com --revoke
 *
 * The person must already have an account (register a business first).
 */
import { AppDataSource } from "../src/infrastructure/database/dataSource";
import { AdminRepository } from "../src/modules/admin/repositories/admin.repository";

async function main(): Promise<void> {
  const index = process.argv.indexOf("--email");
  const email = index === -1 ? undefined : process.argv[index + 1];
  if (!email) throw new Error("Usage: admin:grant -- --email <address> [--revoke]");
  const revoke = process.argv.includes("--revoke");

  await AppDataSource.initialize();
  try {
    const id = await AdminRepository.Instance.setPlatformRole(email, revoke ? "user" : "super_admin");
    if (!id) throw new Error(`No account uses ${email}`);
    console.log(revoke ? `${email} is no longer a platform admin.` : `${email} is now a platform admin.`);
    console.log("It takes effect on their next request (within a minute if they are signed in).");
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
