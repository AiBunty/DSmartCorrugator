import { useQuery } from "@tanstack/react-query";
import { FileText, Package, TrendingUp, Users } from "lucide-react";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { cn } from "../lib/utils";
import type { PaginatedResponse, Quote } from "../types";

interface StatCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: quotesData } = useQuery({
    queryKey: ["quotes", "dashboard"],
    queryFn: () =>
      api.get<PaginatedResponse<Quote>>("/quotes/", { params: { page: 1, page_size: 5 } }).then((r) => r.data),
  });

  const totalQuotes = quotesData?.total ?? 0;
  const recentQuotes = quotesData?.items ?? [];

  const stats: StatCard[] = [
    { label: "Total Quotes", value: String(totalQuotes), icon: FileText, color: "text-blue-500" },
    { label: "Active Parties", value: "—", icon: Users, color: "text-green-500" },
    { label: "This Month", value: "—", icon: TrendingUp, color: "text-purple-500" },
    { label: "Paper Grades", value: "—", icon: Package, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.display_name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's what's happening with your quotes today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Quotes */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Recent Quotes</h2>
        </div>
        {recentQuotes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No quotes yet. Create your first quote to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentQuotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{q.quote_no}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.party?.person_name ?? q.party?.company_name ?? "No party"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full capitalize font-medium",
                    q.status === "accepted" && "bg-green-100 text-green-700",
                    q.status === "draft" && "bg-gray-100 text-gray-600",
                    q.status === "sent" && "bg-blue-100 text-blue-700",
                    q.status === "rejected" && "bg-red-100 text-red-700",
                    q.status === "expired" && "bg-yellow-100 text-yellow-700"
                  )}
                >
                  {q.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
