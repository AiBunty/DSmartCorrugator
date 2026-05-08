import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Bot, Building2, FileText, Mail, MessageCircle, Save, Settings2, Sparkles, Users, ShieldCheck, CreditCard } from "lucide-react";
import api from "../lib/api";
import RichHtmlEditor from "../components/RichHtmlEditor";
import { useAuthStore } from "../store/authStore";
import type {
  AiProviderSettings,
  BusinessDefaults,
  CompanyProfile,
  EmailSettings,
  MessageTemplate,
  MessageTemplateChannel,
  SignatureSettings,
  TeamMember,
  Invitation,
  UserRole,
  TemplatePreset,
  UserQuoteTerm,
} from "../types";
import { getAxiosErrorMessage, cn } from "../lib/utils";

function htmlToPlainText(value: string): string {
  if (!value) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function paragraphizeText(value: string): string {
  if (!value.trim()) return "";
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SaveBanner({ isError, isPending, message }: { isError?: boolean; isPending?: boolean; message?: string }) {
  if (isPending) return <span className="text-sm text-muted-foreground">Saving…</span>;
  if (!message) return null;
  return <span className={cn("text-sm", isError ? "text-destructive" : "text-green-600")}>{message}</span>;
}

// ── Business Defaults ─────────────────────────────────────────────────────────

const defaultsSchema = z.object({
  default_markup_pct: z.coerce.number().min(0).max(500),
  default_conversion_cost_per_kg: z.coerce.number().min(0),
  default_gst_pct: z.coerce.number().min(0).max(100),
  default_quantity: z.coerce.number().int().min(1),
  default_validity_days: z.coerce.number().int().min(1),
  quote_number_prefix: z.string().min(1).max(20),
});

type DefaultsForm = z.infer<typeof defaultsSchema>;

function BusinessDefaultsSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "defaults"],
    queryFn: () => api.get<BusinessDefaults>("/settings/defaults").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<DefaultsForm>({
    resolver: zodResolver(defaultsSchema),
  });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (d: DefaultsForm) => api.patch("/settings/defaults", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "defaults"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="Business Defaults"
      description="Core pricing defaults used when a new quote starts."
      icon={<Settings2 className="h-4 w-4" />}
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(
          [
            { id: "default_markup_pct", label: "Default Markup (%)" },
            { id: "default_conversion_cost_per_kg", label: "Conversion Cost (₹/kg)" },
            { id: "default_gst_pct", label: "Default GST (%)" },
            { id: "default_quantity", label: "Default Quantity" },
            { id: "default_validity_days", label: "Quote Validity (days)" },
            { id: "quote_number_prefix", label: "Quote Number Prefix" },
          ] as const
        ).map(({ id, label }) => (
          <div key={id} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              type={id === "quote_number_prefix" ? "text" : "number"}
              {...register(id)}
              disabled={!canEdit}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors[id] && <p className="text-xs text-destructive">{errors[id]?.message}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {canEdit ? (
          <>
            <button
              type="submit"
              disabled={!isDirty || mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
            {mutation.isError && (
              <span className="text-sm text-destructive">{getAxiosErrorMessage(mutation.error)}</span>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Read-only for your role.</span>
        )}
      </div>
      </form>
    </SectionCard>
  );
}

function TeamManagementSection() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | undefined>();
  const [invite, setInvite] = useState({ email: "", role: "salesperson" as UserRole });

  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => api.get<TeamMember[]>("/team/members").then((r) => r.data),
  });

  const invitationsQuery = useQuery({
    queryKey: ["team", "invitations"],
    queryFn: () => api.get<Invitation[]>("/team/invitations").then((r) => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post("/team/invite", invite),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", "invitations"] });
      setInvite((current) => ({ ...current, email: "" }));
      setMessage("Invitation sent");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: UserRole }) =>
      api.patch(`/team/members/${membershipId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", "members"] });
      setMessage("Role updated");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ membershipId, suspend }: { membershipId: string; suspend: boolean }) =>
      api.patch(`/team/members/${membershipId}/${suspend ? "suspend" : "unsuspend"}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", "members"] });
      setMessage("Member status updated");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  return (
    <SectionCard
      title="Team & Users"
      description="Invite users, assign roles, and suspend access without deleting historical quote ownership."
      icon={<Users className="h-4 w-4" />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          <h3 className="font-medium">Current members</h3>
          <div className="overflow-auto rounded-lg border border-border bg-background">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(membersQuery.data ?? []).map((member) => (
                  <tr key={member.membership_id} className="border-b border-border/70 align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{member.display_name || member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={member.role}
                        disabled={member.role === "owner" || roleMutation.isPending}
                        onChange={(event) =>
                          roleMutation.mutate({
                            membershipId: member.membership_id,
                            role: event.target.value as UserRole,
                          })
                        }
                        className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="salesperson">Salesperson</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="owner" disabled>
                          Owner
                        </option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          member.is_suspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        )}
                      >
                        {member.is_suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {member.role !== "owner" ? (
                        <button
                          type="button"
                          onClick={() =>
                            suspendMutation.mutate({
                              membershipId: member.membership_id,
                              suspend: !member.is_suspended,
                            })
                          }
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                        >
                          {member.is_suspended ? "Unsuspend" : "Suspend"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Owner</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!membersQuery.data?.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-muted-foreground">
                      No team members found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          <h3 className="font-medium">Invite member</h3>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={invite.email}
              onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
              placeholder="teammate@company.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <select
              value={invite.role}
              onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value as UserRole }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="salesperson">Salesperson</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            disabled={!invite.email || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Send invite
          </button>

          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <h4 className="text-sm font-semibold">Pending invitations</h4>
            {(invitationsQuery.data ?? []).map((inviteRow) => (
              <div key={inviteRow.id} className="rounded-md border border-border px-3 py-2">
                <div className="text-sm font-medium">{inviteRow.email}</div>
                <div className="text-xs text-muted-foreground">
                  Role: {inviteRow.role} • Expires: {new Date(inviteRow.expires_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {!invitationsQuery.data?.length ? (
              <div className="text-xs text-muted-foreground">No pending invitations.</div>
            ) : null}
          </div>
        </div>
      </div>
      <SaveBanner
        isError={inviteMutation.isError || roleMutation.isError || suspendMutation.isError}
        isPending={inviteMutation.isPending || roleMutation.isPending || suspendMutation.isPending}
        message={message}
      />
    </SectionCard>
  );
}

function BillingPlanSection() {
  const user = useAuthStore((state) => state.user);
  const plan = user?.plan ?? "starter";
  const planCaps: Record<string, string> = {
    starter: "1 team member • up to 2 templates/channel • no automation",
    professional: "10 team members • up to 20 templates/channel • automation enabled",
    enterprise: "Unlimited team and templates • full integrations",
  };

  return (
    <SectionCard
      title="Billing & Plan"
      description="Current plan visibility and major feature gates for this tenant."
      icon={<CreditCard className="h-4 w-4" />}
    >
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold capitalize">{plan}</p>
            <p className="text-sm text-muted-foreground">{planCaps[plan] ?? "Plan capabilities unavailable"}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Role: {user?.role ?? "unknown"}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Billing changes are owner-managed. Contact platform support to upgrade or change tenant subscription.
      </p>
    </SectionCard>
  );
}

// ── Quote Terms ───────────────────────────────────────────────────────────────

const termsSchema = z.object({
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  other_terms: z.string().optional(),
});

type TermsForm = z.infer<typeof termsSchema>;

function QuoteTermsSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "quote-terms"],
    queryFn: () => api.get<UserQuoteTerm>("/settings/quote-terms").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<TermsForm>({
    resolver: zodResolver(termsSchema),
  });

  useEffect(() => {
    if (data) reset({ payment_terms: data.payment_terms ?? "", delivery_terms: data.delivery_terms ?? "", other_terms: data.other_terms ?? "" });
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (d: TermsForm) => api.put("/settings/quote-terms", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "quote-terms"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="Quote Terms"
      description="Default commercial notes copied into each saved quote version."
      icon={<FileText className="h-4 w-4" />}
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {(["payment_terms", "delivery_terms", "other_terms"] as const).map((id) => (
        <div key={id} className="space-y-1">
          <label className="text-sm font-medium capitalize">{id.replace(/_/g, " ")}</label>
          <textarea
            {...register(id)}
            rows={3}
            disabled={!canEdit}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>
      ))}
      <div className="flex items-center gap-3">
        {canEdit ? (
          <>
            <button
              type="submit"
              disabled={!isDirty || mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Read-only for your role.</span>
        )}
      </div>
      </form>
    </SectionCard>
  );
}

function CompanyProfileSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [savedMessage, setSavedMessage] = useState<string | undefined>();
  const [bankDetailsText, setBankDetailsText] = useState("{}");
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "company"],
    queryFn: () => api.get<CompanyProfile>("/settings/company").then((r) => r.data),
  });
  const [form, setForm] = useState<CompanyProfile>({
    id: "",
    tenant_id: "",
    company_name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    gstin: "",
    logo_s3_key: null,
    bank_details: null,
  });

  useEffect(() => {
    if (data) {
      setForm(data);
      setBankDetailsText(JSON.stringify(data.bank_details ?? {}, null, 2));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      let parsedBankDetails: Record<string, string> | null = null;
      try {
        parsedBankDetails = bankDetailsText.trim()
          ? (JSON.parse(bankDetailsText) as Record<string, string>)
          : null;
      } catch {
        throw new Error("Bank details must be valid JSON.");
      }
      return api.patch("/settings/company", {
        ...form,
        bank_details: parsedBankDetails,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "company"] });
      setSavedMessage("Saved");
      setTimeout(() => setSavedMessage(undefined), 2500);
    },
    onError: (error) => setSavedMessage(getAxiosErrorMessage(error)),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="Company Profile"
      description="This snapshot is embedded into quote versions and reused in AI drafts."
      icon={<Building2 className="h-4 w-4" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["company_name", "Company name"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["website", "Website"],
          ["gstin", "GSTIN"],
        ] as const).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              value={(form[key] as string | null) ?? ""}
              disabled={!canEdit}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Address</label>
        <textarea
          rows={4}
          value={form.address ?? ""}
          disabled={!canEdit}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Logo URL or storage key</label>
          <input
            value={form.logo_s3_key ?? ""}
            disabled={!canEdit}
            onChange={(event) => setForm((current) => ({ ...current, logo_s3_key: event.target.value || null }))}
            placeholder="https://... or tenant/logo/path.png"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Logo Preview</label>
          <div className="flex min-h-[76px] items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-2">
            {form.logo_s3_key && /^https?:\/\//i.test(form.logo_s3_key) ? (
              <img src={form.logo_s3_key} alt="Company logo" className="max-h-16 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Set an absolute URL for preview.</span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Bank Details (JSON)</label>
        <textarea
          rows={6}
          value={bankDetailsText}
          disabled={!canEdit}
          onChange={(event) => setBankDetailsText(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-3">
        {canEdit ? (
          <button
            type="button"
            onClick={() => mutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-4 w-4" /> Save profile
          </button>
        ) : null}
        <SaveBanner isError={mutation.isError} isPending={mutation.isPending} message={savedMessage} />
        {!canEdit ? <span className="text-sm text-muted-foreground">Read-only for your role.</span> : null}
      </div>
    </SectionCard>
  );
}

function EmailSettingsSection() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "email"],
    queryFn: () => api.get<EmailSettings>("/settings/email").then((r) => r.data),
  });
  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    use_tls: true,
    from_email: "",
    from_name: "",
  });

  useEffect(() => {
    if (!data) return;
    setForm((current) => ({
      ...current,
      smtp_host: data.smtp_host ?? "",
      smtp_port: data.smtp_port ?? 587,
      smtp_username: data.smtp_username ?? "",
      use_tls: data.use_tls ?? true,
      from_email: data.from_email ?? "",
      from_name: data.from_name ?? "",
    }));
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.put("/settings/email", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "email"] });
      setForm((current) => ({ ...current, smtp_password: "" }));
      setMessage("Saved");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="Email Sending"
      description="SMTP credentials are encrypted server-side and reused for quote emails."
      icon={<Mail className="h-4 w-4" />}
    >
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {data?.is_configured ? "SMTP is configured for this tenant." : "SMTP is not configured yet."}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["smtp_host", "SMTP host", "text"],
          ["smtp_port", "SMTP port", "number"],
          ["smtp_username", "SMTP username", "text"],
          ["smtp_password", "SMTP password", "password"],
          ["from_email", "From email", "email"],
          ["from_name", "From name", "text"],
        ] as const).map(([key, label, type]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              type={type}
              value={String(form[key])}
              onChange={(event) => setForm((current) => ({
                ...current,
                [key]: type === "number" ? Number(event.target.value) : event.target.value,
              }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.use_tls}
          onChange={(event) => setForm((current) => ({ ...current, use_tls: event.target.checked }))}
        />
        Use TLS
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-4 w-4" /> Save email settings
        </button>
        <SaveBanner isError={mutation.isError} isPending={mutation.isPending} message={message} />
      </div>
    </SectionCard>
  );
}

function AiProviderSection() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "ai-provider"],
    queryFn: () => api.get<AiProviderSettings>("/settings/ai-provider").then((r) => r.data),
  });
  const [form, setForm] = useState({
    provider_name: "openai",
    api_key: "",
    model_name: "gpt-4.1-mini",
    is_enabled: true,
  });

  useEffect(() => {
    if (!data) return;
    setForm((current) => ({
      ...current,
      provider_name: data.provider_name,
      model_name: data.model_name,
      is_enabled: data.is_enabled,
    }));
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.put("/settings/ai-provider", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "ai-provider"] });
      setForm((current) => ({ ...current, api_key: "" }));
      setMessage("Saved");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="AI Provider"
      description="Phase 1 is OpenAI-only. The saved key powers quote email and WhatsApp drafting."
      icon={<Bot className="h-4 w-4" />}
    >
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {data?.is_configured ? "OpenAI is configured for this tenant." : "OpenAI key has not been saved yet."}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Provider</label>
          <input value="OpenAI" disabled className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Model</label>
          <input
            value={form.model_name}
            onChange={(event) => setForm((current) => ({ ...current, model_name: event.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">API key</label>
        <input
          type="password"
          value={form.api_key}
          onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
          placeholder="sk-..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.is_enabled}
          onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))}
        />
        Enable AI drafting
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!form.api_key && !data?.is_configured}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" /> Save AI provider
        </button>
        <SaveBanner isError={mutation.isError} isPending={mutation.isPending} message={message} />
      </div>
    </SectionCard>
  );
}

function SignatureSettingsSection() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "signatures"],
    queryFn: () => api.get<SignatureSettings>("/settings/signatures").then((r) => r.data),
  });
  const [form, setForm] = useState({
    email_signature_html: "",
    whatsapp_signature_text: "",
    email_signature_label: "Sales Signature",
    whatsapp_signature_label: "WhatsApp Sign-off",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      email_signature_html: data.email_signature_html ?? "",
      whatsapp_signature_text: data.whatsapp_signature_text ?? "",
      email_signature_label: data.email_signature_label ?? "Sales Signature",
      whatsapp_signature_label: data.whatsapp_signature_label ?? "WhatsApp Sign-off",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.put("/settings/signatures", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "signatures"] });
      setMessage("Saved");
      setTimeout(() => setMessage(undefined), 2500);
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SectionCard
      title="Channel Signatures"
      description="Maintain separate reusable endings for quote emails and WhatsApp drafts."
      icon={<FileText className="h-4 w-4" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email signature label</label>
            <input
              value={form.email_signature_label}
              onChange={(event) => setForm((current) => ({ ...current, email_signature_label: event.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <RichHtmlEditor
            value={form.email_signature_html}
            onChange={(next) => setForm((current) => ({ ...current, email_signature_html: next }))}
            placeholder="Create an HTML signature with name, title, phone, website, color, and formatting."
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">WhatsApp signature label</label>
            <input
              value={form.whatsapp_signature_label}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp_signature_label: event.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <textarea
            rows={12}
            value={form.whatsapp_signature_text}
            onChange={(event) => setForm((current) => ({ ...current, whatsapp_signature_text: event.target.value }))}
            placeholder="Regards,&#10;Ventura Packagers&#10;+91 ..."
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
            {form.whatsapp_signature_text || "WhatsApp signature preview"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-4 w-4" /> Save signatures
        </button>
        <SaveBanner isError={mutation.isError} isPending={mutation.isPending} message={message} />
      </div>
    </SectionCard>
  );
}

function TemplateStudioSection({ channel }: { channel: MessageTemplateChannel }) {
  const qc = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("new");
  const [message, setMessage] = useState<string | undefined>();
  const [draft, setDraft] = useState({
    name: "",
    subject: "",
    body_html: "",
    is_default: false,
    source_preset_key: "" as string | null,
  });

  const templatesQuery = useQuery({
    queryKey: ["settings", "templates", channel],
    queryFn: () => api.get<MessageTemplate[]>(`/settings/templates?channel=${channel}`).then((r) => r.data),
  });
  const presetsQuery = useQuery({
    queryKey: ["settings", "template-presets", channel],
    queryFn: () => api.get<TemplatePreset[]>(`/settings/templates/presets?channel=${channel}`).then((r) => r.data),
  });

  const templates = templatesQuery.data ?? [];
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      setDraft({
        name: selectedTemplate.name,
        subject: selectedTemplate.subject ?? "",
        body_html: selectedTemplate.body_html ?? paragraphizeText(selectedTemplate.body_text ?? ""),
        is_default: selectedTemplate.is_default,
        source_preset_key: selectedTemplate.source_preset_key,
      });
      return;
    }
    if (selectedTemplateId === "new") {
      setDraft({ name: "", subject: "", body_html: "", is_default: false, source_preset_key: null });
    }
  }, [selectedTemplate, selectedTemplateId]);

  const createMutation = useMutation({
    mutationFn: () => api.post<MessageTemplate>("/settings/templates", {
      name: draft.name,
      channel,
      subject: channel === "email" ? draft.subject : null,
      body_html: draft.body_html,
      body_text: htmlToPlainText(draft.body_html),
      is_default: draft.is_default,
      source_preset_key: draft.source_preset_key,
    }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["settings", "templates", channel] });
      setSelectedTemplateId(response.data.id);
      setMessage("Template saved");
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch<MessageTemplate>(`/settings/templates/${selectedTemplateId}`, {
      name: draft.name,
      channel,
      subject: channel === "email" ? draft.subject : null,
      body_html: draft.body_html,
      body_text: htmlToPlainText(draft.body_html),
      is_default: draft.is_default,
      source_preset_key: draft.source_preset_key,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "templates", channel] });
      setMessage("Template updated");
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/settings/templates/${selectedTemplateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "templates", channel] });
      setSelectedTemplateId("new");
      setMessage("Template deleted");
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  const cloneMutation = useMutation({
    mutationFn: (preset: TemplatePreset) => api.post<MessageTemplate>("/settings/templates/clone-preset", {
      preset_key: preset.key,
      channel,
      name: preset.name,
    }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["settings", "templates", channel] });
      setSelectedTemplateId(response.data.id);
      setMessage("Preset cloned to tenant template");
    },
    onError: (error) => setMessage(getAxiosErrorMessage(error)),
  });

  return (
    <SectionCard
      title={channel === "email" ? "Email Templates" : "WhatsApp Templates"}
      description={channel === "email"
        ? "Manage rich HTML quote mails and clone one of the 15 base presets."
        : "Manage styled WhatsApp drafts with a send-safe plain-text preview and clone one of the 15 base presets."}
      icon={channel === "email" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Saved templates</h3>
              <button
                type="button"
                onClick={() => setSelectedTemplateId("new")}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                New
              </button>
            </div>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    selectedTemplateId === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {template.source_preset_key ? `Preset: ${template.source_preset_key}` : "Custom template"}
                  </div>
                </button>
              ))}
              {!templates.length && <p className="text-sm text-muted-foreground">No tenant templates yet.</p>}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <h3 className="mb-3 font-medium">System presets</h3>
            <div className="space-y-2">
              {(presetsQuery.data ?? []).map((preset) => (
                <div key={preset.key} className="rounded-lg border border-border bg-background px-3 py-2">
                  <div className="text-sm font-medium">{preset.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{preset.key}</div>
                  <button
                    type="button"
                    onClick={() => cloneMutation.mutate(preset)}
                    className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                  >
                    Clone preset
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Template name</label>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {channel === "email" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Subject</label>
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Quote {{quote.quote_no}} from {{company.company_name}}"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(event) => setDraft((current) => ({ ...current, is_default: event.target.checked }))}
            />
            Mark as default {channel} template
          </label>

          <RichHtmlEditor
            value={draft.body_html}
            onChange={(next) => setDraft((current) => ({ ...current, body_html: next }))}
            placeholder={channel === "email"
              ? "Draft a polished email with tables, bold highlights, colors, and merge variables like {{quote.quote_no}}."
              : "Draft a styled WhatsApp message. The panel below shows the send-safe plain-text output."}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold">Variable tokens detected</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set((draft.subject + " " + draft.body_html).match(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g) ?? [])).map((token) => (
                  <span key={token} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {token}
                  </span>
                ))}
                {!((draft.subject + " " + draft.body_html).match(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g) ?? []).length && (
                  <span className="text-xs text-muted-foreground">No merge variables detected.</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold">
                {channel === "email" ? "Plain-text fallback" : "Send-safe WhatsApp output"}
              </h3>
              <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm">
                {htmlToPlainText(draft.body_html) || "Preview will appear here."}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => (selectedTemplate ? updateMutation.mutate() : createMutation.mutate())}
              disabled={!draft.name || !draft.body_html}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {selectedTemplate ? "Update template" : "Save template"}
            </button>
            {selectedTemplate ? (
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Delete template
              </button>
            ) : null}
            <SaveBanner
              isError={createMutation.isError || updateMutation.isError || deleteMutation.isError || cloneMutation.isError}
              isPending={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || cloneMutation.isPending}
              message={message}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function OperationsSettingsSection() {
  const modules = [
    { name: "Client Pricing Rules", status: "Planned", note: "API endpoints not available yet" },
    { name: "Follow-up Automation", status: "Planned", note: "Requires scheduler and event hooks" },
    { name: "Tally Integration", status: "Planned", note: "Connector setup pending" },
    { name: "Audit Trail Browser", status: "Planned", note: "Read API not exposed yet" },
    { name: "Bulk Import Jobs", status: "In Progress", note: "CSV import added on Quote page" },
  ];

  return (
    <SectionCard
      title="Operations Modules"
      description="Visibility for settings modules from the master plan and their current implementation status."
      icon={<Settings2 className="h-4 w-4" />}
    >
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        {modules.map((module) => (
          <div key={module.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div>
              <p className="text-sm font-medium">{module.name}</p>
              <p className="text-xs text-muted-foreground">{module.note}</p>
            </div>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              module.status === "In Progress" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
            )}>
              {module.status}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "defaults", label: "Business Defaults", adminOnly: false },
  { id: "terms", label: "Quote Terms", adminOnly: false },
  { id: "company", label: "Company", adminOnly: false },
  { id: "email", label: "Email", adminOnly: true },
  { id: "ai", label: "AI Provider", adminOnly: false },
  { id: "signatures", label: "Signatures", adminOnly: true },
  { id: "email-templates", label: "Email Templates", adminOnly: true },
  { id: "whatsapp-templates", label: "WhatsApp Templates", adminOnly: true },
  { id: "operations", label: "Operations", adminOnly: true },
  { id: "team", label: "Team & Users", adminOnly: true },
  { id: "billing", label: "Billing & Plan", adminOnly: true },
];

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const canManageAdminSettings = user?.role === "owner" || user?.role === "admin";
  const canViewTeam = user?.role === "owner" || user?.role === "admin";
  const canViewBilling = user?.role === "owner";
  const visibleTabs = TABS.filter((tabItem) => !tabItem.adminOnly || canManageAdminSettings);
  const [tab, setTab] = useState("defaults");

  useEffect(() => {
    if (!visibleTabs.some((tabItem) => tabItem.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "defaults");
    }
  }, [tab, visibleTabs]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map(({ id, label }) => (
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

      <div className="rounded-lg border border-border bg-card p-5">
        {tab === "defaults" && <BusinessDefaultsSection canEdit={canManageAdminSettings} />}
        {tab === "terms" && <QuoteTermsSection canEdit={canManageAdminSettings} />}
        {tab === "company" && <CompanyProfileSection canEdit={canManageAdminSettings} />}
        {canManageAdminSettings && tab === "email" && <EmailSettingsSection />}
        {canManageAdminSettings && tab === "ai" && <AiProviderSection />}
        {canManageAdminSettings && tab === "signatures" && <SignatureSettingsSection />}
        {canManageAdminSettings && tab === "email-templates" && <TemplateStudioSection channel="email" />}
        {canManageAdminSettings && tab === "whatsapp-templates" && <TemplateStudioSection channel="whatsapp" />}
        {canManageAdminSettings && tab === "operations" && <OperationsSettingsSection />}
        {canViewTeam && tab === "team" && <TeamManagementSection />}
        {canViewBilling && tab === "billing" && <BillingPlanSection />}
      </div>
    </div>
  );
}
