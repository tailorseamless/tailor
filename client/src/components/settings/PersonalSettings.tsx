import { Bell, BellOff, Download, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme, type ThemeChoice } from "../../contexts/ThemeContext";
import { useNotificationPreferences, useSavePreferences, useUpdateProfile } from "../../hooks/useAccount";
import { useInstallApp } from "../../hooks/useInstallApp";
import { usePush } from "../../hooks/usePush";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { NotificationPreference } from "../../types/dashboard.types";
import { cn } from "../../utils/cn";
import { isPhone, orNull } from "../../utils/validation";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";
import { Field, FormError, Input } from "../shared/Field";
import { PhoneInput } from "../shared/PhoneInput";
import { QueryState } from "../shared/States";

export function ProfileSettings() {
  const { me } = useWorkspace();
  const update = useUpdateProfile();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState(me.user.fullName);
  const [phone, setPhone] = useState(me.user.phone ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    if (fullName.trim().length < 2) return setProblem("Enter your name.");
    if (phone.trim() && !isPhone(phone)) return setProblem("Enter a valid phone number.");
    setProblem(null);
    update.mutate({ fullName: fullName.trim(), phone: orNull(phone) }, { onSuccess: () => void refresh() });
  };

  return (
    <Card title="You">
      <div className="space-y-4 p-4">
        <FormError message={problem} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            {(p) => <Input {...p} value={fullName} onChange={(e) => setFullName(e.target.value)} data-cy="me-name" />}
          </Field>
          <Field label="Phone">
            {(p) => <PhoneInput {...p} value={phone} onChange={setPhone} data-cy="me-phone" />}
          </Field>
        </div>
        <p className="text-sm text-fg-muted">
          Signed in as {me.user.email} · {me.roles.join(", ")}
        </p>
        <Button onClick={save} loading={update.isPending} data-cy="me-save">
          Save
        </Button>
      </div>
    </Card>
  );
}

export function NotificationSettings() {
  const query = useNotificationPreferences();
  const save = useSavePreferences();
  const [draft, setDraft] = useState<NotificationPreference[] | null>(null);

  return (
    <Card title="Notify me about">
      <QueryState query={query}>
        {(data) => {
          const rows = draft ?? data.preferences;
          const flip = (type: string, channel: "inApp" | "email" | "push") =>
            setDraft(rows.map((r) => (r.type === type ? { ...r, [channel]: !r[channel] } : r)));
          const channels: { key: "inApp" | "email" | "push"; label: string }[] = [
            { key: "inApp", label: "In app" },
            { key: "email", label: "Email" },
            ...(data.pushAvailable ? [{ key: "push" as const, label: "Push" }] : []),
          ];
          return (
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-fg-subtle">
                      <th className="pb-2 font-medium">Event</th>
                      {channels.map((c) => (
                        <th key={c.key} className="w-16 pb-2 text-center font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.type}>
                        <td className="py-2 pr-3 text-fg">{r.label}</td>
                        {channels.map((c) => (
                          <td key={c.key} className="py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-brand"
                              checked={r[c.key]}
                              onChange={() => flip(r.type, c.key)}
                              aria-label={`${r.label}: ${c.label}`}
                              data-cy={`pref-${r.type}-${c.key}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="mt-4"
                disabled={!draft}
                loading={save.isPending}
                onClick={() => draft && save.mutate(draft, { onSuccess: () => setDraft(null) })}
                data-cy="prefs-save"
              >
                Save choices
              </Button>
            </div>
          );
        }}
      </QueryState>
    </Card>
  );
}

const themes: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Device", icon: Monitor },
];

export function DeviceSettings() {
  const { choice, setChoice } = useTheme();
  const { signOut } = useAuth();
  const app = useInstallApp();
  const push = usePush();
  return (
    <Card title="This device">
      <div className="space-y-4 p-4">
        <div role="radiogroup" aria-label="Appearance" className="flex gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              onClick={() => setChoice(value)}
              data-cy={`theme-${value}`}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm",
                choice === value ? "border-brand bg-brand-soft text-link" : "border-line text-fg-muted hover:bg-subtle",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        {push.supported && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
            <div>
              <p className="text-sm font-medium text-fg">Notifications on this device</p>
              <p className="text-xs text-fg-subtle">
                {push.enabled
                  ? "On. Choose which ones above."
                  : push.blocked
                    ? "Blocked in your browser settings for this site."
                    : "Get reminders and new requests even when Tailor Seamless is closed."}
              </p>
            </div>
            {push.enabled ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<BellOff className="size-4" aria-hidden />}
                loading={push.disable.isPending}
                onClick={() => push.disable.mutate(undefined)}
                data-cy="push-off"
              >
                Turn off
              </Button>
            ) : (
              <Button
                size="sm"
                icon={<Bell className="size-4" aria-hidden />}
                disabled={push.blocked}
                loading={push.enable.isPending}
                onClick={() => push.enable.mutate(undefined)}
                data-cy="push-on"
              >
                Turn on
              </Button>
            )}
          </div>
        )}
        {app.available && !app.installed && (
          <Button
            variant="secondary"
            className="w-full"
            icon={<Download className="size-4" aria-hidden />}
            onClick={() => void app.install()}
            data-cy="install-app"
          >
            Install Tailor Seamless on this device
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full"
          icon={<LogOut className="size-4" aria-hidden />}
          onClick={() => void signOut()}
          data-cy="settings-sign-out"
        >
          Sign out
        </Button>
      </div>
    </Card>
  );
}
