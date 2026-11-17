import { Ruler, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteMeasurement, useMeasurements } from "../../hooks/useCustomers";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatDay } from "../../utils/formatDate";
import { Button, IconButton } from "../shared/Button";
import { Card } from "../shared/Display";
import { ConfirmDialog } from "../shared/Modal";
import { EmptyState, QueryState } from "../shared/States";
import { MeasurementForm } from "./MeasurementForm";

export function MeasurementsCard({ customerId }: { customerId: string }) {
  const { can } = useWorkspace();
  const query = useMeasurements(customerId);
  const remove = useDeleteMeasurement(customerId);
  const [recording, setRecording] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
              {shown.map((m, i) => (
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
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {m.values.map((v) => (
                      <div
                        key={v.name}
                        className="flex justify-between gap-2 border-b border-dashed border-line py-1 text-sm"
                      >
                        <dt className="text-fg-muted">{v.name}</dt>
                        <dd className="font-medium text-fg tabular-nums">
                          {v.value} {m.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {m.notes && <p className="mt-2 text-sm text-fg-muted">{m.notes}</p>}
                </div>
              ))}
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
