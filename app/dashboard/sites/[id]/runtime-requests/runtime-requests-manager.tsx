"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ActionResponse } from "@/app/dashboard/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  RuntimeRequestLifecycle,
  RuntimeRequestObservationGroup,
  RuntimeRequestPolicyAction,
  RuntimeRequestPolicyConfig,
  RuntimeRequestPolicyConfirmation,
  RuntimeRequestPolicyMethod,
  RuntimeRequestPolicyPreviewResponse,
  RuntimeRequestPolicyRule,
  RuntimeRequestPolicyPropagation,
} from "@internal/dashboard/webhooks";

const ALL_METHODS: RuntimeRequestPolicyMethod[] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];
const CONFIRMATIONS: RuntimeRequestPolicyConfirmation[] = [
  "non_get_proxy",
  "credential_forwarding",
  "high_risk_path",
];
const POLICY_ACTIONS = new Set<RuntimeRequestPolicyAction>([
  "observe",
  "deny",
  "neutralize",
  "proxy",
]);
const POLICY_METHODS = new Set<RuntimeRequestPolicyMethod>(ALL_METHODS);
const POLICY_CREDENTIALS = new Set(["omit", "same_origin", "include"]);
const POLICY_CACHE_MODES = new Set(["no-store", "edge"]);
const POLICY_REDIRECT_SCOPES = new Set(["same_origin", "same_registrable_domain"]);
const POLICY_CONFIRMATIONS = new Set<RuntimeRequestPolicyConfirmation>(CONFIRMATIONS);
const DEFAULT_POLICY: RuntimeRequestPolicyConfig = {
  schemaVersion: 1,
  mode: "standard",
  enabled: true,
  rules: [],
};

export type RuntimeRequestsCopy = {
  title: string;
  description: string;
  standardMode: string;
  activeRules: string;
  unreviewedGroups: string;
  highRiskGroups: string;
  lastSeen: string;
  policyVersion: string;
  propagationReady: string;
  propagationStale: string;
  observationsTitle: string;
  observationsDescription: string;
  observationsDeferred: string;
  observationsEmpty: string;
  loadObservations: string;
  loadingObservations: string;
  method: string;
  path: string;
  likelyType: string;
  firstSeen: string;
  seenFromPage: string;
  currentAction: string;
  suggestedAction: string;
  risk: string;
  lifecycle: string;
  reviewed: string;
  dismissed: string;
  ignored: string;
  createRule: string;
  rulesTitle: string;
  rulesDescription: string;
  noRules: string;
  presetsTitle: string;
  presetNeutralizeAnalytics: string;
  presetSearchProxy: string;
  presetFeatureConfigProxy: string;
  presetRouteDataProxy: string;
  presetFormSubmitProxy: string;
  validateDraft: string;
  previewReady: string;
  previewBlocked: string;
  previewRequired: string;
  save: string;
  saving: string;
  reset: string;
  enabled: string;
  name: string;
  pattern: string;
  methods: string;
  action: string;
  credentials: string;
  cache: string;
  limits: string;
  headers: string;
  neutralization: string;
  confirmations: string;
  removeRule: string;
  draftStatus: string;
  savedStatus: string;
  standardValue: string;
  standardFallbackVersion: string;
  maxBodyBytes: string;
  maxResponseBytes: string;
  timeoutMs: string;
  requestHeaders: string;
  responseHeaders: string;
  requestContentTypes: string;
  responseContentTypes: string;
  redirectScope: string;
  defaultRuleName: string;
  previewErrorFallback: string;
  validationTitle: string;
  warningsTitle: string;
  matchedGroupsTitle: string;
  redactionNote: string;
};

type RuntimeRequestPreset = {
  id: string;
  label: keyof Pick<
    RuntimeRequestsCopy,
    | "presetNeutralizeAnalytics"
    | "presetSearchProxy"
    | "presetFeatureConfigProxy"
    | "presetRouteDataProxy"
    | "presetFormSubmitProxy"
  >;
  rule: Partial<RuntimeRequestPolicyRule>;
};

type RuntimeRequestsManagerProps = {
  siteId: string;
  initialPolicy: RuntimeRequestPolicyConfig | null | undefined;
  runtimeRequestPolicyFingerprint?: string | null;
  runtimeRequestPolicyVersion?: string | null;
  propagation?: RuntimeRequestPolicyPropagation | null;
  observations: RuntimeRequestObservationGroup[];
  observationsLoaded?: boolean;
  canEdit: boolean;
  canLoadObservations?: boolean;
  loadObservationsAction: (
    prevState: ActionResponse | undefined,
    formData: FormData,
  ) => Promise<ActionResponse>;
  saveAction: (
    prevState: ActionResponse | undefined,
    formData: FormData,
  ) => Promise<ActionResponse>;
  lifecycleAction: (
    prevState: ActionResponse | undefined,
    formData: FormData,
  ) => Promise<ActionResponse>;
  copy: RuntimeRequestsCopy;
};

