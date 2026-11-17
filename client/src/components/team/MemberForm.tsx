import { useState } from "react";
import { useBranches, useTeamActions } from "../../hooks/useTeam";
import type { AssignableRole, MemberStatus, TeamMember } from "../../types/workspace.types";
import { errorMessage } from "../../utils/errors";
import { keysOf, ROLE } from "../../utils/labels";
import { isPhone, orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select } from "../shared/Field";
import { PhoneInput } from "../shared/PhoneInput";
import { Modal } from "../shared/Modal";

const ROLES = keysOf(ROLE).filter((r): r is AssignableRole => r !== "owner");

/** Add someone (they get an email invitation) or change their role, branch or access. */
export function MemberForm({ member, onClose }: { member?: TeamMember; onClose: () => void }) {
  const { add, update } = useTeamActions();
  const branches = useBranches();
  const mutation = member ? update : add;
  const [fullName, setFullName] = useState(member?.fullName ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [role, setRole] = useState<AssignableRole>(member && member.role !== "owner" ? member.role : "tailor");
  const [branchId, setBranchId] = useState(member?.branchId ?? "");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "active");
  const [problem, setProblem] = useState<string | null>(null);
  const activeBranches = (branches.data?.data ?? []).filter((b) => b.status === "active" || b.id === branchId);
  const isOwner = member?.role === "owner";

  const save = () => {
    setProblem(null);
    if (fullName.trim().length < 2) return setProblem("Enter their name.");
    if (!member && !/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter the email they'll sign in with.");
    if (phone.trim() && !isPhone(phone)) return setProblem("Enter a valid phone number.");
    if (member) {
      update.mutate(
        {
          userId: member.userId,
          input: isOwner
            ? { fullName: fullName.trim(), phone: orNull(phone) }
            : { fullName: fullName.trim(), phone: orNull(phone), role, status, branchId: branchId || null },
        },
        { onSuccess: onClose },
      );
    } else {
      add.mutate(
        { fullName: fullName.trim(), email: email.trim(), phone: orNull(phone), role, branchId: branchId || null },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={member ? `Edit ${member.fullName}` : "Add a team member"}
      description={member ? undefined : "They'll get an email inviting them to sign in with this address."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-cy="member-cancel">
            Cancel
          </Button>
          <Button onClick={save} loading={mutation.isPending} data-cy="member-save">
            {member ? "Save" : "Add and invite"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={problem ?? (mutation.error ? errorMessage(mutation.error) : null)} />
        <Field label="Full name">
          {(p) => <Input {...p} value={fullName} onChange={(e) => setFullName(e.target.value)} data-cy="member-name" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint={member ? "Can't be changed." : undefined}>
            {(p) => (
              <Input
                {...p}
                type="email"
                value={email}
                disabled={Boolean(member)}
                onChange={(e) => setEmail(e.target.value)}
                data-cy="member-email"
              />
            )}
          </Field>
          <Field label="Phone (optional)">
            {(p) => <PhoneInput {...p} value={phone} onChange={setPhone} data-cy="member-phone" />}
          </Field>
        </div>
        {!isOwner && (
          <>
            <Field label="Role" hint={ROLE[role].description}>
              {(p) => (
                <Select
                  {...p}
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                  data-cy="member-role"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE[r].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {activeBranches.length > 0 && (
              <Field label="Branch">
                {(p) => (
                  <Select {...p} value={branchId} onChange={(e) => setBranchId(e.target.value)} data-cy="member-branch">
                    <option value="">All branches</option>
                    {activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {member && (
              <Field label="Access" hint="Suspended people can't sign in until you turn them back on.">
                {(p) => (
                  <Select
                    {...p}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MemberStatus)}
                    data-cy="member-status"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </Select>
                )}
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
