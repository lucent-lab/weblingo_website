"use client";

import {
  upsertConsistencyCpmEntryAction,
  updateConsistencyBlockAction,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/dashboard/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ConsistencyBlock,
  ConsistencyCpmEntry,
  ConsistencyOverrideHygieneWarning,
} from "@internal/dashboard/webhooks";

type ConsistencyManagerProps = {
  siteId: string;
  sourceLang: string;
  targetLang: string;
  canMutate: boolean;
  cpmEntries: ConsistencyCpmEntry[];
  blocks: ConsistencyBlock[];
  overrideWarnings: ConsistencyOverrideHygieneWarning[];
};

export function ConsistencyManager({
  siteId,
  sourceLang,
  targetLang,
  canMutate,
  cpmEntries,
  blocks,
  overrideWarnings,
}: ConsistencyManagerProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Canonical phrases</CardTitle>
          <CardDescription>
            Edit canonical targets/status for short phrases in{" "}
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
              {targetLang}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cpmEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No canonical phrase entries found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Content ID</th>
                    <th className="px-3 py-2 text-left font-medium">Target</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Occurrences</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cpmEntries.map((entry) => (
                    <tr key={entry.id} className="border-t align-top">
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {entry.contentId}
                      </td>
                      <td className="px-3 py-3">
                        <ActionForm
                          action={upsertConsistencyCpmEntryAction}
                          loading="Saving canonical phrase..."
                          success="Canonical phrase saved."
                          error="Unable to save canonical phrase."
                          className="grid gap-2"
                        >
                          <input name="siteId" type="hidden" value={siteId} />
                          <input name="sourceLang" type="hidden" value={sourceLang} />
                          <input name="targetLang" type="hidden" value={targetLang} />
                          <input name="contentId" type="hidden" value={entry.contentId} />
                          <input name="scope" type="hidden" value={entry.scope} />
                          <Input
                            aria-label={`Canonical target for ${entry.contentId}`}
                            defaultValue={entry.targetText}
                            disabled={!canMutate}
                            name="targetText"
                            required
                          />
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Canonical status for ${entry.contentId}`}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                              defaultValue={entry.status}
                              disabled={!canMutate}
                              name="status"
                            >
                              <option value="proposed">proposed</option>
                              <option value="approved">approved</option>
                              <option value="frozen">frozen</option>
                            </select>
                            <div className="ml-auto">
                              <Button disabled={!canMutate} size="sm" type="submit">
                                Save
                              </Button>
                            </div>
                          </div>
                        </ActionForm>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={entry.status === "approved" ? "default" : "secondary"}>
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{entry.occurrencesCount}</td>
                      <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                        {entry.scope}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consistency blocks</CardTitle>
          <CardDescription>
            Approve/freeze block policies and normalize member ordering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks detected yet.</p>
          ) : (
            <div className="space-y-4">
              {blocks.map((block) => (
                <div key={block.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{block.blockType}</h3>
                    <Badge variant={block.status === "approved" ? "default" : "secondary"}>
                      {block.status}
                    </Badge>
                    <Badge variant="outline">{block.mode}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {block.members.length} members
                    </span>
                  </div>
                  <ActionForm
                    action={updateConsistencyBlockAction}
                    loading="Updating block..."
                    success="Block updated."
                    error="Unable to update block."
                    className="grid gap-3"
                  >
                    <input name="siteId" type="hidden" value={siteId} />
                    <input name="blockId" type="hidden" value={block.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={block.status}
                          disabled={!canMutate}
                          name="status"
                        >
                          <option value="proposed">proposed</option>
                          <option value="approved">approved</option>
                          <option value="frozen">frozen</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-muted-foreground">Mode</span>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={block.mode}
                          disabled={!canMutate}
                          name="mode"
                        >
                          <option value="strict">strict</option>
                          <option value="prefer">prefer</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm md:col-span-1">
                        <span className="text-muted-foreground">Member content IDs</span>
                        <Input
                          defaultValue={block.members.map((member) => member.contentId).join(", ")}
                          disabled={!canMutate}
                          name="membersCsv"
                          placeholder="cid_one, cid_two"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <Button disabled={!canMutate} size="sm" type="submit">
                        Save block
                      </Button>
                    </div>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override hygiene warnings</CardTitle>
          <CardDescription>
            Context-scoped overrides that conflict with approved/frozen canonicals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overrideWarnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active override conflicts.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Context</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Override</th>
                    <th className="px-3 py-2 text-left font-medium">Canonical</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideWarnings.map((warning) => (
                    <tr
                      key={`${warning.segmentId}:${warning.contextHashScope}`}
                      className="border-t"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {warning.contextHashScope}
                      </td>
                      <td className="px-3 py-3">{warning.sourceText}</td>
                      <td className="px-3 py-3 text-amber-700">{warning.overrideText}</td>
                      <td className="px-3 py-3">{warning.canonicalTargetText}</td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary">{warning.canonicalStatus}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
