import { Eye, Globe, Palette, Plus, Search, Share2, Star } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DesignModal } from "../../components/designs/DesignModal";
import { ShowDesignsDialog } from "../../components/designs/ShowDesignsDialog";
import { VisibilityBanner } from "../../components/designs/VisibilityBanner";
import { Button } from "../../components/shared/Button";
import { FilterChips, PageHeader, Pagination } from "../../components/shared/Display";
import { EmptyState, QueryState } from "../../components/shared/States";
import { useDebounce } from "../../hooks/useDebounce";
import { useSharePage } from "../../hooks/useSharePage";
import { useDesignCategories, useDesigns } from "../../hooks/useTeam";
import { useWorkspace } from "../../hooks/useWorkspace";
import { formatPriceRange } from "../../utils/money";
import { shopUrl } from "../../utils/shopPath";

export default function DesignsPage() {
  const { can, business } = useWorkspace();
  const { share } = useSharePage();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  // `?open=<id>` (from the dashboard's "Add a photo") lands straight on that design.
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(() => params.get("open"));
  // The helper that gets designs seen: for all of them, or for the ones named.
  const [helping, setHelping] = useState<{ only?: string[] } | null>(null);
  const closeDesign = () => {
    setOpen(null);
    if (params.has("open")) setParams({}, { replace: true });
  };
  const search = useDebounce(term.trim(), 300);
  const categories = useDesignCategories();
  const query = useDesigns({
    search: search || undefined,
    favourite: filter === "favourites" || undefined,
    category: filter.startsWith("cat:") ? filter.slice(4) : undefined,
    page,
    limit: 24,
  });

  return (
    <>
      <PageHeader
        title="Designs"
        subtitle="Your catalogue of styles, to show customers and attach to orders."
        actions={
          <>
            {business.pageEnabled && business.slug ? (
              <Button
                variant="secondary"
                icon={<Share2 className="size-4" aria-hidden />}
                onClick={() => void share(shopUrl(business.slug as string), business.name)}
                data-cy="design-share-page"
              >
                Share my page
              </Button>
            ) : (
              can("business.update") && (
                <Button
                  variant="secondary"
                  icon={<Globe className="size-4" aria-hidden />}
                  onClick={() => setHelping({})}
                  data-cy="design-publish"
                >
                  Publish my page
                </Button>
              )
            )}
            {can("design.manage") && (
              <Button
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => setOpen("new")}
                data-cy="design-new"
              >
                New design
              </Button>
            )}
          </>
        }
      />
      <VisibilityBanner onShow={() => setHelping({})} onAddPhoto={setOpen} />
      <div className="mb-4 space-y-3">
        <div className="relative sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            className="control pl-9"
            placeholder="Search designs"
            aria-label="Search designs"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            data-cy="designs-search"
          />
        </div>
        <FilterChips
          label="Show"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "favourites", label: "Favourites" },
            ...(categories.data ?? []).map((c) => ({ value: `cat:${c}`, label: c })),
          ]}
        />
      </div>
      <QueryState query={query} loadingLabel="Loading designs">
        {({ data, meta }) =>
          data.length ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {data.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(d.id)}
                      className="block w-full overflow-hidden rounded-xl border border-line bg-surface text-left hover:border-line-strong"
                      data-cy="design-card"
                    >
                      <div className="relative aspect-[3/4] bg-subtle">
                        {d.coverUrl ? (
                          <img src={d.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <Palette
                            className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-fg-subtle"
                            aria-hidden
                          />
                        )}
                        <span className="absolute top-2 right-2 flex gap-1">
                          {d.isFavourite && (
                            <span className="rounded-full bg-black/50 p-1 text-white" title="Favourite">
                              <Star className="size-3.5 fill-current" aria-label="Favourite" />
                            </span>
                          )}
                          {d.visibility === "customers" && (
                            <span className="rounded-full bg-black/50 p-1 text-white" title="Customers can see this">
                              <Eye className="size-3.5" aria-label="Shown to customers" />
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="px-3 py-2">
                        <p className="truncate text-sm font-medium text-fg">{d.name}</p>
                        <p className="truncate text-xs text-fg-subtle">{d.category ?? "No category"}</p>
                        {formatPriceRange(d.priceMin, d.priceMax, business.currency) && (
                          <p className="truncate text-xs font-medium text-fg-muted">
                            {formatPriceRange(d.priceMin, d.priceMax, business.currency)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPage={setPage} />
            </>
          ) : (
            <EmptyState
              icon={<Palette className="size-6" aria-hidden />}
              title={search || filter !== "all" ? "No designs match" : "No designs yet"}
              message="Add photos of styles you make, with a price range. We'll help you show them to people."
            />
          )
        }
      </QueryState>
      {open && (
        <DesignModal
          designId={open}
          onClose={closeDesign}
          onHelp={(id) => {
            closeDesign();
            setHelping({ only: [id] });
          }}
        />
      )}
      {helping && <ShowDesignsDialog only={helping.only} onClose={() => setHelping(null)} />}
    </>
  );
}
