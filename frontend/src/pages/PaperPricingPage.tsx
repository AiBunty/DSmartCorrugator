import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import api from "../lib/api";
import type { PaperBfPrice, ShadePremium, FluteSetting } from "../types";
import { cn } from "../lib/utils";

function EditableCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = parseFloat(draft);
    if (isNaN(n)) { setEditing(false); setDraft(String(value)); return; }
    setSaving(true);
    try {
      await onSave(n);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 group">
        <span>{value.toFixed(2)}</span>
        <button
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setDraft(String(value)); } }}
        className="w-24 rounded border border-input px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => { setEditing(false); setDraft(String(value)); }} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PaperPricingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"bf" | "shade" | "flute">("bf");

  const { data: bfPrices = [], isLoading: loadingBf } = useQuery({
    queryKey: ["paper", "bf-prices"],
    queryFn: () => api.get<PaperBfPrice[]>("/paper/bf-prices").then((r) => r.data),
  });

  const { data: shades = [], isLoading: loadingShades } = useQuery({
    queryKey: ["paper", "shade-premiums"],
    queryFn: () => api.get<ShadePremium[]>("/paper/shade-premiums").then((r) => r.data),
  });

  const { data: flutes = [], isLoading: loadingFlutes } = useQuery({
    queryKey: ["paper", "flute-settings"],
    queryFn: () => api.get<FluteSetting[]>("/paper/flute-settings").then((r) => r.data),
  });

  const updateBf = async (bf_value: number, base_price: number) => {
    await api.put(`/paper/bf-prices/${bf_value}`, { base_price });
    qc.invalidateQueries({ queryKey: ["paper", "bf-prices"] });
  };

  const updateShade = async (shade_code: string, premium: number) => {
    await api.patch(`/paper/shade-premiums/${shade_code}`, { premium });
    qc.invalidateQueries({ queryKey: ["paper", "shade-premiums"] });
  };

  const updateFlute = async (flute_type: string, data: { fluting_factor?: number; flute_height_mm?: number }) => {
    await api.patch(`/paper/flute-settings/${flute_type}`, data);
    qc.invalidateQueries({ queryKey: ["paper", "flute-settings"] });
  };

  const TABS = [
    { id: "bf" as const, label: "BF Prices" },
    { id: "shade" as const, label: "Shade Premiums" },
    { id: "flute" as const, label: "Flute Settings" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Paper Pricing</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BF Prices */}
      {tab === "bf" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingBf ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">BF Value</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Base Price (₹/kg)</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bfPrices.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.bf_value}</td>
                    <td className="px-4 py-3">
                      <EditableCell
                        value={row.base_price}
                        onSave={(v) => updateBf(row.bf_value, v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", row.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Shade Premiums */}
      {tab === "shade" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingShades ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Shade Code</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Premium (₹/kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shades.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-mono font-medium">{row.shade_code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.shade_label ?? "—"}</td>
                    <td className="px-4 py-3">
                      <EditableCell
                        value={row.premium}
                        onSave={(v) => updateShade(row.shade_code, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Flute Settings */}
      {tab === "flute" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingFlutes ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Flute Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fluting Factor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Height (mm)</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flutes.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.flute_type}</td>
                    <td className="px-4 py-3">
                      <EditableCell
                        value={row.fluting_factor}
                        onSave={(v) => updateFlute(row.flute_type, { fluting_factor: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <EditableCell
                        value={row.flute_height_mm}
                        onSave={(v) => updateFlute(row.flute_type, { flute_height_mm: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", row.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
