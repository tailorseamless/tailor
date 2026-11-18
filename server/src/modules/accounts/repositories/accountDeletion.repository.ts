import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";

/**
 * The anonymising statements of account deletion (Backend Guide §27.5). They
 * span several modules' tables on purpose: deletion must reach every place
 * personal data lives, in ONE transaction. Each statement is scoped by id or
 * business_id and is safe to run twice.
 */
export class AccountDeletionRepository {
  static Instance = new AccountDeletionRepository();

  private constructor() {}

  /** People whose own deletion grace period has ended (not owners: they delete the business). */
  async dueUsers(limit: number): Promise<{ id: string; businessId: string }[]> {
    return AppDataSource.query(
      `SELECT u.id, u.business_id AS "businessId"
         FROM users u
        WHERE u.deletion_scheduled_for <= now() AND u.deleted_at IS NULL
        ORDER BY u.deletion_scheduled_for
        LIMIT $1`,
      [limit],
    );
  }

  async dueBusinesses(limit: number): Promise<{ id: string }[]> {
    return AppDataSource.query(
      `SELECT id FROM businesses
        WHERE deletion_scheduled_for <= now() AND deleted_at IS NULL
        ORDER BY deletion_scheduled_for
        LIMIT $1`,
      [limit],
    );
  }

  /**
   * Turns a person into "Former team member": no name, email, phone or login
   * left; their membership ends; work still booked with them is unassigned.
   * Returns the Firebase uid to delete once the transaction has committed.
   */
  async anonymiseUser(userId: string, tx: Tx): Promise<{ firebaseUid: string | null }> {
    const rows: { firebase_uid: string | null }[] = await tx.query(
      `SELECT firebase_uid FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const row = rows[0];
    await tx.query(
      `UPDATE users
          SET full_name = 'Former team member',
              email = 'deleted-' || id || '@deleted.invalid',
              phone = NULL, firebase_uid = NULL, status = 'disabled',
              deletion_scheduled_for = NULL, deleted_at = now(), updated_at = now()
        WHERE id = $1`,
      [userId],
    );
    await tx.query(
      `UPDATE business_members SET deleted_at = now(), updated_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    await tx.query(
      `UPDATE appointments SET assigned_to = NULL, updated_at = now() WHERE assigned_to = $1 AND status = 'scheduled'`,
      [userId],
    );
    await tx.query(
      `UPDATE production_tasks SET assigned_to = NULL, updated_at = now()
        WHERE assigned_to = $1 AND status IN ('todo','in_progress')`,
      [userId],
    );
    await tx.query(`DELETE FROM device_tokens WHERE user_id = $1`, [userId]);
    await tx.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
    await tx.query(
      `UPDATE push_deliveries SET status = 'cancelled', last_error = 'Account deleted' WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );
    await tx.query(
      `UPDATE notifications SET title = 'Removed', body = NULL, deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return { firebaseUid: row?.firebase_uid ?? null };
  }

  /** Everyone in the business — staff and owner alike. */
  async businessUserIds(businessId: string, tx: Tx): Promise<string[]> {
    const rows: { id: string }[] = await tx.query(
      `SELECT id FROM users WHERE business_id = $1 AND deleted_at IS NULL`,
      [businessId],
    );
    return rows.map((row) => row.id);
  }

  /**
   * Removes the personal data of a business's customers and of the people who
   * asked it for appointments. Orders and payments stay, with no names on
   * them, as the financial record. Returns the public ids of every picture,
   * to delete from storage after the commit.
   */
  async anonymiseBusiness(businessId: string, tx: Tx): Promise<{ imagePublicIds: string[] }> {
    const id = [businessId];
    await tx.query(
      `UPDATE customers
          SET full_name = 'Deleted customer', phone = '', email = NULL, address = NULL, notes = NULL,
              portal_token_hash = NULL, portal_link_created_at = NULL,
              deleted_at = COALESCE(deleted_at, now()), updated_at = now()
        WHERE business_id = $1`,
      id,
    );
    await tx.query(
      `UPDATE customer_measurements SET notes = NULL, entries = '[]', deleted_at = COALESCE(deleted_at, now()), updated_at = now()
        WHERE business_id = $1`,
      id,
    );
    await tx.query(
      `UPDATE appointment_requests
          SET full_name = 'Deleted', phone = '', email = NULL, note = NULL, decision_note = NULL,
              deleted_at = COALESCE(deleted_at, now()), updated_at = now()
        WHERE business_id = $1`,
      id,
    );
    await tx.query(
      `UPDATE appointments SET notes = NULL, change_note = NULL, updated_at = now() WHERE business_id = $1`,
      id,
    );
    await tx.query(`UPDATE orders SET notes = NULL, updated_at = now() WHERE business_id = $1`, id);
    await tx.query(
      `UPDATE order_items SET description = NULL, updated_at = now()
        WHERE order_id IN (SELECT id FROM orders WHERE business_id = $1)`,
      id,
    );
    await tx.query(`UPDATE payments SET note = NULL, reference = NULL WHERE business_id = $1`, id);
    await tx.query(
      `UPDATE email_outbox SET status = 'cancelled', last_error = 'Business deleted', payload = '{}', updated_at = now()
        WHERE business_id = $1 AND status = 'pending'`,
      id,
    );
    const images: { public_id: string }[] = await tx
      .query(
        `UPDATE images SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
        WHERE business_id = $1
    RETURNING public_id`,
        id,
      )
      .then((result: unknown) => returnedRows<{ public_id: string }>(result));
    await tx.query(
      `UPDATE businesses
          SET name = 'Deleted business', email = NULL, phone = NULL, address = NULL,
              bank_name = NULL, account_number = NULL, account_name = NULL,
              slug = NULL, page_enabled = false, booking_enabled = false, status = 'suspended',
              deletion_scheduled_for = NULL, deleted_at = now(), updated_at = now()
        WHERE id = $1`,
      id,
    );
    return { imagePublicIds: images.map((image) => image.public_id) };
  }
}
