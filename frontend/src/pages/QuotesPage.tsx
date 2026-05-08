import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import type { QuoteListItem, QuoteStatus } from "../types";
import { formatDate, cn } from "../lib/utils";

const STATUS_FILTERS: { label: string; value: QuoteStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter, page],
    queryFn: () =>
      api
        .get<QuoteListItem[]>("/quotes/", {
          params: {
            page,
            page_size: 20,
            status: statusFilter === "all" ? undefined : statusFilter,
          },
        })
        .then((r) => r.data),
  });

  const handleCreateQuote = async () => {
    const resp = await api.post<{ id: string; quote_no: string }>("/quotes/", {});
    navigate(`/quotes/${resp.data.id}`);
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-5xl text-muted-foreground/30">📄</div>
      <p className="text-base font-medium text-muted-foreground">No quotes found</p>
      <p className="mt-1 text-sm text-muted-foreground">Start by creating your first quote.</p>
      <button
        onClick={handleCreateQuote}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Create Quote
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <button
          onClick={handleCreateQuote}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Quote</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => { setStatusFilter(value); setPage(1); }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !data?.length ? (
        emptyState
      ) : (
        <>
          {/* ── Desktop table (lg+) ── */}
          <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="sticky left-0 bg-muted/30 px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Quote No</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Party</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Created</th>
                    <th className="sticky right-0 bg-muted/30 px-4 py-3 text-center font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/quotes/${q.id}`)}
                    >
                      <td className="sticky left-0 bg-card px-4 py-3 font-medium font-mono">{q.quote_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {q.company_name ?? q.party_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[q.status])}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(q.created_at)}</td>
                      <td className="sticky right-0 bg-card px-4 py-3 text-center">
                        <ChevronRight className="inline-block h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile card list (xs–md) ── */}
          <div className="lg:hidden space-y-3">
            {data.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => navigate(`/quotes/${q.id}`)}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/30 active:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium font-mono text-sm">{q.quote_no}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize flex-shrink-0", STATUS_STYLES[q.status])}>
                    {q.status}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {q.company_name ?? q.party_name ?? "No party assigned"}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(q.created_at)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {(data?.length ?? 0) > 0 && (
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <button
            disabled={(data?.length ?? 0) < 20}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

