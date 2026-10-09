"use client";

import Alert from "@cloudscape-design/components/alert";
import AttributeEditor, { type AttributeEditorProps } from "@cloudscape-design/components/attribute-editor";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import { recordsApi } from "@/lib/api/endpoints";
import {
  CREATABLE_RECORD_TYPES,
  emptyRow,
  fullRecordName,
  RECORD_TYPES,
  recordPrefix,
  rowFromValue,
  rowToPayload,
  validateRecordPrefix,
  validateRows,
  validateTtl,
  type RowErrors,
  type ValueField,
  type ValueRow,
} from "@/lib/dns";
import { useNotifications } from "@/lib/notifications";
import type { DnsRecord, HostedZone, RecordType } from "@/lib/types";

interface RecordFormModalProps {
  zone: HostedZone;
  /** The record to edit; omit to create a new record. */
  record?: DnsRecord;
  onDismiss: () => void;
  onSaved: (record: DnsRecord) => void;
}

const typeOption = (type: RecordType): SelectProps.Option => ({
  value: type,
  label: `${type} – ${RECORD_TYPES[type].description}`,
});

const TYPE_OPTIONS = CREATABLE_RECORD_TYPES.map(typeOption);
const TTL_PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];

interface ServerErrors {
  name?: string;
  ttl?: string;
  values?: string;
  rows: RowErrors[];
}

function parseServerErrors(error: ApiError): ServerErrors {
  const result: ServerErrors = { rows: [] };
  for (const { field, message } of error.details) {
    const match = /^values\[(\d+)\]\.(\w+)$/.exec(field);
    if (match) {
      const index = Number(match[1]);
      result.rows[index] = { ...result.rows[index], [match[2] as ValueField]: message };
    } else if (field === "name" || field === "ttl" || field === "values") {
      result[field] = message;
    }
  }
  return result;
}

