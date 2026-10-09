"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import TagEditor, { type TagEditorProps } from "@cloudscape-design/components/tag-editor";
import { useState } from "react";

import {
  DESCRIPTION_LIMIT,
  DescriptionField,
  fromEditorTags,
  toEditorTags,
  validateVpc,
  VpcFields,
  type VpcErrors,
} from "@/components/hosted-zones/ZoneFields";
import { ApiError, errorMessage } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { zoneTypeLabel } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone } from "@/lib/types";

interface EditHostedZoneModalProps {
  zone: HostedZone;
  onDismiss: () => void;
  onSaved: (zone: HostedZone) => void;
}

/** Edits the mutable settings of a hosted zone. Mount it only while it's open. */
export function EditHostedZoneModal({ zone, onDismiss, onSaved }: EditHostedZoneModalProps) {
  const { notify } = useNotifications();
  const [comment, setComment] = useState(zone.comment);
  const [region, setRegion] = useState(zone.vpc_region ?? "");
  const [vpcId, setVpcId] = useState(zone.vpc_id ?? "");
  const [tags, setTags] = useState<readonly TagEditorProps.Tag[]>(toEditorTags(zone.tags));
  const [tagsValid, setTagsValid] = useState(true);
  const [errors, setErrors] = useState<VpcErrors & { comment?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPrivate = zone.type === "PRIVATE";

  const save = async () => {
    const nextErrors: VpcErrors & { comment?: string } = isPrivate ? validateVpc(region, vpcId) : {};
    if (comment.length > DESCRIPTION_LIMIT) nextErrors.comment = `The description can have up to ${DESCRIPTION_LIMIT} characters.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !tagsValid) return;

    setSaving(true);
    setFormError(null);
    try {
      const updated = await hostedZonesApi.update(zone.id, {
        comment,
        vpc_id: isPrivate ? vpcId.trim().toLowerCase() : null,
        vpc_region: isPrivate ? region : null,
        tags: fromEditorTags(tags),
      });
      notify({ type: "success", content: `Hosted zone ${updated.name} was updated successfully.` });
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors());
      setFormError(errorMessage(error));
      notify({ type: "error", header: `Failed to update hosted zone ${zone.name}`, content: errorMessage(error) });
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      size="large"
      onDismiss={() => !saving && onDismiss()}
      header="Edit hosted zone"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save changes
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {formError && (
          <Alert type="error" header="The hosted zone couldn't be updated">
            {formError}
          </Alert>
        )}
        <FormField label="Domain name" constraintText="You can't change the domain name of an existing hosted zone.">
          <Input value={zone.name} disabled readOnly />
        </FormField>
        <FormField label="Type">
          <Input value={`${zoneTypeLabel(zone.type)} hosted zone`} disabled readOnly />
        </FormField>
        <DescriptionField value={comment} onChange={setComment} errorText={errors.comment} />
        {isPrivate && (
          <VpcFields region={region} vpcId={vpcId} onRegionChange={setRegion} onVpcIdChange={setVpcId} errors={errors} />
        )}
        <FormField label="Tags" description="A tag is a label that you assign to a resource. Each tag has a key and an optional value.">
          <TagEditor
            tags={tags}
            onChange={({ detail }) => {
              setTags(detail.tags);
              setTagsValid(detail.valid);
            }}
            tagLimit={50}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
