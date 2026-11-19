import { CheckCircle2, ChevronRight, Compass, RotateCcw } from "lucide-react";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { Button } from "../shared/Button";
import { Card } from "../shared/Display";

/** The getting-started guide, kept here so it can be followed again at any time. */
export function GuideSettings() {
  const guide = useOnboarding();
  if (guide.steps.length === 0) return null;
  const doneCount = guide.steps.filter((s) => guide.completed.has(s.id)).length;

  return (
    <Card
      title="Getting started guide"
      action={
        <Button
          size="sm"
          variant="secondary"
          icon={doneCount ? <RotateCcw className="size-4" aria-hidden /> : <Compass className="size-4" aria-hidden />}
          onClick={guide.restart}
          data-cy="guide-restart"
        >
          {doneCount ? "Start again" : "Start the guide"}
        </Button>
      }
    >
      <p className="px-4 pt-3 text-sm text-fg-muted">
        A walk-through of setting up your shop, with hints on each page. {doneCount} of {guide.steps.length} done.
      </p>
      <ol className="mt-2 divide-y divide-line">
        {guide.steps.map((step, i) => {
          const done = guide.completed.has(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => guide.open(step.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle"
                data-cy={`guide-step-${step.id}`}
              >
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success-fg" aria-label="Done" />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-fg-muted tabular-nums">
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{step.title}</span>
                  <span className="block text-xs text-fg-muted">{step.summary}</span>
                </span>
                <span className="hidden text-xs text-link sm:block">Show me</span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
