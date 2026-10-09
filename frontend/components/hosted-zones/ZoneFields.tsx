"use client";

import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { TagEditorProps } from "@cloudscape-design/components/tag-editor";
import Textarea from "@cloudscape-design/components/textarea";

import { AWS_REGIONS } from "@/lib/format";
import type { Tag } from "@/lib/types";

export const DESCRIPTION_LIMIT = 256;
const VPC_ID = /^vpc-[0-9a-f]{8}([0-9a-f]{9})?$/;

const regionOptions = AWS_REGIONS.map((region) => ({
  value: region.value,
  label: region.label,
  description: region.value,
}));

export function DescriptionField({
  value,
  onChange,
  errorText,
}: {
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
}) {
  return (
    <FormField
      label={
        <span>
          Description - <i>optional</i>
        </span>
      }
      description="This value lets you distinguish hosted zones that have the same name."
      constraintText={`The description can have up to ${DESCRIPTION_LIMIT} characters. ${value.length}/${DESCRIPTION_LIMIT}`}
      errorText={errorText}
    >
      <Textarea value={value} onChange={({ detail }) => onChange(detail.value)} rows={2} placeholder="The hosted zone is used for..." />
    </FormField>
  );
}

export interface VpcErrors {
  vpc_region?: string;
  vpc_id?: string;
}

export function VpcFields({
  region,
  vpcId,
  onRegionChange,
  onVpcIdChange,
  errors,
}: {
  region: string;
  vpcId: string;
  onRegionChange: (value: string) => void;
  onVpcIdChange: (value: string) => void;
  errors: VpcErrors;
}) {
  return (
    <SpaceBetween size="m">
      <FormField label="Region" description="Choose the Region of the VPC to associate." errorText={errors.vpc_region}>
        <Select
          selectedOption={regionOptions.find((option) => option.value === region) ?? null}
          onChange={({ detail }) => onRegionChange(detail.selectedOption.value ?? "")}
          options={regionOptions}
          placeholder="Choose a Region"
          filteringType="auto"
          ariaLabel="Region"
        />
      </FormField>
      <FormField
        label="VPC ID"
        description="The VPC whose resources can query this private hosted zone."
        constraintText="For example: vpc-0a1b2c3d4e5f67890"
        errorText={errors.vpc_id}
      >
        <Input value={vpcId} onChange={({ detail }) => onVpcIdChange(detail.value)} placeholder="vpc-0a1b2c3d4e5f67890" />
      </FormField>
    </SpaceBetween>
  );
}

export function validateVpc(region: string, vpcId: string): VpcErrors {
  const errors: VpcErrors = {};
  if (!region) errors.vpc_region = "Choose the Region of the VPC.";
  if (!vpcId.trim()) errors.vpc_id = "Enter the ID of the VPC to associate with this zone.";
  else if (!VPC_ID.test(vpcId.trim().toLowerCase())) errors.vpc_id = "VPC IDs look like vpc-0a1b2c3d (8 or 17 hex characters).";
  return errors;
}

export const toEditorTags = (tags: Tag[]): TagEditorProps.Tag[] =>
  tags.map((tag) => ({ key: tag.key, value: tag.value, existing: true }));

export const fromEditorTags = (tags: readonly TagEditorProps.Tag[]): Tag[] =>
  tags.filter((tag) => !tag.markedForRemoval && tag.key.trim()).map((tag) => ({ key: tag.key.trim(), value: tag.value }));
