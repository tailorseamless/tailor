import { Camera, CheckCircle2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { captureCopy } from "../../components/capture/captureCopy";
import { isSaved, problemsOf, toEditable, type EditableRecord } from "../../components/capture/captureDraft";
import { CaptureRecordCard } from "../../components/capture/CaptureRecordCard";
import { PhotoPicker } from "../../components/capture/PhotoPicker";
import { Button, ButtonLink } from "../../components/shared/Button";
import { Card, PageHeader } from "../../components/shared/Display";
import { FormError } from "../../components/shared/Field";
import { ConfirmDialog } from "../../components/shared/Modal";
import { EmptyState, Spinner } from "../../components/shared/States";
import { useMeasurementTemplates } from "../../hooks/useCustomers";
import { useAiStatus, useRecordCapture } from "../../hooks/useAi";
import { useSaveCapture } from "../../hooks/useCapture";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { RecordCaptureDraft } from "../../types/ai.types";
import { errorMessage } from "../../utils/errors";
import { PhotoProblem, shrinkPhoto } from "../../utils/shrinkPhoto";
import { todayIn } from "../../utils/timezone";

const MAX_PHOTOS = 4;

/**
 * Snap a record: photograph paper records (measurement book, order cards, customer lists) and the app fills
 * in customers, measurements and orders. Nothing is saved until the person checks it and presses Save.
 */
export default function CapturePage() {
  const { timeZone, currency } = useWorkspace();
  const status = useAiStatus("record_capture");
  const templates = useMeasurementTemplates();
  const read = useRecordCapture();
  const { save, saving } = useSaveCapture(currency);
  const [photos, setPhotos] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecordCaptureDraft | null>(null);
  const [records, setRecords] = useState<EditableRecord[]>([]);
  const [result, setResult] = useState<{ saved: number; failed: number } | null>(null);
  const [startingOver, setStartingOver] = useState(false);
  const today = todayIn(timeZone);

  const addPhotos = (files: File[]) => {
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setPhotoError(`Only ${MAX_PHOTOS} photos at a time: the first ${room} were added.`);
    setPhotos((current) => [...current, ...files.slice(0, Math.max(0, room))]);
  };

  const readPhotos = async () => {
    setPhotoError(null);
    setPreparing(true);
    let ready: File[];
    try {
      ready = await Promise.all(photos.map((photo, i) => shrinkPhoto(photo, i)));
    } catch (err) {
      setPhotoError(err instanceof PhotoProblem ? err.message : "A photo couldn't be prepared. Try taking it again.");
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
    setPhotos([]);
    setResult(null);
    read.reset();
    setStartingOver(false);
  };

  const saveAll = async () => {
    const outcome = await save(records, (updated) =>
      setRecords((current) => current.map((r) => (r.key === updated.key ? updated : r))),
    );
    setResult(outcome);
  };

  const chosen = records.filter((r) => r.include);
  const waiting = chosen.filter((r) => !isSaved(r));
  const ready = waiting.filter((r) => problemsOf(r).length === 0);
  const allSaved = chosen.length > 0 && waiting.length === 0;
  const unsavedWork = draft !== null && waiting.length > 0;

  return (
    <>
      <PageHeader
        title="Snap a record"
        subtitle="Take a photo of your measurement book, order cards or customer list. The app reads it and fills in the forms for you to check."
        back={{ to: "/customers", label: "Customers" }}
      />

      {status.isLoading ? (
        <Spinner />
      ) : !status.data?.available ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" aria-hidden />}
            title="Snap a record isn't available right now"
            message={
              status.data?.unavailableReason ?? (status.error ? errorMessage(status.error) : "Please try again later.")
            }
            action={
              <ButtonLink to="/customers" variant="secondary">
                Add customers by hand
              </ButtonLink>
            }
          />
        </Card>
      ) : !draft ? (
        <Card>
          <div className="space-y-4 p-4">
            <PhotoPicker
              photos={photos}
              onAdd={addPhotos}
              onRemove={(i) => setPhotos((current) => current.filter((_, j) => j !== i))}
              max={MAX_PHOTOS}
              disabled={preparing || read.isPending}
            />
            <FormError message={photoError ?? (read.error ? errorMessage(read.error) : null)} />
            {read.isPending || preparing ? (
              <div
                className="flex items-center gap-3 rounded-lg bg-info-bg px-3 py-3 text-sm text-info-fg"
                role="status"
              >
                <Spinner label="Reading" />
                <span>{preparing ? "Preparing the photos…" : captureCopy.reading}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-fg-muted">
                  {captureCopy.disclosure(status.data.providerLabel ?? "the AI provider")} {status.data.remainingToday}{" "}
                  left today.
                </p>
                <Button
                  icon={<Camera className="size-4" aria-hidden />}
                  onClick={readPhotos}
                  disabled={!photos.length}
                  data-cy="capture-read"
                >
                  Read the photos
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
            <p className="font-medium">AI draft: check it against the paper before you save.</p>
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
            <p className="text-xs">
              Read by {draft.providerLabel} · {draft.model}
            </p>
          </div>

          {records.length === 0 ? (
            <Card>
              <EmptyState
                title="No records found in these photos"
                message="Try again with a clearer photo of one page, flat and in good light."
                action={<Button onClick={startOver}>Try other photos</Button>}
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
                  templates={templates.data?.data ?? []}
                  currency={currency}
                  timeZone={timeZone}
                  today={today}
                  busy={saving}
                />
              ))}

              {allSaved ? (
                <Card>
                  <div className="flex flex-wrap items-center gap-3 p-4" role="status" data-cy="capture-done">
                    <CheckCircle2 className="size-6 text-success-fg" aria-hidden />
                    <p className="flex-1 text-sm text-fg">
                      All saved. Open each customer from the list above, or snap the next page.
                    </p>
                    <Button onClick={startOver}>Snap another page</Button>
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
                      disabled={saving}
                    >
                      Start again
                    </Button>
                    <Button onClick={saveAll} loading={saving} disabled={!ready.length} data-cy="capture-save">
                      {ready.length === waiting.length ? "Save all" : `Save the ${ready.length} ready`}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={startingOver}
        onClose={() => setStartingOver(false)}
        onConfirm={startOver}
        title="Start again?"
        message="What you haven't saved from these photos will be lost."
        confirmLabel="Start again"
        danger
      />
    </>
  );
}
