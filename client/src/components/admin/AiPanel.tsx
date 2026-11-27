import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAiAdmin, useAiAdminActions, useAiKeyModels } from "../../hooks/useAi";
import { useWorkspace } from "../../hooks/useWorkspace";
import {
  AI_PROVIDERS,
  TIER_LABEL,
  type AiAdminOverview,
  type AiCredential,
  type AiFeature,
  type AiProviderId,
} from "../../types/ai.types";
import { errorMessage } from "../../utils/errors";
import { relative } from "../../utils/formatDate";
import { Button } from "../shared/Button";
import { Badge, Card } from "../shared/Display";
import { Field, FormError, Input, Select } from "../shared/Field";
import { ConfirmDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";
import { AiKeyForm } from "./AiKeyForm";
import { AiUsageCard } from "./AiUsageCard";

/**
 * The platform's AI: the provider keys every business's AI requests run on, the model each feature uses,
 * each business's daily allowance, a connection test, and how AI is being used. Support sees usage only.
 */
export function AiPanel() {
  const { can } = useWorkspace();
  const manage = can("admin.ai");
  const overview = useAiAdmin(manage);
  return (
    <div className="space-y-5">
      {manage && (
        <QueryState query={overview}>
          {(o) => (
            <>
              {!o.settings.storageReady && <StorageWarning />}
              <InUse overview={o} />
              <KeysCard overview={o} />
              <FeatureModelsCard overview={o} />
              <div className="grid gap-5 lg:grid-cols-2">
                <AllowanceCard dailyLimit={o.settings.dailyLimit} />
                <TestCard overview={o} />
              </div>
              <ModelGuide />
            </>
          )}
        </QueryState>
      )}
      <AiUsageCard />
    </div>
  );
}

function StorageWarning() {
  return (
    <div role="alert" className="rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-fg">
      <p className="font-medium">AI keys can't be saved yet.</p>
      <p>
        The server needs its <code>AI_KEYS_SECRET</code> setting to encrypt them. Make one with{" "}
        <code>openssl rand -base64 32</code>, add it to the server's environment (server/.env, and Render), and restart
        the server.
      </p>
    </div>
  );
}

function InUse({ overview }: { overview: AiAdminOverview }) {
  const active = overview.credentials.find((c) => c.isActive);
  if (!active)
    return (
      <div className="rounded-xl bg-info-bg px-4 py-3 text-sm text-info-fg" data-cy="ai-off">
        AI is off: no key is in use, so businesses don't see any AI features. Add a key below.
      </div>
    );
  return (
    <div className="rounded-xl bg-success-bg px-4 py-3 text-sm text-success-fg" data-cy="ai-on">
      AI is on. Businesses use {active.providerLabel}, model <strong>{active.model}</strong>
      {overview.settings.dailyLimit === 0
        ? ", but the daily allowance is 0, so they can't make any requests."
        : `, up to ${overview.settings.dailyLimit} requests per business a day.`}
    </div>
  );
}

function KeysCard({ overview }: { overview: AiAdminOverview }) {
  const { activate, remove } = useAiAdminActions();
  const [form, setForm] = useState<{ editing: AiCredential | null } | null>(null);
  const [removing, setRemoving] = useState<AiCredential | null>(null);
  const keys = overview.credentials;
  const full = keys.length >= AI_PROVIDERS.length;
  const ready = overview.settings.storageReady;

  return (
    <Card
      title="Provider keys"
      action={
        <Button
          size="sm"
          onClick={() => setForm({ editing: null })}
          disabled={full || !ready}
          title={!ready ? "Set AI_KEYS_SECRET on the server first" : undefined}
          data-cy="ai-key-add"
        >
          Add a key
        </Button>
      }
    >
      {keys.length ? (
        <ul className="divide-y divide-line">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-cy="ai-key">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{key.providerLabel}</p>
                <p className="text-xs text-fg-muted">
                  {key.keyLast4 ? `Key ending in ${key.keyLast4}` : "Key saved"} · {key.model}
                  {key.modelTier && ` · ${TIER_LABEL[key.modelTier]}`}
                  {key.baseUrl && ` · ${key.baseUrl}`}
                </p>
                <p className="text-xs text-fg-subtle">Changed {relative(key.updatedAt)}</p>
              </div>
              {!key.readable && <Badge tone="danger">Can't be read: save it again</Badge>}
              {key.isActive && <Badge tone="success">In use</Badge>}
              {!key.isActive && key.readable && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={activate.isPending && activate.variables === key.provider}
                  onClick={() => activate.mutate(key.provider)}
                  data-cy="ai-key-use"
                >
                  Use this
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setForm({ editing: key })}
                disabled={!ready}
                data-cy="ai-key-change"
              >
                Change
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(key)} data-cy="ai-key-remove">
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<KeyRound className="size-6" aria-hidden />}
          title="No AI keys yet"
          message="Add a key from Anthropic, OpenAI, Google Gemini or Ollama. Every business's AI requests will run on it."
        />
      )}

      {form && (
        <AiKeyForm
          open
          onClose={() => setForm(null)}
          editing={form.editing}
          saved={keys.map((k) => k.provider)}
          firstKey={!keys.some((k) => k.isActive)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.provider, { onSuccess: () => setRemoving(null) })}
        title={`Remove the ${removing?.providerLabel ?? ""} key?`}
        message={
          removing?.isActive
            ? "It is the key in use: AI will be off for every business until you put another key in use."
            : "The key is deleted. Features that used it go back to the key in use."
        }
        confirmLabel="Remove key"
        danger
        loading={remove.isPending}
      />
    </Card>
  );
}

/** One feature's model: the key in use (default), or a saved key and one of its models. Saved on change. */
function FeatureRow({
  feature,
  label,
  description,
  credentials,
}: {
  feature: AiFeature;
  label: string;
  description: string;
  credentials: AiCredential[];
}) {
  const pinned = credentials.find((c) => c.featureModels[feature]);
  const active = credentials.find((c) => c.isActive);
  const [provider, setProvider] = useState<AiProviderId | "">(pinned?.provider ?? "");
  const models = useAiKeyModels(provider || null);
  const { setFeatureModel } = useAiAdminActions();
  const current = pinned?.featureModels[feature] ?? "";

  useEffect(() => setProvider(pinned?.provider ?? ""), [pinned?.provider]);

  const chooseProvider = (value: AiProviderId | "") => {
    setProvider(value);
    if (!value && pinned) setFeatureModel.mutate({ feature, choice: null });
  };
  const chooseModel = (model: string) => {
    if (provider && model) setFeatureModel.mutate({ feature, choice: { provider, model } });
  };

  return (
    <li className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_12rem_16rem] sm:items-start" data-cy="ai-feature">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      <Select
        aria-label={`${label}: provider`}
        value={provider}
        onChange={(e) => chooseProvider(e.target.value as AiProviderId | "")}
        disabled={setFeatureModel.isPending}
      >
        <option value="">Default ({active ? active.providerLabel : "no key in use"})</option>
        {credentials
          .filter((c) => c.readable)
          .map((c) => (
            <option key={c.provider} value={c.provider}>
              {c.providerLabel}
            </option>
          ))}
      </Select>
      {provider ? (
        <div>
          <Select
            aria-label={`${label}: model`}
            value={provider === pinned?.provider ? current : ""}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={models.isLoading || setFeatureModel.isPending}
          >
            <option value="" disabled>
              {models.isLoading ? "Loading models…" : "Choose a model"}
            </option>
            {/* Keep the pinned model selectable even if the provider stops listing it. */}
            {current && provider === pinned?.provider && !models.data?.some((m) => m.id === current) && (
              <option value={current}>{current}</option>
            )}
            {models.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.tier ? ` · ${TIER_LABEL[m.tier]}` : ""}
              </option>
            ))}
          </Select>
          {models.error && <p className="mt-1 text-xs text-danger-fg">{errorMessage(models.error)}</p>}
        </div>
      ) : (
        <p className="text-xs text-fg-subtle sm:pt-2">{active ? active.model : "—"}</p>
      )}
    </li>
  );
}

