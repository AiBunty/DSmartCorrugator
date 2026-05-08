import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import type { QuoteListItem, QuoteStatus } from "../types";
import { formatCurrency, formatDate, cn, getAxiosErrorMessage } from "../lib/utils";

const STATUS_OPTIONS: Array<QuoteStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "archived",
];

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function toDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

type ReportQuoteRow = QuoteListItem & {
  items_count: number;
  grand_total: number;
};

type ReportResponse = {
  data: ReportQuoteRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");

  const reportsKey = ["reports", "quotes", status, search, startDate, endDate, page] as const;

  const quotesQuery = useQuery({
    queryKey: reportsKey,
    queryFn: () =>
      api
        .get<ReportResponse>("/quotes/reports", {
          params: {
            page,
            page_size: 25,
            status,
            search,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          },
        })
        .then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ quoteId, nextStatus }: { quoteId: string; nextStatus: QuoteStatus }) =>
      api.patch(`/quotes/${quoteId}/status`, { status: nextStatus }),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: reportsKey });
    },
    onError: (err) => {
      setActionError(getAxiosErrorMessage(err, "Unable to update quote status"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (quoteId: string) => api.delete(`/quotes/${quoteId}`),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: reportsKey });
    },
    onError: (err) => {
      setActionError(getAxiosErrorMessage(err, "Unable to delete quote"));
    },
  });

  const rows = useMemo(() => {
    return quotesQuery.data?.data ?? [];
  }, [quotesQuery.data]);

  const partyWise = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const row of rows) {
      const key = row.company_name ?? row.party_name ?? "Unknown";
      grouped[key] = (grouped[key] ?? 0) + 1;
    }
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [rows]);

  const dateWise = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const row of rows) {
      const key = toDateOnly(row.created_at);
      grouped[key] = (grouped[key] ?? 0) + 1;
    }
    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7);
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Party-wise and date-wise quote reporting with lifecycle actions.</p>
        </div>
      </div>

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      <section className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="text-sm xl:col-span-2">
          Search
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Quote no, party, company"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as QuoteStatus | "all");
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Start Date
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm">
          End Date
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Party-wise Quotes</h2>
          {partyWise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for selected filters.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {partyWise.map(([party, count]) => (
                <div key={party} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="truncate pr-2">{party}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Date-wise Quotes (last 7 dates)</h2>
          {dateWise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for selected filters.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {dateWise.map(([date, count]) => (
                <div key={date} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span>{date}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Filtered Quotes</h2>
          <span className="text-xs text-muted-foreground">{quotesQuery.data?.total ?? 0} result(s)</span>
        </div>

        {quotesQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading reports...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No quotes found for these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Quote No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Party</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Items</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-accent/30 transition-colors">
                  <td
                    className="px-4 py-3 font-medium cursor-pointer"
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    {q.quote_no}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{q.company_name ?? q.party_name ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{q.items_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(q.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLES[q.status])}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(q.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => navigate(`/quotes/${q.id}`)}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        View
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ quoteId: q.id, nextStatus: "sent" })}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        Mark Sent
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ quoteId: q.id, nextStatus: "accepted" })}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ quoteId: q.id, nextStatus: "rejected" })}
                        className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete quote ${q.quote_no}?`)) {
                            deleteMutation.mutate(q.id);
                          }
                        }}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {quotesQuery.data?.page ?? page} of {quotesQuery.data?.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={Boolean(quotesQuery.data && page >= quotesQuery.data.totalPages)}
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
