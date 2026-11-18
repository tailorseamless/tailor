import { Ruler, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useDeleteMeasurement, useMeasurements } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { CustomerGender, Measurement } from "../../types/customer.types";
import { BUILDS, buildFor, placeMeasurements, type Build } from "../../utils/bodyMap";
import { cn } from "../../utils/cn";
import { formatDay } from "../../utils/formatDate";
import { Button, IconButton } from "../shared/Button";
import { Card } from "../shared/Display";
import { Select } from "../shared/Field";
import { ConfirmDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";
import { BodyDiagram } from "./BodyDiagram";
import { FigureColumn, MeasurementSetView } from "./MeasurementSetView";
import { MeasurementForm } from "./MeasurementForm";

const placedFor = (m: Measurement) => placeMeasurements(m.values, m.unit, m.templateName);

/** Female, male or neutral figure. Starts from the customer's gender; the choice is not saved. */
function BuildSwitch({ value, onChange }: { value: Build; onChange: (build: Build) => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-fg-muted">Figure</span>
      <div role="group" aria-label="Figure" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {BUILDS.map((b) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={value === b.value}
            onClick={() => onChange(b.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              value === b.value ? "bg-brand-soft text-link" : "text-fg-muted hover:text-fg",
            )}
            data-cy={`figure-${b.value}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The latest set drawn on a body, with an older set to lay over it for comparison. */
function BodyView({
  latest,
  older,
  build,
  onBuild,
}: {
  latest: Measurement;
  older: Measurement[];
  build: Build;
  onBuild: (build: Build) => void;
}) {
  const selectId = useId();
  const [compareId, setCompareId] = useState("");
  const other = older.find((o) => o.id === compareId);

  return (
    <FigureColumn data-cy="body-view">
      <BuildSwitch value={build} onChange={onBuild} />
      <BodyDiagram
        placed={placedFor(latest)}
        unit={latest.unit}
        build={build}
        compare={other ? placedFor(other) : undefined}
      />
      {older.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={selectId} className="shrink-0 text-xs font-medium text-fg-muted">
            Compare with
          </label>
          <Select
            id={selectId}
            value={other?.id ?? ""}
            onChange={(e) => setCompareId(e.target.value)}
            className="py-1.5"
            data-cy="measurement-compare"
          >
            <option value="">Nothing</option>
            {older.map((o) => (
              <option key={o.id} value={o.id}>
                {formatDay(o.measuredOn)}
                {o.templateName ? ` · ${o.templateName}` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
      {other ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-5 rounded bg-line-strong" />
            This set
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-5 border-t-2 border-dashed border-fg-subtle" />
            {formatDay(other.measuredOn)}
          </span>
          <span>Labels show the change</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-fg-subtle">A guide only: the shape follows the numbers, not an exact fit.</p>
      )}
    </FigureColumn>
  );
}

export function MeasurementsCard({
  customerId,
  gender,
}: {
  customerId: string;
  /** The customer's recorded gender, which picks the starting figure. */
  gender?: CustomerGender | null;
}) {
  const { can } = useWorkspace();
  const query = useMeasurements(customerId);
  const remove = useDeleteMeasurement(customerId);
  const [recording, setRecording] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // A pick here wins over the customer's gender, so editing the customer still updates the default.
  const [picked, setPicked] = useState<Build | null>(null);
  const build = picked ?? buildFor(gender);

  return (
    <Card
      title="Measurements"
      action={
        can("measurement.record") && (
          <Button
            size="sm"
            icon={<Ruler className="size-4" aria-hidden />}
            onClick={() => setRecording(true)}
            data-cy="record-measurements"
          >
            Record
          </Button>
        )
      }
    >
      <QueryState query={query}>
        {({ data }) => {
          if (!data.length)
            return (
              <EmptyState
                icon={<Ruler className="size-6" aria-hidden />}
                title="No measurements yet"
                message="Record them once and reuse them on every order."
              />
            );
          const shown = showAll ? data : data.slice(0, 1);
          return (
            <div className="divide-y divide-line">
              {shown.map((m, i) => {
                // Only the latest set gets the figure, and only if some of it can be placed on a body.
                const withBody = i === 0 && placedFor(m).length > 0;
                return (
                  <div key={m.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-fg">
                        {i === 0 ? "Latest · " : ""}
                        {formatDay(m.measuredOn)}
                        {m.templateName && <span className="font-normal text-fg-subtle"> · {m.templateName}</span>}
                      </p>
                      {can("measurement.delete") && (
                        <IconButton
                          label="Delete this set"
                          onClick={() => setDeleting(m.id)}
                          data-cy="measurement-delete"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      )}
                    </div>
                    <MeasurementSetView
                      values={m.values}
                      unit={m.unit}
                      notes={m.notes}
                      figure={
                        withBody && <BodyView latest={m} older={data.slice(1)} build={build} onBuild={setPicked} />
                      }
                    />
                  </div>
                );
              })}
              {data.length > 1 && (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-sm text-link hover:bg-subtle"
                  onClick={() => setShowAll(!showAll)}
                  data-cy="measurement-history"
                >
                  {showAll ? "Show latest only" : `Show history (${data.length - 1} older)`}
                </button>
              )}
            </div>
          );
        }}
      </QueryState>
      {recording && (
        <MeasurementForm
          open
          onClose={() => setRecording(false)}
          customerId={customerId}
          previous={query.data?.data[0]}
          build={build}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting, { onSuccess: () => setDeleting(null) })}
        title="Delete these measurements?"
        message="Orders that used them keep their copy."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </Card>
  );
}