export function RuntimeRequestsManager({
  siteId,
  initialPolicy,
  runtimeRequestPolicyFingerprint,
  runtimeRequestPolicyVersion,
  propagation,
  observations,
  observationsLoaded: initialObservationsLoaded = true,
  canEdit,
  canLoadObservations = canEdit,
  loadObservationsAction,
  saveAction,
  lifecycleAction,
  copy,
}: RuntimeRequestsManagerProps) {
  const normalizedInitialPolicy = useMemo(
    () => normalizeRuntimePolicy(initialPolicy ?? DEFAULT_POLICY),
    [initialPolicy],
  );
  const [persistedPolicy, setPersistedPolicy] = useState(normalizedInitialPolicy);
  const [draftPolicy, setDraftPolicy] = useState(normalizedInitialPolicy);
  const [expectedFingerprint, setExpectedFingerprint] = useState(
    runtimeRequestPolicyFingerprint ?? null,
  );
  const [servedVersion, setServedVersion] = useState(runtimeRequestPolicyVersion ?? null);
  const [servedPropagation, setServedPropagation] = useState(propagation ?? null);
  const [groups, setGroups] = useState(observations);
  const [observationsLoaded, setObservationsLoaded] = useState(initialObservationsLoaded);
  const [isLoadingObservations, setLoadingObservations] = useState(false);
  const [preview, setPreview] = useState<RuntimeRequestPolicyPreviewResponse | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setPreviewing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<ActionResponse | null>(null);
  const [observationLoadResult, setObservationLoadResult] = useState<ActionResponse | null>(null);
  const [lifecycleResult, setLifecycleResult] = useState<ActionResponse | null>(null);

  const persistedFingerprint = runtimePolicyFingerprint(persistedPolicy);
  const draftFingerprint = runtimePolicyFingerprint(draftPolicy);
  const hasUnsavedChanges = draftFingerprint !== persistedFingerprint;
  const activeRuleCount = draftPolicy.rules.filter((rule) => rule.enabled).length;
  const unreviewedCount = groups.filter((group) => group.lifecycle === "open").length;
  const highRiskCount = groups.filter(
    (group) => group.risk === "high" && group.lifecycle !== "ignored",
  ).length;
  const lastSeenAt = groups
    .map((group) => group.lastSeenAt)
    .sort((left, right) => right.localeCompare(left))[0];
  const previewIsCurrent = previewFingerprint === draftFingerprint;
  const previewBlocksSave =
    !preview ||
    !previewIsCurrent ||
    preview.validationErrors.length > 0 ||
    preview.highRiskConfirmations.length > 0 ||
    preview.collisions.length > 0;
  const canSave =
    canEdit &&
    hasUnsavedChanges &&
    !isSaving &&
    !isPreviewing &&
    !previewError &&
    !previewBlocksSave;

  const loadObservations = () => {
    if (!canLoadObservations || isLoadingObservations) {
      return;
    }
    setLoadingObservations(true);
    setObservationLoadResult(null);
    const formData = new FormData();
    formData.set("siteId", siteId);
    void loadObservationsAction(undefined, formData)
      .then((result) => {
        setObservationLoadResult(result);
        if (result.ok) {
          setGroups(readObservationGroups(result.meta));
          setObservationsLoaded(true);
        }
      })
      .catch((error) => {
        setObservationLoadResult({
          ok: false,
          message: error instanceof Error ? error.message : copy.previewBlocked,
        });
      })
      .finally(() => setLoadingObservations(false));
  };

  const updateDraft = (
    updater: (policy: RuntimeRequestPolicyConfig) => RuntimeRequestPolicyConfig,
  ) => {
    setDraftPolicy((current) => normalizeRuntimePolicy(updater(current)));
    setPreview(null);
    setPreviewFingerprint("");
    setPreviewError(null);
    setSaveResult(null);
  };

  const runPreview = () => {
    if (!canEdit) {
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/dashboard/sites/${encodeURIComponent(siteId)}/runtime-request-policy/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runtimeRequestPolicy: draftPolicy,
              samples: groups.slice(0, 10).map((group) => ({
                url: `https://example.invalid${group.path}`,
                method: group.method,
                accept: group.acceptClass === "json" ? "application/json" : "*/*",
              })),
            }),
            cache: "no-store",
          },
        );
        const body = (await response.json()) as unknown;
        if (!response.ok) {
          setPreviewError(extractPreviewMessage(body, copy));
          return;
        }
        setPreview(body as RuntimeRequestPolicyPreviewResponse);
        setPreviewFingerprint(draftFingerprint);
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : copy.previewBlocked);
      } finally {
        setPreviewing(false);
      }
    })();
  };

  const savePolicy = () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    void (async () => {
      const formData = new FormData();
      formData.set("siteId", siteId);
      formData.set("runtimeRequestPolicy", JSON.stringify(draftPolicy));
      if (expectedFingerprint) {
        formData.set("expectedRuntimeRequestPolicyFingerprint", expectedFingerprint);
      }
      try {
        const result = await saveAction(undefined, formData);
        setSaveResult(result);
        if (!result.ok) {
          return;
        }
        const savedPolicy = readSavedRuntimePolicy(result.meta);
        if (!savedPolicy) {
          setSaveResult({
            ok: false,
            message: "Runtime request policy save response was incomplete.",
          });
          return;
        }
        setPersistedPolicy(savedPolicy);
        setDraftPolicy(savedPolicy);
        setExpectedFingerprint(readMetaString(result.meta, "runtimeRequestPolicyFingerprint"));
        setServedVersion(readMetaString(result.meta, "runtimeRequestPolicyVersion"));
        setServedPropagation(readSavedPropagation(result.meta));
        setPreview(null);
        setPreviewFingerprint("");
      } catch (error) {
        setSaveResult({
          ok: false,
          message: error instanceof Error ? error.message : copy.previewBlocked,
        });
      } finally {
        setSaving(false);
      }
    })();
  };

  const updateLifecycle = (
    group: RuntimeRequestObservationGroup,
    lifecycle: RuntimeRequestLifecycle,
  ) => {
    if (!canEdit) {
      return;
    }
    const formData = new FormData();
    formData.set("siteId", siteId);
    formData.set("groupingPathHash", group.groupingPathHash);
    formData.set("method", group.method);
    formData.set("shapeSignature", group.shapeSignature);
    formData.set("lifecycle", lifecycle);
    void lifecycleAction(undefined, formData).then((result) => {
      setLifecycleResult(result);
      if (result.ok) {
        setGroups((current) =>
          current.map((entry) =>
            entry.groupingPathHash === group.groupingPathHash &&
            entry.method === group.method &&
            entry.shapeSignature === group.shapeSignature
              ? { ...entry, lifecycle }
              : entry,
          ),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Badge variant={servedPropagation?.stale ? "destructive" : "secondary"}>
            {servedPropagation?.stale ? copy.propagationStale : copy.propagationReady}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Metric label={copy.standardMode} value={copy.standardValue} />
          <Metric label={copy.activeRules} value={String(activeRuleCount)} />
          <Metric label={copy.unreviewedGroups} value={String(unreviewedCount)} />
          <Metric label={copy.highRiskGroups} value={String(highRiskCount)} />
          <Metric label={copy.lastSeen} value={formatDate(lastSeenAt)} />
          <div className="md:col-span-5">
            <p className="text-xs text-muted-foreground">
              {copy.policyVersion}:{" "}
              {servedVersion ?? servedPropagation?.servedVersion ?? copy.standardFallbackVersion}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.observationsTitle}</CardTitle>
          <CardDescription>{copy.observationsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs text-muted-foreground">{copy.redactionNote}</p>
            <Button
              type="button"
              variant="outline"
              disabled={!canLoadObservations || isLoadingObservations}
              onClick={loadObservations}
            >
              {isLoadingObservations ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {isLoadingObservations ? copy.loadingObservations : copy.loadObservations}
            </Button>
          </div>
          {!observationsLoaded ? (
            <p className="text-sm text-muted-foreground">{copy.observationsDeferred}</p>
          ) : null}
          {observationLoadResult ? (
            <p
              role={observationLoadResult.ok ? "status" : "alert"}
              className={cn(
                "text-sm",
                observationLoadResult.ok ? "text-emerald-700" : "text-destructive",
              )}
            >
              {observationLoadResult.message}
            </p>
          ) : null}
          {observationsLoaded ? (
            <ObservationsTable
              canEdit={canEdit}
              copy={copy}
              groups={groups}
              onCreateRule={(group) =>
                updateDraft((policy) => addRuleFromObservation(policy, group))
              }
              onLifecycle={updateLifecycle}
            />
          ) : null}
          {lifecycleResult ? (
            <p
              role={lifecycleResult.ok ? "status" : "alert"}
              className={cn(
                "text-sm",
                lifecycleResult.ok ? "text-emerald-700" : "text-destructive",
              )}
            >
              {lifecycleResult.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{copy.rulesTitle}</CardTitle>
            <CardDescription>{copy.rulesDescription}</CardDescription>
          </div>
          <Badge variant={hasUnsavedChanges ? "outline" : "secondary"}>
            {hasUnsavedChanges ? copy.draftStatus : copy.savedStatus}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.presetsTitle}</p>
            <div className="flex flex-wrap gap-2">
              {buildRuntimeRequestPresets(copy).map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  disabled={!canEdit || isSaving}
                  onClick={() =>
                    updateDraft((policy) => ({
                      ...policy,
                      rules: [...policy.rules, createRule(preset.rule, copy)],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {copy[preset.label]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || isPreviewing}
              onClick={runPreview}
            >
              {isPreviewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {copy.validateDraft}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={() => setDraftPolicy(persistedPolicy)}
            >
              {copy.reset}
            </Button>
            <Button type="button" disabled={!canSave} onClick={savePolicy}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? copy.saving : copy.save}
            </Button>
          </div>

          <PreviewStatus
            copy={copy}
            preview={preview}
            previewError={previewError}
            isCurrent={previewIsCurrent}
          />

          {draftPolicy.rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.noRules}</p>
          ) : (
            <div className="space-y-4">
              {draftPolicy.rules.map((rule, index) => (
                <RuleEditor
                  key={rule.id}
                  copy={copy}
                  canEdit={canEdit && !isSaving}
                  rule={rule}
                  onChange={(nextRule) =>
                    updateDraft((policy) => ({
                      ...policy,
                      rules: policy.rules.map((entry, ruleIndex) =>
                        ruleIndex === index ? nextRule : entry,
                      ),
                    }))
                  }
                  onRemove={() =>
                    updateDraft((policy) => ({
                      ...policy,
                      rules: policy.rules.filter((_, ruleIndex) => ruleIndex !== index),
                    }))
                  }
                />
              ))}
            </div>
          )}

          {saveResult ? (
            <p
              role={saveResult.ok ? "status" : "alert"}
              className={cn("text-sm", saveResult.ok ? "text-emerald-700" : "text-destructive")}
            >
              {saveResult.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ObservationsTable({
  canEdit,
  copy,
  groups,
  onCreateRule,
  onLifecycle,
}: {
  canEdit: boolean;
  copy: RuntimeRequestsCopy;
  groups: RuntimeRequestObservationGroup[];
  onCreateRule: (group: RuntimeRequestObservationGroup) => void;
  onLifecycle: (group: RuntimeRequestObservationGroup, lifecycle: RuntimeRequestLifecycle) => void;
}) {
  if (!groups.length) {
    return <p className="text-sm text-muted-foreground">{copy.observationsEmpty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {[
              { key: "method", label: copy.method },
              { key: "path", label: copy.path },
              { key: "likelyType", label: copy.likelyType },
              { key: "firstSeen", label: copy.firstSeen },
              { key: "seenFromPage", label: copy.seenFromPage },
              { key: "currentAction", label: copy.currentAction },
              { key: "suggestedAction", label: copy.suggestedAction },
              { key: "risk", label: copy.risk },
              { key: "lifecycle", label: copy.lifecycle },
              { key: "actions", label: "" },
            ].map((heading) => (
              <th key={heading.key} className="px-3 py-2 font-medium">
                {heading.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, index) => (
            <tr
              key={`${group.groupingPathHash}:${group.method}:${group.shapeSignature}:${index}`}
              className="border-t border-border/60"
            >
              <td className="px-3 py-2 font-mono text-xs">{group.method}</td>
              <td className="px-3 py-2">
                <div className="font-mono text-xs">{group.path}</div>
                <div className="text-xs text-muted-foreground">{group.count}x</div>
              </td>
              <td className="px-3 py-2">{formatClassification(group.likelyType)}</td>
              <td className="px-3 py-2">
                {formatDate(group.firstSeenAt)} → {formatDate(group.lastSeenAt)}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{group.seenFromPage ?? "—"}</td>
              <td className="px-3 py-2">{group.currentAction}</td>
              <td className="px-3 py-2">{group.suggestedAction}</td>
              <td className="px-3 py-2">
                <RiskBadge risk={group.risk} />
              </td>
              <td className="px-3 py-2">{group.lifecycle}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onCreateRule(group)}
                  >
                    {copy.createRule}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onLifecycle(group, "reviewed")}
                  >
                    {copy.reviewed}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onLifecycle(group, "dismissed")}
                  >
                    {copy.dismissed}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => onLifecycle(group, "ignored")}
                  >
                    {copy.ignored}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleEditor({
  canEdit,
  copy,
  rule,
  onChange,
  onRemove,
}: {
  canEdit: boolean;
  copy: RuntimeRequestsCopy;
  rule: RuntimeRequestPolicyRule;
  onChange: (rule: RuntimeRequestPolicyRule) => void;
  onRemove: () => void;
}) {
  const methodSet = new Set(rule.methods);
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={!canEdit}
            onChange={(event) => onChange({ ...rule, enabled: event.target.checked })}
          />
          {copy.enabled}
        </label>
        <Field label={copy.name} htmlFor={`${rule.id}-name`}>
          <Input
            id={`${rule.id}-name`}
            value={rule.name}
            disabled={!canEdit}
            onChange={(event) => onChange({ ...rule, name: event.target.value })}
          />
        </Field>
        <Button type="button" variant="outline" disabled={!canEdit} onClick={onRemove}>
          <Trash2 className="mr-2 h-4 w-4" />
          {copy.removeRule}
        </Button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Field label={copy.pattern} htmlFor={`${rule.id}-pattern`}>
          <Input
            id={`${rule.id}-pattern`}
            value={rule.pattern}
            disabled={!canEdit}
            onChange={(event) => onChange({ ...rule, pattern: event.target.value })}
          />
        </Field>
        <Field label={copy.action} htmlFor={`${rule.id}-action`}>
          <select
            id={`${rule.id}-action`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rule.action}
            disabled={!canEdit}
            onChange={(event) =>
              onChange(applyActionDefaults(rule, event.target.value as RuntimeRequestPolicyAction))
            }
          >
            {(["observe", "deny", "neutralize", "proxy"] as RuntimeRequestPolicyAction[]).map(
              (action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label={copy.credentials} htmlFor={`${rule.id}-credentials`}>
          <select
            id={`${rule.id}-credentials`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rule.credentials}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({
                ...rule,
                credentials: event.target.value as RuntimeRequestPolicyRule["credentials"],
              })
            }
          >
            <option value="omit">omit</option>
            <option value="same_origin">same_origin</option>
            <option value="include">include</option>
          </select>
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{copy.methods}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {ALL_METHODS.map((method) => (
            <label key={method} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={methodSet.has(method)}
                disabled={!canEdit}
                onChange={(event) => {
                  const next = new Set(methodSet);
                  if (event.target.checked) next.add(method);
                  else next.delete(method);
                  onChange({ ...rule, methods: Array.from(next) as RuntimeRequestPolicyMethod[] });
                }}
              />
              {method}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Field label={copy.maxBodyBytes} htmlFor={`${rule.id}-body`}>
          <Input
            id={`${rule.id}-body`}
            type="number"
            min={0}
            value={rule.maxBodyBytes}
            disabled={!canEdit}
            onChange={(event) => onChange({ ...rule, maxBodyBytes: Number(event.target.value) })}
          />
        </Field>
        <Field label={copy.maxResponseBytes} htmlFor={`${rule.id}-response`}>
          <Input
            id={`${rule.id}-response`}
            type="number"
            min={0}
            value={rule.maxResponseBytes}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, maxResponseBytes: Number(event.target.value) })
            }
          />
        </Field>
        <Field label={copy.timeoutMs} htmlFor={`${rule.id}-timeout`}>
          <Input
            id={`${rule.id}-timeout`}
            type="number"
            min={1}
            value={rule.timeoutMs}
            disabled={!canEdit}
            onChange={(event) => onChange({ ...rule, timeoutMs: Number(event.target.value) })}
          />
        </Field>
        <Field label={copy.cache} htmlFor={`${rule.id}-cache`}>
          <select
            id={`${rule.id}-cache`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rule.cache}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, cache: event.target.value as RuntimeRequestPolicyRule["cache"] })
            }
          >
            <option value="no-store">no-store</option>
            <option value="edge">edge</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label={copy.requestHeaders} htmlFor={`${rule.id}-request-headers`}>
          <Input
            id={`${rule.id}-request-headers`}
            value={rule.requestHeaders.allow.join(", ")}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, requestHeaders: { allow: splitList(event.target.value) } })
            }
          />
        </Field>
        <Field label={copy.responseHeaders} htmlFor={`${rule.id}-response-headers`}>
          <Input
            id={`${rule.id}-response-headers`}
            value={rule.responseHeaders.allow.join(", ")}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, responseHeaders: { allow: splitList(event.target.value) } })
            }
          />
        </Field>
        <Field label={copy.requestContentTypes} htmlFor={`${rule.id}-request-content-types`}>
          <Input
            id={`${rule.id}-request-content-types`}
            value={rule.requestContentTypes.join(", ")}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, requestContentTypes: splitList(event.target.value) })
            }
          />
        </Field>
        <Field label={copy.responseContentTypes} htmlFor={`${rule.id}-response-content-types`}>
          <Input
            id={`${rule.id}-response-content-types`}
            value={rule.responseContentTypes.join(", ")}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...rule, responseContentTypes: splitList(event.target.value) })
            }
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label={copy.neutralization} htmlFor={`${rule.id}-neutralization`}>
          <select
            id={`${rule.id}-neutralization`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rule.neutralization.shape}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({
                ...rule,
                neutralization: neutralizationForShape(
                  event.target.value as RuntimeRequestPolicyRule["neutralization"]["shape"],
                ),
              })
            }
          >
            <option value="empty_json">empty_json</option>
            <option value="empty_text">empty_text</option>
            <option value="no_content">no_content</option>
          </select>
        </Field>
        <Field label={copy.redirectScope} htmlFor={`${rule.id}-redirect`}>
          <select
            id={`${rule.id}-redirect`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rule.redirectScope}
            disabled={!canEdit}
            onChange={(event) =>
              onChange({
                ...rule,
                redirectScope: event.target.value as RuntimeRequestPolicyRule["redirectScope"],
              })
            }
          >
            <option value="same_origin">same_origin</option>
            <option value="same_registrable_domain">same_registrable_domain</option>
          </select>
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{copy.confirmations}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {CONFIRMATIONS.map((confirmation) => (
            <label key={confirmation} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rule.confirmations.includes(confirmation)}
                disabled={!canEdit}
                onChange={(event) => {
                  const next = new Set(rule.confirmations);
                  if (event.target.checked) next.add(confirmation);
                  else next.delete(confirmation);
                  onChange({ ...rule, confirmations: Array.from(next) });
                }}
              />
              {confirmation}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function PreviewStatus({
  copy,
  preview,
  previewError,
  isCurrent,
}: {
  copy: RuntimeRequestsCopy;
  preview: RuntimeRequestPolicyPreviewResponse | null;
  previewError: string | null;
  isCurrent: boolean;
}) {
  if (previewError) {
    return <ValidationAlert title={copy.validationTitle} messages={[previewError]} />;
  }
  if (!preview || !isCurrent) {
    return (
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>{copy.previewRequired}</AlertTitle>
        <AlertDescription>{copy.previewRequired}</AlertDescription>
      </Alert>
    );
  }
  const validationMessages = [
    ...preview.validationErrors.map((error) => `${error.code}: ${error.message}`),
    ...preview.collisions.map(
      (collision) => `${collision.code}: ${collision.leftRuleId} / ${collision.rightRuleId}`,
    ),
    ...preview.highRiskConfirmations.map((entry) => `${entry.code}: ${entry.ruleId}`),
  ];
  return (
    <div className="space-y-3">
      {validationMessages.length ? (
        <ValidationAlert title={copy.validationTitle} messages={validationMessages} />
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{copy.previewReady}</AlertTitle>
          <AlertDescription>{copy.previewReady}</AlertDescription>
        </Alert>
      )}
      {preview.warnings.length ? (
        <ValidationAlert
          title={copy.warningsTitle}
          messages={preview.warnings.map((warning) => `${warning.code}: ${warning.message}`)}
        />
      ) : null}
      {preview.matchedObservationGroups.length ? (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{copy.matchedGroupsTitle}</AlertTitle>
          <AlertDescription>
            {preview.matchedObservationGroups.map((group) => group.path).join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ValidationAlert({ title, messages }: { title: string; messages: string[] }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {messages.map((message, index) => (
            <li key={`${message}:${index}`}>{message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function RiskBadge({ risk }: { risk: RuntimeRequestObservationGroup["risk"] }) {
  return (
    <Badge variant={risk === "high" ? "destructive" : risk === "medium" ? "outline" : "secondary"}>
      {risk}
    </Badge>
  );
}

function buildRuntimeRequestPresets(copy: RuntimeRequestsCopy): RuntimeRequestPreset[] {
  return [
    {
      id: "neutralize-analytics",
      label: "presetNeutralizeAnalytics",
      rule: {
        name: copy.presetNeutralizeAnalytics,
        pattern: "/analytics/*",
        methods: ["GET", "HEAD", "POST", "OPTIONS"],
        action: "neutralize",
        maxBodyBytes: 0,
        maxResponseBytes: 0,
        neutralization: neutralizationForShape("empty_json"),
      },
    },
    {
      id: "search-proxy",
      label: "presetSearchProxy",
      rule: {
        name: copy.presetSearchProxy,
        pattern: "/api/search",
        methods: ["GET", "HEAD"],
        action: "proxy",
        credentials: "omit",
        cache: "no-store",
        maxBodyBytes: 0,
        maxResponseBytes: 1_048_576,
        responseContentTypes: ["application/json"],
      },
    },
    {
      id: "feature-config-proxy",
      label: "presetFeatureConfigProxy",
      rule: {
        name: copy.presetFeatureConfigProxy,
        pattern: "/api/config",
        methods: ["GET", "HEAD"],
        action: "proxy",
        credentials: "omit",
        cache: "no-store",
        maxBodyBytes: 0,
        maxResponseBytes: 262_144,
        responseContentTypes: ["application/json"],
      },
    },
    {
      id: "route-data-proxy",
      label: "presetRouteDataProxy",
      rule: {
        name: copy.presetRouteDataProxy,
        pattern: "/_next/data/*",
        methods: ["GET", "HEAD"],
        action: "proxy",
        credentials: "omit",
        cache: "no-store",
        maxBodyBytes: 0,
        maxResponseBytes: 1_048_576,
        responseContentTypes: ["application/json"],
      },
    },
    {
      id: "form-submit-proxy",
      label: "presetFormSubmitProxy",
      rule: {
        name: copy.presetFormSubmitProxy,
        pattern: "/api/forms/*",
        methods: ["POST"],
        action: "proxy",
        credentials: "omit",
        cache: "no-store",
        maxBodyBytes: 65_536,
        maxResponseBytes: 262_144,
        requestContentTypes: ["application/json", "application/x-www-form-urlencoded"],
        responseContentTypes: ["application/json"],
        confirmations: ["non_get_proxy", "high_risk_path"],
      },
    },
  ];
}

function normalizeRuntimePolicy(policy: RuntimeRequestPolicyConfig): RuntimeRequestPolicyConfig {
  return {
    schemaVersion: 1,
    mode: "standard",
    enabled: policy.enabled !== false,
    rules: policy.rules.map((rule) => ({
      ...createRule(),
      ...rule,
      methods: rule.methods.length ? rule.methods : ["GET", "HEAD"],
      requestHeaders: { allow: rule.requestHeaders?.allow ?? [] },
      responseHeaders: { allow: rule.responseHeaders?.allow ?? [] },
      requestContentTypes: rule.requestContentTypes ?? [],
      responseContentTypes: rule.responseContentTypes ?? [],
      neutralization: rule.neutralization ?? neutralizationForShape("empty_json"),
      confirmations: rule.confirmations ?? [],
    })),
  };
}

function createRule(
  overrides: Partial<RuntimeRequestPolicyRule> = {},
  copy?: RuntimeRequestsCopy,
): RuntimeRequestPolicyRule {
  const id = overrides.id ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: overrides.name ?? copy?.defaultRuleName ?? "Runtime request rule",
    enabled: overrides.enabled ?? true,
    pattern: overrides.pattern ?? "/api/search",
    methods: overrides.methods ?? ["GET", "HEAD"],
    action: overrides.action ?? "observe",
    credentials: overrides.credentials ?? "omit",
    cache: overrides.cache ?? "no-store",
    maxBodyBytes: overrides.maxBodyBytes ?? 0,
    maxResponseBytes: overrides.maxResponseBytes ?? 1_048_576,
    timeoutMs: overrides.timeoutMs ?? 5_000,
    redirectScope: overrides.redirectScope ?? "same_origin",
    requestHeaders: overrides.requestHeaders ?? { allow: [] },
    responseHeaders: overrides.responseHeaders ?? { allow: [] },
    requestContentTypes: overrides.requestContentTypes ?? [],
    responseContentTypes: overrides.responseContentTypes ?? [],
    neutralization: overrides.neutralization ?? neutralizationForShape("empty_json"),
    confirmations: overrides.confirmations ?? [],
  };
}

function addRuleFromObservation(
  policy: RuntimeRequestPolicyConfig,
  group: RuntimeRequestObservationGroup,
): RuntimeRequestPolicyConfig {
  const suggestedProxy =
    group.suggestedAction === "proxy" && (group.method === "GET" || group.method === "HEAD");
  const action: RuntimeRequestPolicyAction = suggestedProxy ? "proxy" : group.suggestedAction;
  const confirmations: RuntimeRequestPolicyConfirmation[] =
    group.risk === "high" ? ["high_risk_path"] : [];
  return {
    ...policy,
    rules: [
      ...policy.rules,
      createRule({
        name: `${formatClassification(group.likelyType)} ${group.path}`,
        pattern: group.path,
        action,
        methods: [group.method as RuntimeRequestPolicyMethod],
        confirmations,
      }),
    ],
  };
}

function applyActionDefaults(
  rule: RuntimeRequestPolicyRule,
  action: RuntimeRequestPolicyAction,
): RuntimeRequestPolicyRule {
  if (action === "proxy") {
    return {
      ...rule,
      action,
      methods: ["GET", "HEAD"],
      credentials: "omit",
      cache: "no-store",
      maxBodyBytes: 0,
    };
  }
  if (action === "neutralize") {
    return {
      ...rule,
      action,
      methods: ["GET", "HEAD", "POST", "OPTIONS"],
      neutralization: neutralizationForShape("empty_json"),
    };
  }
  return { ...rule, action };
}

function neutralizationForShape(
  shape: RuntimeRequestPolicyRule["neutralization"]["shape"],
): RuntimeRequestPolicyRule["neutralization"] {
  if (shape === "no_content") {
    return { shape, status: 204, contentType: null, body: null };
  }
  if (shape === "empty_text") {
    return { shape, status: 200, contentType: "text/plain; charset=utf-8", body: "" };
  }
  return { shape, status: 200, contentType: "application/json", body: "{}" };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function runtimePolicyFingerprint(policy: RuntimeRequestPolicyConfig): string {
  return JSON.stringify(policy);
}

function formatClassification(value: string): string {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function extractPreviewMessage(value: unknown, copy: RuntimeRequestsCopy): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") {
      return record.error;
    }
  }
  return copy.previewErrorFallback;
}

function readSavedRuntimePolicy(meta: Record<string, unknown> | undefined) {
  const value = meta?.runtimeRequestPolicy;
  if (!isRuntimePolicyConfig(value)) {
    return null;
  }
  return value;
}

function isRuntimePolicyConfig(value: unknown): value is RuntimeRequestPolicyConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1 &&
    record.mode === "standard" &&
    typeof record.enabled === "boolean" &&
    Array.isArray(record.rules) &&
    record.rules.every(isRuntimePolicyRule)
  );
}

function isRuntimePolicyRule(value: unknown): value is RuntimeRequestPolicyRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.enabled === "boolean" &&
    typeof record.pattern === "string" &&
    isEnumArray(record.methods, POLICY_METHODS, false) &&
    typeof record.action === "string" &&
    POLICY_ACTIONS.has(record.action as RuntimeRequestPolicyAction) &&
    typeof record.credentials === "string" &&
    POLICY_CREDENTIALS.has(record.credentials) &&
    typeof record.cache === "string" &&
    POLICY_CACHE_MODES.has(record.cache) &&
    typeof record.maxBodyBytes === "number" &&
    Number.isInteger(record.maxBodyBytes) &&
    record.maxBodyBytes >= 0 &&
    typeof record.maxResponseBytes === "number" &&
    Number.isInteger(record.maxResponseBytes) &&
    record.maxResponseBytes >= 0 &&
    typeof record.timeoutMs === "number" &&
    Number.isInteger(record.timeoutMs) &&
    record.timeoutMs > 0 &&
    typeof record.redirectScope === "string" &&
    POLICY_REDIRECT_SCOPES.has(record.redirectScope) &&
    isHeaderPolicy(record.requestHeaders) &&
    isHeaderPolicy(record.responseHeaders) &&
    isStringArray(record.requestContentTypes) &&
    isStringArray(record.responseContentTypes) &&
    isRuntimePolicyNeutralization(record.neutralization) &&
    isEnumArray(record.confirmations, POLICY_CONFIRMATIONS, true)
  );
}

function isEnumArray<T extends string>(
  value: unknown,
  allowed: Set<T>,
  allowEmpty: boolean,
): value is T[] {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((entry): entry is T => typeof entry === "string" && allowed.has(entry as T))
  );
}

function isHeaderPolicy(value: unknown): value is { allow: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return isStringArray((value as Record<string, unknown>).allow);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRuntimePolicyNeutralization(
  value: unknown,
): value is RuntimeRequestPolicyRule["neutralization"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.shape === "no_content") {
    return record.status === 204 && record.contentType === null && record.body === null;
  }
  if (record.shape === "empty_text") {
    return (
      record.status === 200 &&
      record.contentType === "text/plain; charset=utf-8" &&
      record.body === ""
    );
  }
  return (
    record.shape === "empty_json" &&
    record.status === 200 &&
    record.contentType === "application/json" &&
    record.body === "{}"
  );
}

function readObservationGroups(meta: Record<string, unknown> | undefined) {
  const value = meta?.groups;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRuntimeRequestObservationGroup);
}

function isRuntimeRequestObservationGroup(value: unknown): value is RuntimeRequestObservationGroup {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.groupingPathHash === "string" &&
    typeof record.method === "string" &&
    typeof record.shapeSignature === "string" &&
    typeof record.path === "string" &&
    typeof record.firstSeenAt === "string" &&
    typeof record.lastSeenAt === "string" &&
    typeof record.lifecycle === "string"
  );
}

function readMetaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" ? value : null;
}

function readSavedPropagation(meta: Record<string, unknown> | undefined) {
  const value = meta?.runtimeRequestPolicyPropagation;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as RuntimeRequestPolicyPropagation;
}
