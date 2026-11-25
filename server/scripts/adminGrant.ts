/**
 * Gives someone platform power (or takes it away). Deliberately a command-line
 * script and not an API route: nobody can make themselves admin over the network.
 *
 *   npm --workspace server run admin:grant -- --email you@example.com                  (super admin)
 *   npm --workspace server run admin:grant -- --email you@example.com --role support   (look, don't touch)
 *   npm --workspace server run admin:grant -- --email you@example.com --revoke
 *
 * The person must already have an account (register a business first). Every
 * change is written to the audit log as a platform event, by `system`.
 */
import { AppDataSource } from "../src/infrastructure/database/dataSource";
import { ActivityService } from "../src/modules/activity/services/activity.service";
import { AdminRepository } from "../src/modules/admin/repositories/admin.repository";
import { runInTransaction } from "../src/shared/repositories/transaction";
import type { PlatformRole } from "../src/shared/services/access.service";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const email = argument("--email");
  const revoke = process.argv.includes("--revoke");
  const roleArg = argument("--role") ?? "super_admin";
  if (!email) throw new Error("Usage: admin:grant -- --email <address> [--role super_admin|support] [--revoke]");
  if (roleArg !== "super_admin" && roleArg !== "support") throw new Error("--role must be super_admin or support");
  const role: PlatformRole = revoke ? "user" : roleArg;

  await AppDataSource.initialize();
  try {
    // The change and its audit row commit together or not at all (Backend Guide §8.4).
    const before = await runInTransaction(async (tx) => {
      const found = await AdminRepository.Instance.setPlatformRole(email, role, tx);
      if (!found || found.previous === role) return found;
      await ActivityService.Instance.audit(
        {
          businessId: null, // a platform event, not a business's
          actorId: null,
          actorKind: "system",
          action: revoke ? "admin.role_revoked" : "admin.role_granted",
          entityType: "user",
          entityId: found.id,
          payload: { from: found.previous, to: role, via: "admin:grant" },
        },
        tx,
      );
      return found;
    });
    if (!before) throw new Error(`No account uses ${email}`);
    if (before.previous === role) {
      console.log(`${email} already has the ${role} platform role. Nothing changed.`);
      return;
    }
    console.log(revoke ? `${email} is no longer a platform admin.` : `${email} is now ${role}.`);
    console.log("It takes effect on their next request (within a minute if they are signed in).");
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
