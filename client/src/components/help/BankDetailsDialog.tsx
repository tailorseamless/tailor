import { useState } from "react";
import { useSaveBankAccount } from "../../hooks/useAccount";
import { bankAccountProblem } from "../../utils/bankAccount";
import { errorMessage } from "../../utils/errors";
import { orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input } from "../shared/Field";
import { Modal } from "../shared/Modal";

/** The three bank boxes, where the person is, so they don't have to find them in Settings. */
export function BankDetailsDialog({ onClose }: { onClose: () => void }) {
  const save = useSaveBankAccount();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    setProblem(null);
    const account = {
      bankName: orNull(bankName),
      accountNumber: orNull(accountNumber),
      accountName: orNull(accountName),
    };
    if (!account.bankName || !account.accountNumber || !account.accountName) {
      return setProblem("Fill in all three boxes.");
    }
    const wrong = bankAccountProblem(account);
    if (wrong) return setProblem(wrong);
    save.mutate(account, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Where customers pay you"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending} data-cy="help-bank-save">
            Put on my page
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Anyone with your page link can see these. Check the number carefully, because customers will send money to it.
        </p>
        <FormError message={problem ?? (save.error ? errorMessage(save.error) : null)} />
        <Field label="Bank">
          {(p) => (
            <Input
              {...p}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              maxLength={100}
              placeholder="e.g. GTBank"
              data-cy="help-bank-name"
            />
          )}
        </Field>
        <Field label="Account number">
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="off"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              maxLength={40}
              data-cy="help-account-number"
            />
          )}
        </Field>
        <Field label="Account name" hint="As the bank shows it.">
          {(p) => (
            <Input
              {...p}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              maxLength={150}
              data-cy="help-account-name"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
