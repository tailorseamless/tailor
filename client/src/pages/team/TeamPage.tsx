import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, UserPlus } from "lucide-react";
import { useState } from "react";
import { BranchesCard } from "../../components/team/BranchesCard";
import { MemberForm } from "../../components/team/MemberForm";
import { Button } from "../../components/shared/Button";
import { Badge, Card, PageHeader } from "../../components/shared/Display";
import { ConfirmDialog } from "../../components/shared/Modal";
import { QueryState } from "../../components/shared/States";
import { useTeam, useTeamActions } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { TeamMember } from "../../types/workspace.types";
import { ROLE } from "../../utils/labels";

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-fg outline-none data-[highlighted]:bg-subtle";

export default function TeamPage() {
  const { can, me } = useWorkspace();
  const query = useTeam({ limit: 100 });
  const { remove, resend } = useTeamActions();
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const canManage = can("team.manage");

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Who works with you, and what each person can do."
        actions={
          canManage && (
            <Button
              icon={<UserPlus className="size-4" aria-hidden />}
              onClick={() => setEditing("new")}
              data-cy="team-add"
            >
              Add person
            </Button>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <QueryState query={query} loadingLabel="Loading your team">
            {({ data }) => (
              <ul className="divide-y divide-line">
                {data.map((m) => {
                  const self = m.userId === me.user.id;
                  return (
                    <li key={m.userId} className="flex items-center gap-3 px-4 py-3" data-cy="member-row">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-link">
                        {m.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {m.fullName}
                          {self && <span className="font-normal text-fg-subtle"> (you)</span>}
                        </p>
                        <p className="truncate text-xs text-fg-muted">
                          {m.email}
                          {m.branchName && ` · ${m.branchName}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE[m.role].label}</Badge>
                        {m.status === "suspended" ? (
                          <Badge tone="danger">Suspended</Badge>
                        ) : (
                          !m.hasSignedIn && <Badge tone="warning">Invited</Badge>
                        )}
                      </div>
                      {canManage && (
                        <Menu.Root>
                          <Menu.Trigger
                            className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle"
                            aria-label={`Actions for ${m.fullName}`}
                            data-cy="member-menu"
                          >
                            <MoreVertical className="size-4" aria-hidden />
                          </Menu.Trigger>
                          <Menu.Portal>
                            <Menu.Content
                              align="end"
                              className="z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-pop"
                            >
                              <Menu.Item className={itemClass} onSelect={() => setEditing(m)} data-cy="member-edit">
                                Edit
                              </Menu.Item>
                              {!m.hasSignedIn && (
                                <Menu.Item
                                  className={itemClass}
                                  onSelect={() => resend.mutate(m.userId)}
                                  data-cy="member-resend"
                                >
                                  Send invitation again
                                </Menu.Item>
                              )}
                              {m.role !== "owner" && !self && (
                                <Menu.Item
                                  className={`${itemClass} text-danger-fg`}
                                  onSelect={() => setRemoving(m)}
                                  data-cy="member-remove"
                                >
                                  Remove from team
                                </Menu.Item>
                              )}
                            </Menu.Content>
                          </Menu.Portal>
                        </Menu.Root>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryState>
        </Card>
        {can("branch.read") && <BranchesCard />}
      </div>
      {editing && <MemberForm member={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.userId, { onSuccess: () => setRemoving(null) })}
        title={`Remove ${removing?.fullName ?? ""}?`}
        message="They lose access straight away. Work they recorded stays in your records."
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
