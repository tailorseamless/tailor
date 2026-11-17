import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useDeletion } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import { errorMessage } from "../../utils/errors";
import { formatDate } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { Field, FormError, Input } from "../shared/Field";
import { ConfirmDialog, Modal } from "../shared/Modal";

/** Deleting your account or the whole business. Both wait 7 days (the server's grace period) and can be cancelled. */
export function DangerZone() {
  const { me, business, can, timeZone } = useWorkspace();
  const { refresh } = useAuth();
  const deletion = useDeletion();
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [confirmBusiness, setConfirmBusiness] = useState(false);
  const [typed, setTyped] = useState("");
  const after = { onSuccess: () => void refresh() };
  const isOwner = me.roles.includes("owner");

  return (
    <Card title="Delete">
      <div className="space-y-5 p-4 text-sm">
        {business.deletionScheduledFor && (
          <div role="alert" className="flex gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {business.name} will be deleted on {formatDate(business.deletionScheduledFor, timeZone)}.
              </p>
              {can("business.delete") && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  loading={deletion.cancelBusiness.isPending}
                  onClick={() => deletion.cancelBusiness.mutate(undefined, after)}
                  data-cy="cancel-business-deletion"
                >
                  Keep the business
                </Button>
              )}
            </div>
          </div>
        )}
        {me.user.deletionScheduledFor && (
          <div role="alert" className="flex gap-3 rounded-lg bg-danger-bg p-3 text-danger-fg">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                Your account will be deleted on {formatDate(me.user.deletionScheduledFor, timeZone)}.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={deletion.cancelAccount.isPending}
                onClick={() => deletion.cancelAccount.mutate(undefined, after)}
                data-cy="cancel-account-deletion"
              >
                Keep my account
              </Button>
            </div>
          </div>
        )}

        {!me.user.deletionScheduledFor && !isOwner && (
          <div>
            <p className="font-medium text-fg">Delete my account</p>
            <p className="mt-1 text-fg-muted">
              You'll lose access to {business.name}. Work you recorded stays with the business.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 text-danger-fg"
              onClick={() => setConfirmAccount(true)}
              data-cy="delete-account"
            >
              Delete my account
            </Button>
          </div>
        )}

        {can("business.delete") && !business.deletionScheduledFor && (
          <div>
            <p className="font-medium text-fg">Delete the business</p>
            <p className="mt-1 text-fg-muted">
              Removes {business.name}, its customers, orders, payments and staff access. Download your reports first if
              you need them.
            </p>
            <Button
              size="sm"
              variant="danger"
              className="mt-2"
              onClick={() => setConfirmBusiness(true)}
              data-cy="delete-business"
            >
              Delete the business
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAccount}
        onClose={() => setConfirmAccount(false)}
        onConfirm={() =>
          deletion.requestAccount.mutate(undefined, {
            onSuccess: () => {
              setConfirmAccount(false);
              void refresh();
            },
          })
        }
        title="Delete your account?"
        message="It's deleted after 7 days. Sign in before then to cancel."
        confirmLabel="Delete my account"
        danger
        loading={deletion.requestAccount.isPending}
      />
      <Modal
        open={confirmBusiness}
        onClose={() => {
          setConfirmBusiness(false);
          setTyped("");
          deletion.requestBusiness.reset();
        }}
        title={`Delete ${business.name}?`}
        description="Everything is deleted for good after 7 days. You can cancel until then."
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={typed.trim() !== business.name}
            loading={deletion.requestBusiness.isPending}
            onClick={() =>
              deletion.requestBusiness.mutate(typed.trim(), {
                onSuccess: () => {
                  setConfirmBusiness(false);
                  void refresh();
                },
              })
            }
            data-cy="delete-business-confirm"
          >
            Delete the business
          </Button>
        }
      >
        <FormError message={deletion.requestBusiness.error ? errorMessage(deletion.requestBusiness.error) : null} />
        <Field label={`Type ${business.name} to confirm`}>
          {(p) => (
            <Input
              {...p}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              data-cy="delete-business-name"
            />
          )}
        </Field>
      </Modal>
    </Card>
  );
}