function FeatureModelsCard({ overview }: { overview: AiAdminOverview }) {
  if (!overview.credentials.length) return null;
  return (
    <Card title="Model for each feature">
      <p className="px-4 pt-3 text-xs text-fg-muted">
        Leave a feature on Default to use the key in use. Snap a record reads photos, so choose a model that can see
        images.
      </p>
      <ul className="divide-y divide-line">
        {overview.features.map((f) => (
          <FeatureRow
            key={f.id}
            feature={f.id}
            label={f.label}
            description={f.description}
            credentials={overview.credentials}
          />
        ))}
      </ul>
    </Card>
  );
}

function AllowanceCard({ dailyLimit }: { dailyLimit: number }) {
  const { updateSettings } = useAiAdminActions();
  const [value, setValue] = useState(String(dailyLimit));
  useEffect(() => setValue(String(dailyLimit)), [dailyLimit]);
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000;

  return (
    <Card title="Daily allowance">
      <div className="space-y-3 p-4">
        <p className="text-sm text-fg-muted">
          How many AI requests each business may make a day on the platform's key. It starts again at midnight in the
          business's time zone. Requests that fail don't count. 0 switches AI off for every business.
        </p>
        <Field label="Requests per business per day" error={valid ? undefined : "A whole number from 0 to 10,000"}>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              max={10_000}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-cy="ai-daily-limit"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => updateSettings.mutate(parsed)}
            loading={updateSettings.isPending}
            disabled={!valid || parsed === dailyLimit}
            data-cy="ai-daily-limit-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TestCard({ overview }: { overview: AiAdminOverview }) {
  const { test } = useAiAdminActions();
  const [feature, setFeature] = useState<AiFeature | "">("");
  const hasKey = overview.credentials.some((c) => c.isActive);

  return (
    <Card title="Test the connection">
      <div className="space-y-3 p-4">
        <p className="text-sm text-fg-muted">
          Sends a tiny request to check the key and model really answer. It doesn't count against any business.
        </p>
        <Field label="Which model">
          {(p) => (
            <Select {...p} value={feature} onChange={(e) => setFeature(e.target.value as AiFeature | "")}>
              <option value="">The key in use</option>
              {overview.features.map((f) => (
                <option key={f.id} value={f.id}>
                  The model for {f.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <FormError message={test.error ? errorMessage(test.error) : null} />
        {test.data && !test.error && (
          <div
            className="rounded-lg bg-success-bg px-3 py-2 text-sm text-success-fg"
            role="status"
            data-cy="ai-test-ok"
          >
            <p>
              {test.data.providerLabel} · {test.data.model} answered in {(test.data.durationMs / 1000).toFixed(1)} s (
              {test.data.inputTokens + test.data.outputTokens} tokens):
            </p>
            <p className="mt-1 italic">“{test.data.reply}”</p>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => test.mutate(feature || undefined)}
            loading={test.isPending}
            disabled={!hasKey}
            data-cy="ai-test"
          >
            Run test
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Advice only: providers don't publish tiers, so they are read from the model's name. */
function ModelGuide() {
  return (
    <Card title="Choosing a model">
      <div className="space-y-2 p-4 text-sm text-fg-muted">
        <p>
          <strong className="text-fg">{TIER_LABEL.capable}</strong>: the best at reading messy handwriting and getting
          every detail right, and the most expensive per request.
        </p>
        <p>
          <strong className="text-fg">{TIER_LABEL.balanced}</strong>: good accuracy at a lower price. A sensible start
          for reading records.
        </p>
        <p>
          <strong className="text-fg">{TIER_LABEL.fast}</strong>: cheapest and quickest, but more likely to misread a
          photo.
        </p>
        <p>
          The labels come from the model's name, so treat them as a guide. Prices:{" "}
          {AI_PROVIDERS.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " · "}
              <a href={p.pricing} target="_blank" rel="noreferrer" className="text-link hover:underline">
                {p.label}
              </a>
            </span>
          ))}
          .
        </p>
      </div>
    </Card>
  );
}
