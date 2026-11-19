import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TabItem {
  id: string;
  label: string;
}

const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Names the group for screen readers, e.g. "Settings sections". */
  label: string;
  /** Pairs each tab with its panel; unique per page. */
  idPrefix: string;
  /** Prefix for the `data-cy` of each tab: `<prefix>-<id>`. */
  dataCy?: string;
}

/**
 * A row of tabs. Arrow keys, Home and End move between them; on a phone the row scrolls sideways inside itself
 * rather than widening the page. Pair each tab with a <TabPanel> that has the same `idPrefix` and `id`.
 */
export function Tabs({ tabs, value, onChange, label, idPrefix, dataCy = "tab" }: TabsProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current.get(tabs[next].id)?.focus();
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab, index) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) refs.current.set(tab.id, node);
                else refs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId(idPrefix, tab.id)}
              aria-selected={active}
              aria-controls={panelId(idPrefix, tab.id)}
              // Only the selected tab is in the tab order; the arrow keys reach the rest.
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "border-brand text-link" : "border-transparent text-fg-muted hover:text-fg",
              )}
              data-cy={`${dataCy}-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The content of one tab. Inactive panels stay mounted but hidden, so what someone has typed in a form is still
 * there when they come back to the tab.
 */
export function TabPanel({
  idPrefix,
  id,
  active,
  children,
}: {
  idPrefix: string;
  id: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} hidden={!active}>
      {children}
    </div>
  );
}
