"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import TagEditor, { type TagEditorProps } from "@cloudscape-design/components/tag-editor";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CreateHostedZoneHelp } from "@/components/common/HelpPanels";
import { ConsoleLayout } from "@/components/layout/ConsoleLayout";
import {
  DESCRIPTION_LIMIT,
  DescriptionField,
  fromEditorTags,
  validateVpc,
  VpcFields,
} from "@/components/hosted-zones/ZoneFields";
import { ApiError, errorMessage } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { validateZoneName } from "@/lib/dns";
import { useNotifications } from "@/lib/notifications";
import { ROUTES } from "@/lib/routes";
import type { ZoneType } from "@/lib/types";

type Errors = Partial<Record<"name" | "comment" | "vpc_region" | "vpc_id", string>>;

export function CreateHostedZonePage() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<ZoneType>("PUBLIC");
  const [region, setRegion] = useState("us-east-1");
  const [vpcId, setVpcId] = useState("");
  const [tags, setTags] = useState<readonly TagEditorProps.Tag[]>([]);
  const [tagsValid, setTagsValid] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const validate = (): Errors => {
    const next: Errors = type === "PRIVATE" ? validateVpc(region, vpcId) : {};
    const nameError = validateZoneName(name);
    if (nameError) next.name = nameError;
    if (comment.length > DESCRIPTION_LIMIT) next.comment = `The description can have up to ${DESCRIPTION_LIMIT} characters.`;
    return next;
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !tagsValid) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const zone = await hostedZonesApi.create({
        name: name.trim(),
        type,
        comment,
        vpc_id: type === "PRIVATE" ? vpcId.trim().toLowerCase() : null,
        vpc_region: type === "PRIVATE" ? region : null,
        tags: fromEditorTags(tags),
      });
      notify({
        type: "success",
        header: `${zone.name} was successfully created.`,
        content: "Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.",
      });
      router.push(ROUTES.zone(zone.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: "Route 53", href: ROUTES.dashboard },
        { text: "Hosted zones", href: ROUTES.hostedZones },
        { text: "Create hosted zone", href: ROUTES.createHostedZone },
      ]}
      contentType="form"
      tools={<CreateHostedZoneHelp />}
      toolsOpen={toolsOpen}
      onToolsChange={setToolsOpen}
      content={
        <form onSubmit={submit} noValidate>
          <Form
            header={
              <Header
                variant="h1"
                info={
                  <Link variant="info" onFollow={() => setToolsOpen(true)}>
                    Info
                  </Link>
                }
                description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
              >
                Create hosted zone
              </Header>
            }
            errorText={formError}
            errorIconAriaLabel="Error"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button formAction="none" variant="link" onClick={() => router.push(ROUTES.hostedZones)} disabled={submitting}>
                  Cancel
                </Button>
                <Button formAction="submit" variant="primary" loading={submitting}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              <Container header={<Header variant="h2">Hosted zone configuration</Header>}>
                <SpaceBetween size="l">
                  <FormField
                    label="Domain name"
                    description="This is the name of the domain that you want to route traffic for."
                    constraintText="Valid characters: a-z, 0-9, - (hyphen) and . (period)"
                    errorText={errors.name}
                  >
                    <Input
                      value={name}
                      onChange={({ detail }) => {
                        setName(detail.value);
                        if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
                      }}
                      placeholder="example.com"
                      autoFocus
                      ariaRequired
                    />
                  </FormField>
                  <DescriptionField value={comment} onChange={setComment} errorText={errors.comment} />
                  <FormField label="Type" description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC.">
                    <Tiles
                      value={type}
                      onChange={({ detail }) => setType(detail.value as ZoneType)}
                      columns={2}
                      items={[
                        {
                          value: "PUBLIC",
                          label: "Public hosted zone",
                          description: "A public hosted zone determines how traffic is routed on the internet.",
                        },
                        {
                          value: "PRIVATE",
                          label: "Private hosted zone",
                          description: "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                        },
                      ]}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              {type === "PRIVATE" && (
                <Container
                  header={
                    <Header variant="h2" description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs.">
                      VPCs to associate with the hosted zone
                    </Header>
                  }
                >
                  <VpcFields region={region} vpcId={vpcId} onRegionChange={setRegion} onVpcIdChange={setVpcId} errors={errors} />
                </Container>
              )}

              <Container
                header={
                  <Header
                    variant="h2"
                    description="Apply tags to hosted zones to help organize and identify them. A tag is a label that you assign to a resource."
                  >
                    Tags
                  </Header>
                }
              >
                <TagEditor
                  tags={tags}
                  onChange={({ detail }) => {
                    setTags(detail.tags);
                    setTagsValid(detail.valid);
                  }}
                  tagLimit={50}
                />
              </Container>
            </SpaceBetween>
          </Form>
        </form>
      }
    />
  );
}
