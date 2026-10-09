"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import * as tokens from "@cloudscape-design/design-tokens";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { FullPageSpinner } from "@/components/layout/RequireAuth";
import { errorMessage } from "@/lib/api/client";
import { safeNextPath, useAuth } from "@/lib/auth";

const DEMO = { account_id: "123456789012", username: "demo", password: "Route53Demo!" };

type Field = keyof typeof DEMO;

export function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const [values, setValues] = useState<Record<Field, string>>({ account_id: DEMO.account_id, username: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  const update = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const errors: Partial<Record<Field, string>> = {};
    if (!values.account_id.trim()) errors.account_id = "Enter your account ID or alias.";
    if (!values.username.trim()) errors.username = "Enter your IAM user name.";
    if (!values.password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(values);
      router.replace(nextPath);
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") return <FullPageSpinner label="Loading" />;

  return (
    <main className="signin-page" style={{ background: tokens.colorBackgroundLayoutMain }}>
      <div className="signin-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" />
        <Box variant="h1" tagOverride="p" margin="n">
          Route 53 Clone
        </Box>
      </div>

      <div className="signin-card">
        <SpaceBetween size="l">
          <Alert type="info" header="Demo environment">
            This is a functional clone of the Route 53 console built for demonstration. It isn&apos;t affiliated with
            Amazon Web Services. Never enter real AWS credentials here.
          </Alert>

          <form onSubmit={onSubmit} noValidate>
            <Form
              actions={
                <Button variant="primary" formAction="submit" loading={submitting} fullWidth>
                  Sign in
                </Button>
              }
              errorText={formError}
              errorIconAriaLabel="Error"
            >
              <Container header={<Header variant="h2" description="Sign in with the demo IAM user.">Sign in as IAM user</Header>}>
                <SpaceBetween size="m">
                  <FormField label="Account ID (12 digits) or account alias" errorText={fieldErrors.account_id}>
                    <Input
                      value={values.account_id}
                      onChange={({ detail }) => update("account_id", detail.value)}
                      autoComplete="username"
                      name="account"
                      ariaRequired
                    />
                  </FormField>
                  <FormField label="IAM user name" errorText={fieldErrors.username}>
                    <Input
                      value={values.username}
                      onChange={({ detail }) => update("username", detail.value)}
                      autoComplete="off"
                      name="username"
                      autoFocus
                      ariaRequired
                    />
                  </FormField>
                  <FormField label="Password" errorText={fieldErrors.password}>
                    <Input
                      type="password"
                      value={values.password}
                      onChange={({ detail }) => update("password", detail.value)}
                      autoComplete="current-password"
                      name="password"
                      ariaRequired
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            </Form>
          </form>

          <Container header={<Header variant="h3">Demo credentials</Header>}>
            <SpaceBetween size="s">
              <Box>
                Account ID <Box variant="code">{DEMO.account_id}</Box>, IAM user name{" "}
                <Box variant="code">{DEMO.username}</Box>, password <Box variant="code">{DEMO.password}</Box>
              </Box>
              <Button
                onClick={() => {
                  setValues(DEMO);
                  setFieldErrors({});
                }}
              >
                Fill in demo credentials
              </Button>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </div>

      <div className="signin-footer">
        <Box variant="small" color="text-body-secondary">
          Hosted zones and records are stored by this demo&apos;s own API. No DNS changes are published.
        </Box>
      </div>
    </main>
  );
}
