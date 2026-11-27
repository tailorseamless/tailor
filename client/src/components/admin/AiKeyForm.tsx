import { useState } from "react";
import { useAiAdminActions } from "../../hooks/useAi";
import { AI_PROVIDERS, TIER_LABEL, type AiCredential, type AiModel, type AiProviderId } from "../../types/ai.types";
import { errorMessage, fieldErrors } from "../../utils/errors";
import { Button } from "../shared/Button";
import { Field, FormError, Input, Select, Toggle } from "../shared/Field";
import { Modal } from "../shared/Modal";

const OLLAMA_CLOUD = "https://ollama.com";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Changing a saved key; null adds one. */
  editing: AiCredential | null;
  /** Providers that already have a key (adding picks among the others). */
  saved: AiProviderId[];
  /** Nothing is in use yet: the first key saved is put in use anyway. */
  firstKey: boolean;
}

const modelLabel = (model: AiModel) =>
  `${model.label}${model.label !== model.id ? ` (${model.id})` : ""}${model.tier ? ` · ${TIER_LABEL[model.tier]}` : ""}`;

/**
 * Add or change a platform AI key. The key is checked with the provider before it is saved ("Check key and
 * load models"), and is never shown again: only its last 4 characters.
 */
export function AiKeyForm({ open, onClose, editing, saved, firstKey }: Props) {
  const choices = editing
    ? AI_PROVIDERS.filter((p) => p.id === editing.provider)
    : AI_PROVIDERS.filter((p) => !saved.includes(p.id));
  const [provider, setProvider] = useState<AiProviderId>(editing?.provider ?? choices[0]?.id ?? "anthropic");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? OLLAMA_CLOUD);
  const [model, setModel] = useState(editing?.model ?? "");
  const [models, setModels] = useState<AiModel[] | null>(null);
  const [makeActive, setMakeActive] = useState(firstKey || (editing?.isActive ?? false));
  const { checkKey, save } = useAiAdminActions();

  const isOllama = provider === "ollama";
  const error = save.error ?? checkKey.error;
  const fieldError = (field: string) => fieldErrors(error).find((e) => e.field === field)?.message;
  const generalError =
    error && !fieldErrors(error).some((e) => ["apiKey", "baseUrl", "model"].includes(e.field))
      ? errorMessage(error)
      : null;

  const reset = () => {
    setModels(null);
    checkKey.reset();
    save.reset();
  };

  const loadModels = () => {
    save.reset();
    checkKey.mutate(
      { provider, apiKey: apiKey.trim() || undefined, baseUrl: isOllama ? baseUrl.trim() : undefined },
      {
        onSuccess: (list) => {
          setModels(list);
          if (!list.some((m) => m.id === model)) setModel(list[0]?.id ?? "");
        },
      },
    );
  };

  const submit = () =>
    save.mutate(
      {
        provider,
        input: {
          apiKey: apiKey.trim() || undefined,
          model: model.trim(),
          baseUrl: isOllama ? baseUrl.trim() : undefined,
          makeActive,
        },
      },
      { onSuccess: onClose },
    );

  const needsKey = !editing && !isOllama;
  const canSave = model.trim().length > 0 && (!needsKey || apiKey.trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Change the ${editing.providerLabel} key` : "Add an AI key"}
      description="The key is checked with the provider before it is saved, stored encrypted, and never shown again."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={!canSave} data-cy="ai-key-save">
            Check and save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={generalError} />
        <Field label="Provider">
          {(p) => (
            <Select
              {...p}
              value={provider}
              disabled={Boolean(editing)}
              onChange={(e) => {
                setProvider(e.target.value as AiProviderId);
                setModel("");
                reset();
              }}
              data-cy="ai-key-provider"
            >
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {isOllama && (
          <Field
            label="Server address"
            error={fieldError("baseUrl")}
            hint="Ollama Cloud is https://ollama.com (make an API key at ollama.com/settings/keys). Or your own Ollama server's https address."
          >
            {(p) => (
              <Input
                {...p}
                value={baseUrl}
                inputMode="url"
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setModels(null);
                }}
              />
            )}
          </Field>
        )}

        <Field
          label="API key"
          error={fieldError("apiKey")}
          hint={
            editing
              ? `Leave empty to keep the saved key${editing.keyLast4 ? ` (ending in ${editing.keyLast4})` : ""}.`
              : isOllama
                ? "Your own server may not need one."
                : "Paste the whole key from the provider's console."
          }
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setModels(null);
              }}
              data-cy="ai-key-input"
            />
          )}
        </Field>

        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadModels}
            loading={checkKey.isPending}
            disabled={needsKey && !apiKey.trim()}
            data-cy="ai-key-check"
          >
            Check key and load models
          </Button>
          {models && (
            <p className="mt-2 text-xs text-success-fg" role="status">
              The key works: {models.length} model{models.length === 1 ? "" : "s"} available.
            </p>
          )}
        </div>

        <Field
          label="Model"
          error={fieldError("model")}
          hint="Used for every feature that isn't given its own model below."
        >
          {(p) =>
            models && models.length > 0 ? (
              <Select {...p} value={model} onChange={(e) => setModel(e.target.value)} data-cy="ai-key-model">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelLabel(m)}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...p}
                value={model}
                placeholder={models ? "Type the model name" : "Check the key to choose from a list"}
                onChange={(e) => setModel(e.target.value)}
                data-cy="ai-key-model"
              />
            )
          }
        </Field>

        <Toggle
          checked={makeActive}
          onChange={setMakeActive}
          disabled={firstKey || (editing?.isActive ?? false)}
          label="Put this key in use"
          description={
            firstKey
              ? "It's the first key, so it will be in use straight away."
              : "Every business's AI requests will use this key."
          }
        />
      </div>
    </Modal>
  );
}
