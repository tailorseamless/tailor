import { Camera, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { captureCopy } from "../../components/capture/captureCopy";
import {
  isSaved,
  missingRequired,
  problemsOf,
  toEditable,
  type EditableRecord,
} from "../../components/capture/captureDraft";
import { CaptureRecordCard } from "../../components/capture/CaptureRecordCard";
import { FilePicker } from "../../components/capture/FilePicker";
import { TemplateOfferDialog } from "../../components/capture/TemplateOfferDialog";
import { planTemplates, type TemplateProposal } from "../../components/capture/templatePlan";
import { Button, ButtonLink } from "../../components/shared/Button";
import { Card, PageHeader } from "../../components/shared/Display";
import { FormError } from "../../components/shared/Field";
import { ConfirmDialog } from "../../components/shared/Modal";
import { EmptyState, Spinner } from "../../components/shared/States";
import { useAiStatus, useRecordCapture } from "../../hooks/useAi";
import { useSaveCapture, useSaveTemplates } from "../../hooks/useCapture";
import { useMeasurementTemplates } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { RecordCaptureDraft } from "../../types/ai.types";
import { errorMessage } from "../../utils/errors";
import { prepareRecordFile, recordFileProblem } from "../../utils/recordFiles";
import { PhotoProblem } from "../../utils/shrinkPhoto";
import { supportLink } from "../../utils/supportLink";
import { todayIn } from "../../utils/timezone";

const MAX_FILES = 4;

/**
 * Snap a record: photograph paper records or upload a file (measurement book, order cards, customer list,
 * spreadsheet) and the app fills in customers, measurements and orders. Nothing is saved until the person
 * checks it and presses Save; they are then asked whether new measurements should go into their templates.
 */
export default function CapturePage() {
  const { me, business, timeZone, currency, can } = useWorkspace();
  const status = useAiStatus("record_capture");
  const templatesQuery = useMeasurementTemplates();
  const templates = templatesQuery.data?.data ?? [];
  const read = useRecordCapture();
  const { save, saving } = useSaveCapture(currency);
  const saveTemplates = useSaveTemplates();
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecordCaptureDraft | null>(null);
  const [records, setRecords] = useState<EditableRecord[]>([]);
  const [result, setResult] = useState<{ saved: number; failed: number } | null>(null);
  const [offer, setOffer] = useState<TemplateProposal[] | null>(null);
  const [startingOver, setStartingOver] = useState(false);
  const today = todayIn(timeZone);
  const canEditTemplates = can("measurement.template.manage");
  const support = supportLink(me.support?.whatsapp, business.name);

  const addFiles = (added: File[]) => {
    const problems = added.map(recordFileProblem).filter((p): p is string => p !== null);
    const usable = added.filter((file) => recordFileProblem(file) === null);
    const room = MAX_FILES - files.length;
    if (usable.length > room) problems.push(`Only ${MAX_FILES} at a time: the first ${room} were added.`);
    setFileError(problems.join(" ") || null);
    setFiles((current) => [...current, ...usable.slice(0, Math.max(0, room))]);
  };

  const readFiles = async () => {
    setFileError(null);
    setPreparing(true);
    let ready: File[];
    try {
      ready = await Promise.all(files.map(prepareRecordFile));
    } catch (err) {
      setFileError(err instanceof PhotoProblem ? err.message : "A file couldn't be prepared. Try adding it again.");
      return;
    } finally {
      setPreparing(false);
    }
    read.mutate(ready, {
      onSuccess: (data) => {
        setDraft(data);
        setRecords(toEditable(data));
        setResult(null);
      },
    });
  };

  const startOver = () => {
    setDraft(null);
    setRecords([]);
    setFiles([]);
    setResult(null);
    setOffer(null);
    read.reset();
    setStartingOver(false);
  };

  const chosen = records.filter((r) => r.include);
  const waiting = chosen.filter((r) => !isSaved(r));
  const ready = waiting.filter((r) => problemsOf(r, templates).length === 0);
  const allSaved = chosen.length > 0 && waiting.length === 0;
  const unsavedWork = draft !== null && waiting.length > 0;
  const proposals = planTemplates(ready, templates);
  const busy = saving || saveTemplates.isPending;

  const saveRecords = async (list: EditableRecord[]) => {
    const outcome = await save(list, templates, (updated) =>
      setRecords((current) => current.map((r) => (r.key === updated.key ? updated : r))),
    );
    setResult(outcome);
  };

  const saveAll = () => {
    // Ask first, when there is something new and this person may change templates.
    if (canEditTemplates && proposals.length) setOffer(proposals);
    else void saveRecords(records);
  };

  const saveWithTemplates = async (accepted: TemplateProposal[]) => {
    // A failure is already shown as a message, and no record is saved yet: the question stays open.
    const assigned = await saveTemplates.mutateAsync(accepted).catch(() => null);
    if (!assigned) return;
    const updated = records.map((r) => {
      const template = assigned.get(r.key);
      const m = r.measurement;
      if (!template || !m) return r;
      // Not when the template insists on a measurement this record lacks: it would then refuse to save.
      const names = m.values.map((v) => v.name);
      if (missingRequired(template, names).length) return r;
      return { ...r, measurement: { ...m, templateId: template.id } };
    });
    setRecords(updated);
    setOffer(null);
    await saveRecords(updated);
  };

  return (
    <>
      <PageHeader
        title="Snap or upload a record"
        subtitle="Take a photo of your measurement book, order cards or customer list, or upload a file. The app reads it and fills in the forms for you to check."
        back={{ to: "/customers", label: "Customers" }}
      />

      {status.isLoading ? (
        <Spinner />
      ) : !draft && !status.data?.available ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" aria-hidden />}
            title={
              status.data?.configured && status.data.tokensLeft === 0
                ? "You're out of tokens"
                : "This isn't available right now"
            }
            message={status.data?.unavailableReason ?? (status.error ? errorMessage(status.error) : "Try again later.")}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                {status.data?.configured && support && (
                  <a href={support} target="_blank" rel="noopener noreferrer" className="text-sm text-link underline">
                    Ask for more on WhatsApp
                  </a>
                )}
                <ButtonLink to="/customers" variant="secondary">
                  Add customers by hand
                </ButtonLink>
              </div>
            }
          />
        </Card>
      ) : !draft ? (
        <Card>
          <div className="space-y-4 p-4">
            <FilePicker
              files={files}
              onAdd={addFiles}
              onRemove={(i) => setFiles((current) => current.filter((_, j) => j !== i))}
              max={MAX_FILES}
              disabled={preparing || read.isPending}
            />
            <FormError message={fileError ?? (read.error ? errorMessage(read.error) : null)} />
            {read.isPending || preparing ? (
              <div
                className="flex items-center gap-3 rounded-lg bg-info-bg px-3 py-3 text-sm text-info-fg"
                role="status"
              >
                <Spinner label="Reading" />
                <span>{preparing ? "Preparing your files…" : captureCopy.reading}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-fg-muted">{captureCopy.notice(status.data?.tokensLeft ?? 0)}</p>
                <Button
                  icon={<Camera className="size-4" aria-hidden />}
                  onClick={readFiles}
                  disabled={!files.length}
                  data-cy="capture-read"
                >
                  Read it
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div
            className="space-y-2 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-fg"
            data-cy="capture-notice"
          >
            <p className="font-medium">AI draft: check it against your records before you save.</p>
            {draft.summary && <p>{draft.summary}</p>}
            {draft.unreadable.length > 0 && (
              <div>
                <p className="font-medium">The AI couldn't read these, so check them yourself:</p>
                <ul className="list-disc pl-5">
                  {draft.unreadable.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {draft.caveats.length > 0 && (
              <div>
                <p className="font-medium">Double-check:</p>
                <ul className="list-disc pl-5">
                  {draft.caveats.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs">{captureCopy.spent(draft.tokensUsed, draft.tokensLeft)}</p>
          </div>

          {records.length === 0 ? (
            <Card>
              <EmptyState
                title="No records found"
                message="Try again with a clearer photo of one page, flat and in good light, or another file."
                action={<Button onClick={startOver}>Try something else</Button>}
              />
            </Card>
          ) : (
            <>
              {records.map((record, i) => (
                <CaptureRecordCard
                  key={record.key}
                  index={i}
                  record={record}
                  onChange={(next) => setRecords((current) => current.map((r) => (r.key === next.key ? next : r)))}
                  templates={templates}
                  currency={currency}
                  timeZone={timeZone}
                  today={today}
                  busy={busy}
                />
              ))}

              {!canEditTemplates && proposals.length > 0 && (
                <p className="text-sm text-fg-muted">
                  Some of these measurements aren't in your templates. They are still saved for each customer; an owner
                  or manager can add them to the templates in Settings.
                </p>
              )}

              {allSaved ? (
                <Card>
                  <div className="flex flex-wrap items-center gap-3 p-4" role="status" data-cy="capture-done">
                    <CheckCircle2 className="size-6 text-success-fg" aria-hidden />
                    <p className="flex-1 text-sm text-fg">
                      All saved. Open each customer from the list above, or add the next page.
                    </p>
                    <Button onClick={startOver}>Add another</Button>
                    <Link to="/customers" className="text-sm text-link hover:underline">
                      Go to customers
                    </Link>
                  </div>
                </Card>
              ) : (
                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-modal">
                  <p className="text-sm text-fg-muted">
                    {result && result.failed > 0
                      ? `${result.saved} saved, ${result.failed} couldn't be: see the messages above.`
                      : `${ready.length} of ${waiting.length} ready to save.`}
                    {waiting.length > ready.length && " The others need a look first."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => (unsavedWork ? setStartingOver(true) : startOver())}
                      disabled={busy}
                    >
                      Start again
                    </Button>
                    <Button onClick={saveAll} loading={busy} disabled={!ready.length} data-cy="capture-save">
                      {ready.length === waiting.length ? "Save all" : `Save the ${ready.length} ready`}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {offer && (
        <TemplateOfferDialog
          proposals={offer}
          templates={templates}
          saving={busy}
          onYes={saveWithTemplates}
          onNo={() => {
            setOffer(null);
            void saveRecords(records);
          }}
          onClose={() => setOffer(null)}
        />
      )}
      <ConfirmDialog
        open={startingOver}
        onClose={() => setStartingOver(false)}
        onConfirm={startOver}
        title="Start again?"
        message="What you haven't saved from these records will be lost."
        confirmLabel="Start again"
        danger
      />
    </>
  );
}
