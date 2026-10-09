"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import styles from "@/components/auth/signin.module.css";
import { ArrowRight } from "@/components/landing/icons";
import { FullPageSpinner } from "@/components/layout/RequireAuth";
import { errorMessage } from "@/lib/api/client";
import { safeNextPath, useAuth } from "@/lib/auth";
import { EXTERNAL_LINKS } from "@/lib/routes";

const DEMO = { account_id: "123456789012", username: "demo", password: "Route53Demo!" };
const REMEMBERED_ACCOUNT_KEY = "r53-remembered-account";

type Step = "user-type" | "iam";
type UserType = "root" | "iam";
type Field = "account_id" | "email" | "username" | "password";

function readRememberedAccount(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_ACCOUNT_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberAccount(accountId: string | null): void {
  try {
    if (accountId) window.localStorage.setItem(REMEMBERED_ACCOUNT_KEY, accountId);
    else window.localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
  } catch {
    // Storage unavailable: the account just isn't remembered.
  }
}

/**
 * Two-step sign-in like the AWS console: choose the user type and account,
 * then enter the IAM user name and password. Only the demo IAM user exists.
 */
export function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [step, setStep] = useState<Step>("user-type");
  const [userType, setUserType] = useState<UserType>("iam");
  const [accountId, setAccountId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [notSureOpen, setNotSureOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Which control receives focus when the IAM step mounts (autoFocus, not a timer, so typing isn't redirected).
  const [focusTarget, setFocusTarget] = useState<"username" | "sign-in">("username");

  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  useEffect(() => {
    const remembered = readRememberedAccount();
    if (remembered) {
      /* eslint-disable react-hooks/set-state-in-effect -- read browser storage once after mount */
      setAccountId(remembered);
      setRemember(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  const clearMessages = () => {
    setErrors({});
    setAlert(null);
  };

  const goToIamStep = (focus: "username" | "sign-in" = "username") => {
    setFocusTarget(focus);
    setStep("iam");
    clearMessages();
  };

  const submitUserType = (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (userType === "root") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setErrors({ email: "Enter a valid email address." });
        return;
      }
      setAlert({
        title: "Root user sign-in isn't available",
        message: "This demo has one IAM user. Choose IAM user and use the demo credentials.",
      });
      return;
    }
    if (!accountId.trim()) {
      setErrors({ account_id: "Enter your account ID or account alias." });
      return;
    }
    goToIamStep();
  };

  const useDemoCredentials = () => {
    setUserType("iam");
    setAccountId(DEMO.account_id);
    setUsername(DEMO.username);
    setPassword(DEMO.password);
    goToIamStep("sign-in");
  };

  const submitSignIn = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    const nextErrors: Partial<Record<Field, string>> = {};
    if (!accountId.trim()) nextErrors.account_id = "Enter your account ID or account alias.";
    if (!username.trim()) nextErrors.username = "Enter your IAM username.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ account_id: accountId.trim(), username: username.trim(), password });
      rememberAccount(remember ? accountId.trim() : null);
      router.replace(nextPath);
    } catch (error) {
      setAlert({ title: "There was a problem", message: errorMessage(error) });
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") return <FullPageSpinner label="Loading" />;

  const fieldError = (field: Field) =>
    errors[field] ? (
      <span className={styles.fieldError} id={`${field}-error`}>
        {errors[field]}
      </span>
    ) : null;

  const inputClass = (field: Field) => `${styles.input} ${errors[field] ? styles.inputInvalid : ""}`;

  return (
    <main className={styles.page}>
      <nav className={styles.topLinks} aria-label="Links">
        <Link href="/">Route 53 Clone home</Link>
        <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </nav>

      <Link href="/" className={styles.brand} aria-label="Route 53 Clone home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" />
        <span>Route 53 Clone</span>
      </Link>

      <div className={styles.content}>
        <div className={styles.column}>
          <div className={styles.card}>
            {alert && (
              <div className={styles.alert} role="alert">
                <strong>{alert.title}</strong>
                {alert.message}
              </div>
            )}

            {step === "user-type" ? (
              <form onSubmit={submitUserType} noValidate>
                <h1>Sign In</h1>
                <p className={styles.intro}>Access your account by user type.</p>
                <p className={styles.userTypeLabel} id="user-type-label">
                  User type{" "}
                  <button
                    type="button"
                    className={styles.notSure}
                    aria-expanded={notSureOpen}
                    onClick={() => setNotSureOpen((open) => !open)}
                  >
                    (not sure?)
                  </button>
                  {notSureOpen && (
                    <span className={styles.popover} role="note">
                      <p>
                        <strong>Root user:</strong> the account owner, who signs in with an email address. Not available
                        in this demo.
                      </p>
                      <p>
                        <strong>IAM user:</strong> a user within an account. Use the demo IAM user to sign in.
                      </p>
                    </span>
                  )}
                </p>
                <fieldset className={styles.tiles} aria-labelledby="user-type-label">
                  {(
                    [
                      ["root", "Root user", "Account owner that performs tasks requiring unrestricted access."],
                      ["iam", "IAM user", "User within an account that performs daily tasks."],
                    ] as const
                  ).map(([value, label, description]) => (
                    <label key={value} className={`${styles.tile} ${userType === value ? styles.tileSelected : ""}`}>
                      <input
                        type="radio"
                        name="user-type"
                        value={value}
                        checked={userType === value}
                        onChange={() => {
                          setUserType(value);
                          clearMessages();
                        }}
                      />
                      <span>
                        <span className={styles.tileLabel}>{label}</span>
                        <span className={styles.tileDescription}>{description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {userType === "root" ? (
                  <div className={styles.field}>
                    <label htmlFor="email">Email address</label>
                    <input
                      id="email"
                      className={inputClass("email")}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="username@example.com"
                      autoComplete="off"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                    />
                    {fieldError("email")}
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label htmlFor="account_id">Account ID (12 digits) or account alias</label>
                    <input
                      id="account_id"
                      className={inputClass("account_id")}
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                      autoComplete="off"
                      aria-invalid={Boolean(errors.account_id)}
                      aria-describedby={errors.account_id ? "account_id-error" : undefined}
                    />
                    {fieldError("account_id")}
                  </div>
                )}

                <button type="submit" className={styles.primary}>
                  Next
                </button>
                <div className={styles.divider}>OR</div>
                <button type="button" className={styles.secondary} onClick={useDemoCredentials}>
                  Use demo credentials
                </button>
              </form>
            ) : (
              <form onSubmit={submitSignIn} noValidate>
                <h1>Sign in as IAM user</h1>
                <div className={styles.field}>
                  <label htmlFor="iam-account">Account ID (12 digits) or account alias</label>
                  <input
                    id="iam-account"
                    className={inputClass("account_id")}
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.account_id)}
                    aria-describedby={errors.account_id ? "account_id-error" : undefined}
                  />
                  {fieldError("account_id")}
                </div>
                <div className={styles.field}>
                  <label htmlFor="username">IAM username</label>
                  <input
                    id="username"
                    autoFocus={focusTarget === "username"}
                    className={inputClass("username")}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? "username-error" : undefined}
                  />
                  {fieldError("username")}
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    className={inputClass("password")}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  {fieldError("password")}
                </div>
                <label className={styles.check}>
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                  Show password
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  Remember this account
                </label>
                <button type="submit" className={styles.primary} disabled={submitting} autoFocus={focusTarget === "sign-in"}>
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
                <div className={styles.links}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => {
                      setUserType("root");
                      setStep("user-type");
                      clearMessages();
                    }}
                  >
                    Sign in using root user email
                  </button>
                  <button type="button" className={styles.linkButton} onClick={useDemoCredentials}>
                    Use demo credentials
                  </button>
                </div>
              </form>
            )}
          </div>
          <p className={styles.smallPrint}>
            This is a demo clone of the Route 53 console. It isn&apos;t affiliated with Amazon Web Services, so never enter
            real AWS credentials here. Read the{" "}
            <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
              documentation
            </a>{" "}
            to learn more.
          </p>
        </div>

        <aside className={styles.promo} aria-label="About this demo">
          <span className={styles.promoStreak} />
          <h2>Manage DNS the Route 53 way</h2>
          <p>Hosted zones, nine record types, search and filters, and zone file import and export, in one console.</p>
          <p className={styles.promoCredentials}>
            Demo sign-in: account <code>{DEMO.account_id}</code>, IAM username <code>{DEMO.username}</code>, password{" "}
            <code>{DEMO.password}</code>
          </p>
          <Link href="/">
            Learn more <ArrowRight />
          </Link>
        </aside>
      </div>

      <footer className={styles.footer}>© 2026 Route 53 Clone. Demo project, not affiliated with Amazon Web Services.</footer>
    </main>
  );
}