/** Create or edit a record. Mount it only while it's open. */
export function RecordFormModal({ zone, record, onDismiss, onSaved }: RecordFormModalProps) {
  const { notify } = useNotifications();
  const isEdit = Boolean(record);
  const isSystem = record?.is_system ?? false;

  const [prefix, setPrefix] = useState(record ? recordPrefix(record.name, zone.name) : "");
  const [type, setType] = useState<RecordType>(record?.type ?? "A");
  const [ttl, setTtl] = useState(String(record?.ttl ?? 300));
  const [rows, setRows] = useState<ValueRow[]>(record ? record.values.map(rowFromValue) : [emptyRow("A")]);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerErrors>({ rows: [] });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const spec = RECORD_TYPES[type];
  const clientRows = validateRows(type, rows);
  const nameError = validateRecordPrefix(prefix, zone.name);
  const ttlError = validateTtl(ttl);
  const hasClientErrors =
    Boolean(nameError || ttlError || clientRows.form) || clientRows.rows.some((row) => Object.keys(row).length > 0);

  // Client errors appear after the first submit attempt; server errors until the next edit.
  const shown = (client: string | null | undefined, server: string | undefined) =>
    (submitted ? client : null) ?? server ?? undefined;

  const touch = () => {
    setServerErrors({ rows: [] });
    setFormError(null);
  };

  const changeType = (next: RecordType) => {
    touch();
    setType(next);
    // Keep what was typed in the main value field; reset type-specific fields.
    setRows((current) => current.slice(0, RECORD_TYPES[next].maxValues).map((row) => ({ ...emptyRow(next), value: row.value })));
  };

  const updateRow = (index: number, field: ValueField, value: string) => {
    touch();
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const save = async () => {
    setSubmitted(true);
    if (hasClientErrors) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      name: fullRecordName(prefix, zone.name),
      type,
      ttl: Number(ttl),
      values: rows.map((row) => rowToPayload(type, row)),
    };
    try {
      const saved = record
        ? await recordsApi.update(zone.id, record.id, payload)
        : await recordsApi.create(zone.id, payload);
      notify({
        type: "success",
        content: `Record ${saved.name} (${saved.type}) was ${record ? "updated" : "created"} successfully.`,
      });
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setServerErrors(parseServerErrors(error));
      setFormError(errorMessage(error));
      setSaving(false);
    }
  };

  const definition: AttributeEditorProps.FieldDefinition<ValueRow>[] = spec.fields.map((field) => ({
    label: field.label,
    errorText: (_row, index) => shown(clientRows.rows[index]?.[field.key], serverErrors.rows[index]?.[field.key]),
    control: (row, index) =>
      field.options ? (
        <Select
          selectedOption={row[field.key] ? { value: row[field.key], label: row[field.key] } : null}
          onChange={({ detail }) => updateRow(index, field.key, detail.selectedOption.value ?? "")}
          options={field.options.map((option) => ({ value: option, label: option }))}
          ariaLabel={`${field.label} ${index + 1}`}
        />
      ) : (
        <Input
          value={row[field.key]}
          onChange={({ detail }) => updateRow(index, field.key, detail.value)}
          placeholder={field.placeholder}
          inputMode={field.numeric ? "numeric" : undefined}
          ariaLabel={`${field.label} ${index + 1}`}
        />
      ),
  }));

  return (
    <Modal
      visible
      size="large"
      onDismiss={() => !saving && onDismiss()}
      header={isEdit ? "Edit record" : "Create record"}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {isEdit ? "Save" : "Create records"}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <SpaceBetween size="l">
          {formError && (
            <Alert type="error" header={isEdit ? "The record couldn't be saved" : "The record couldn't be created"}>
              {formError}
            </Alert>
          )}
          {isSystem && (
            <Alert type="info">
              Route 53 created this {type} record for the zone apex. You can change its values and TTL, but not its name
              or type, and you can&apos;t delete it.
            </Alert>
          )}

          <FormField
            label="Record name"
            description="Keep blank to create a record for the root domain."
            constraintText="Valid characters: a-z, 0-9, - (hyphen), _ (underscore) and . (period). A * can be the first label."
            errorText={shown(nameError, serverErrors.name)}
            stretch
          >
            <div className="record-name-row">
              <Input
                value={prefix}
                onChange={({ detail }) => {
                  touch();
                  setPrefix(detail.value);
                }}
                placeholder="subdomain"
                disabled={isSystem}
                ariaLabel="Record name"
              />
              <Box variant="span" color="text-body-secondary">
                <span className="record-name-suffix">.{zone.name}</span>
              </Box>
            </div>
          </FormField>

          <FormField label="Record type" description={isEdit ? undefined : "Choose the type of DNS record to create."}>
            <Select
              selectedOption={typeOption(type)}
              onChange={({ detail }) => changeType(detail.selectedOption.value as RecordType)}
              options={TYPE_OPTIONS}
              disabled={isSystem}
              ariaLabel="Record type"
            />
          </FormField>

          <FormField
            label="Value"
            description={spec.valueHelp}
            errorText={shown(clientRows.form, serverErrors.values)}
            stretch
          >
            <AttributeEditor
              items={rows}
              definition={definition}
              onAddButtonClick={() => {
                touch();
                setRows((current) => [...current, emptyRow(type)]);
              }}
              onRemoveButtonClick={({ detail }) => {
                touch();
                setRows((current) => current.filter((_, i) => i !== detail.itemIndex));
              }}
              isItemRemovable={() => rows.length > 1}
              addButtonText="Add another value"
              removeButtonText="Remove"
              disableAddButton={rows.length >= spec.maxValues}
              additionalInfo={
                spec.maxValues === 1 ? `A ${type} record has exactly one value.` : `You can add up to ${spec.maxValues} values.`
              }
              empty="No values"
            />
          </FormField>

          <FormField
            label="TTL (seconds)"
            description="How long resolvers cache this record."
            constraintText="Recommended values: 60 to 172800 (two days)"
            errorText={shown(ttlError, serverErrors.ttl)}
          >
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Input
                type="number"
                inputMode="numeric"
                value={ttl}
                onChange={({ detail }) => {
                  touch();
                  setTtl(detail.value);
                }}
                ariaLabel="TTL (seconds)"
              />
              {TTL_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  formAction="none"
                  onClick={() => {
                    touch();
                    setTtl(String(preset.seconds));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </SpaceBetween>
          </FormField>

          <FormField label="Routing policy" description="This clone supports simple routing.">
            <Select selectedOption={{ value: "simple", label: "Simple routing" }} options={[]} disabled ariaLabel="Routing policy" onChange={() => undefined} />
          </FormField>
        </SpaceBetween>
      </form>
    </Modal>
  );
}
