import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/renderer/components/ui/card";

type AuthFlow = "sign-in" | "sign-up";

type View = { step: "email" } | { step: AuthFlow; email: string };

export function SignInDialog() {
  const [view, setView] = useState<View>({ step: "email" });
  const backToEmail = () => setView({ step: "email" });

  return (
    <div className="flex h-full items-center justify-center p-4">
      {view.step === "email" && (
        <EmailStep
          onCodeSent={(flow, email) => setView({ step: flow, email })}
        />
      )}
      {view.step === "sign-in" && (
        <SignInForm email={view.email} onUseDifferentEmail={backToEmail} />
      )}
      {view.step === "sign-up" && (
        <SignUpForm email={view.email} onUseDifferentEmail={backToEmail} />
      )}
    </div>
  );
}

function EmailStep({
  onCodeSent,
}: {
  onCodeSent: (flow: AuthFlow, email: string) => void;
}) {
  const { isLoaded, signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!isLoaded || signUp == null) return;
    const address = email.trim();
    if (address === "") return;

    setSubmitting(true);
    setError(null);
    try {
      let flow: AuthFlow;
      try {
        const attempt = await signIn.create({ identifier: address });
        const factor = attempt.supportedFirstFactors?.find(
          (f): f is typeof f & { emailAddressId: string } =>
            f.strategy === "email_code",
        );
        if (factor == null) {
          throw new Error(
            "Email code sign-in is not enabled for this account.",
          );
        }
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });
        flow = "sign-in";
      } catch (err) {
        if (isClerkAPIResponseError(err) && isUserNotFound({ error: err })) {
          await signUp.create({ emailAddress: address });
          await signUp.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          flow = "sign-up";
        } else {
          throw err;
        }
      }
      onCodeSent(flow, address);
    } catch (err) {
      logClerkError({ where: "sendCode", error: err });
      setError(
        toMessage({
          error: err,
          fallback: "Failed to send the code. Please try again.",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Sign in to memomi
        </CardTitle>
        <CardDescription>We'll email you a one-time passcode.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={submitting}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={!isLoaded || submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Send code
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignInForm({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  const { isLoaded, signIn, setActive } = useSignIn();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!isLoaded) return;
    const value = code.trim();
    if (value === "") return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: value,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        return;
      }
      throw new Error("Could not complete sign-in.");
    } catch (err) {
      logClerkError({ where: "signIn:verify", error: err });
      setError(
        toMessage({ error: err, fallback: "Invalid code. Please try again." }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      const factor = signIn.supportedFirstFactors?.find(
        (f): f is typeof f & { emailAddressId: string } =>
          f.strategy === "email_code",
      );
      if (factor == null) {
        throw new Error("Email code sign-in is not enabled for this account.");
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
    } catch (err) {
      logClerkError({ where: "signIn:resend", error: err });
      setError(
        toMessage({ error: err, fallback: "Failed to resend the code." }),
      );
    }
  };

  return (
    <CodeForm
      email={email}
      code={code}
      onCodeChange={setCode}
      submitting={submitting}
      disabled={!isLoaded || submitting}
      error={error}
      onSubmit={verify}
      onResend={resend}
      onUseDifferentEmail={onUseDifferentEmail}
    />
  );
}

function SignUpForm({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  const { isLoaded, signUp, setActive } = useSignUp();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!isLoaded) return;
    const value = code.trim();
    if (value === "") return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: value,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        return;
      }
      throw new Error("Could not complete sign-up.");
    } catch (err) {
      logClerkError({ where: "signUp:verify", error: err });
      setError(
        toMessage({ error: err, fallback: "Invalid code. Please try again." }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err) {
      logClerkError({ where: "signUp:resend", error: err });
      setError(
        toMessage({ error: err, fallback: "Failed to resend the code." }),
      );
    }
  };

  return (
    <CodeForm
      email={email}
      code={code}
      onCodeChange={setCode}
      submitting={submitting}
      disabled={!isLoaded || submitting}
      error={error}
      onSubmit={verify}
      onResend={resend}
      onUseDifferentEmail={onUseDifferentEmail}
    />
  );
}

function CodeForm({
  email,
  code,
  onCodeChange,
  submitting,
  disabled,
  error,
  onSubmit,
  onResend,
  onUseDifferentEmail,
}: {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  submitting: boolean;
  disabled: boolean;
  error: string | null;
  onSubmit: () => void;
  onResend: () => void;
  onUseDifferentEmail: () => void;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Enter your code
        </CardTitle>
        <CardDescription>We sent a code to {email}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-code">Passcode</Label>
            <Input
              id="auth-code"
              inputMode="numeric"
              autoFocus
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              disabled={submitting}
              onChange={(e) => onCodeChange(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={disabled}>
            {submitting && <Loader2 className="animate-spin" />}
            Verify
          </Button>

          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={onUseDifferentEmail}
              disabled={submitting}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={onResend}
              disabled={submitting}
            >
              Resend code
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function logClerkError({
  where,
  error,
}: {
  where: string;
  error: unknown;
}): void {
  if (isClerkAPIResponseError(error)) {
    // eslint-disable-next-line no-console
    console.error(
      `[auth:${where}] Clerk errors:`,
      error.errors.map((e) => ({
        code: e.code,
        message: e.message,
        longMessage: e.longMessage,
      })),
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(`[auth:${where}]`, error);
  }
}

function isUserNotFound({
  error,
}: {
  error: { errors: Array<{ code: string }> };
}): boolean {
  return error.errors.some((e) => e.code === "form_identifier_not_found");
}

function toMessage({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
