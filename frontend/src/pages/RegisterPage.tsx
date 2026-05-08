import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { AuthUser } from "../types";
import { getAxiosErrorMessage } from "../lib/utils";

const schema = z
  .object({
    company_name: z.string().min(2, "Company name must be at least 2 characters"),
    display_name: z.string().min(2, "Your name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    setLoading(true);
    try {
      const resp = await api.post<AuthUser>("/auth/register", {
        company_name: data.company_name,
        display_name: data.display_name,
        email: data.email,
        password: data.password,
      });
      setUser(resp.data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(getAxiosErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Start your 14-day free trial. No card required.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {(
            [
              { id: "company_name", label: "Company name", type: "text", placeholder: "ACME Packaging Ltd." },
              { id: "display_name", label: "Your name", type: "text", placeholder: "John Doe" },
              { id: "email", label: "Email", type: "email", placeholder: "you@company.com" },
              { id: "password", label: "Password", type: "password", placeholder: "Min. 8 characters" },
              { id: "confirm_password", label: "Confirm password", type: "password", placeholder: "Re-enter password" },
            ] as const
          ).map(({ id, label, type, placeholder }) => (
            <div key={id} className="space-y-1">
              <label className="text-sm font-medium" htmlFor={id}>
                {label}
              </label>
              <input
                id={id}
                type={type}
                {...register(id)}
                placeholder={placeholder}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors[id] && (
                <p className="text-xs text-destructive">{errors[id]?.message}</p>
              )}
            </div>
          ))}

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
