"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import FileUpload from "@cloudscape-design/components/file-upload";
import FormField from "@cloudscape-design/components/form-field";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { useNotifications } from "@/lib/notifications";
import type { HostedZone, ZoneImportIssue, ZoneImportResult } from "@/lib/types";

const MAX_BYTES = 1_000_000;

interface ImportZoneFileModalProps {
  zone: HostedZone;
  onDismiss: () => void;
  onImported: (result: ZoneImportResult) => void;
}

function IssueList({ title, issues }: { title: string; issues: ZoneImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ExpandableSection headerText={`${title} (${issues.length})`} defaultExpanded={issues.length <= 5}>
      <ul className="issue-list">
        {issues.map((issue, index) => (
          <li key={`${issue.line}-${index}`}>
            Line {issue.line}: {issue.message}
          </li>
        ))}
      </ul>
    </ExpandableSection>
  );
}

export function ImportZoneFileModal({ zone, onDismiss, onImported }: ImportZoneFileModalProps) {
  const { notify } = useNotifications();
  const [files, setFiles] = useState<File[]>([]);
  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ZoneImportResult | null>(null);

  const loadFile = async (selected: File[]) => {
    setFiles(selected);
    setFileError(null);
    const file = selected[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError("The file is larger than 1 MB.");
      return;
    }
    setContent(await file.text());
  };

  const runImport = async () => {
    if (!content.trim()) {
      setError("Upload a zone file or paste its contents.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const outcome = await hostedZonesApi.importZoneFile(zone.id, content, overwrite);
      setResult(outcome);
      const changed = outcome.created + outcome.updated;
      if (changed > 0) {
        notify({
          type: outcome.errors.length > 0 ? "warning" : "success",
          content: `Imported ${changed} record${changed === 1 ? "" : "s"} into ${zone.name}${
            outcome.errors.length > 0 ? `; ${outcome.errors.length} entries had errors` : ""
          }.`,
        });
        onImported(outcome);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const changed = result ? result.created + result.updated : 0;

  return (
    <Modal
      visible
      size="large"
      onDismiss={() => !importing && onDismiss()}
      header="Import zone file"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            {result ? (
              <>
                <Button
                  variant="link"
                  onClick={() => {
                    setResult(null);
                    setContent("");
                    setFiles([]);
                  }}
                >
                  Import another file
                </Button>
                <Button variant="primary" onClick={onDismiss}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button variant="link" onClick={onDismiss} disabled={importing}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={runImport} loading={importing} disabled={!content.trim()}>
                  Import
                </Button>
              </>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      {result ? (
        <SpaceBetween size="m">
          <Alert
            type={result.errors.length > 0 ? (changed > 0 ? "warning" : "error") : changed > 0 ? "success" : "info"}
            header={
              changed > 0
                ? `Imported ${changed} record${changed === 1 ? "" : "s"}`
                : "No records were imported"
            }
          >
            {result.created} created, {result.updated} updated, {result.skipped.length} skipped,{" "}
            {result.errors.length} with errors.
          </Alert>
          <IssueList title="Errors" issues={result.errors} />
          <IssueList title="Skipped" issues={result.skipped} />
        </SpaceBetween>
      ) : (
        <SpaceBetween size="l">
          <Box variant="p">
            Import records into <Box variant="strong">{zone.name}</Box> from a zone file in BIND format. Supported types:
            A, AAAA, CAA, CNAME, MX, NS, PTR, SRV and TXT. The SOA record and the NS record at the zone apex are managed
            by Route 53 and are skipped.
          </Box>
          {error && (
            <Alert type="error" header="The zone file couldn't be imported">
              {error}
            </Alert>
          )}
          <FormField label="Zone file" description="Choose a file, or paste the zone file below." errorText={fileError}>
            <FileUpload
              value={files}
              onChange={({ detail }) => void loadFile(detail.value)}
              accept=".zone,.txt,.db,.bind,text/plain"
              constraintText="Plain-text zone file, up to 1 MB."
              showFileSize
              i18nStrings={{
                uploadButtonText: () => "Choose file",
                dropzoneText: () => "Drop zone file to upload",
                removeFileAriaLabel: () => "Remove file",
                errorIconAriaLabel: "Error",
              }}
            />
          </FormField>
          <FormField label="Zone file contents" stretch>
            <Textarea
              value={content}
              onChange={({ detail }) => setContent(detail.value)}
              rows={12}
              spellcheck={false}
              placeholder={`$ORIGIN ${zone.name}.\n$TTL 300\nwww   IN  A      192.0.2.10\n@     IN  MX     10 mail.${zone.name}.\n@     IN  TXT    "v=spf1 -all"`}
              ariaLabel="Zone file contents"
            />
          </FormField>
          <Checkbox checked={overwrite} onChange={({ detail }) => setOverwrite(detail.checked)}>
            Overwrite existing records that have the same name and type
          </Checkbox>
        </SpaceBetween>
      )}
    </Modal>
  );
}
