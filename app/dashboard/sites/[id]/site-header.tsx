import Link from "next/link";
import { Info } from "lucide-react";

import { updateSiteStatusAction } from "../../actions";

import { SiteStatusToggleForm } from "@/components/dashboard/site-status-toggle-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Site } from "@internal/dashboard/webhooks";

export function SiteHeader({
  site,
  canEdit,
  canPauseTranslations,
  canResumeTranslations,
  deactivateLabel,
  reactivateLabel,
  deactivateConfirm,
  activateHelpLabel,
  activateHelp,
}: {
  site: Site;
  canEdit: boolean;
  canPauseTranslations: boolean;
  canResumeTranslations: boolean;
  deactivateLabel: string;
  reactivateLabel: string;
  deactivateConfirm: string;
  activateHelpLabel: string;
  activateHelp: string;
}) {
  const verifiedDomains = site.domains.filter((domain) => domain.status === "verified").length;
  const isActive = site.status === "active";
  const canToggleStatus = isActive ? canPauseTranslations : canResumeTranslations;
  const nextStatus = isActive ? "inactive" : "active";
  const toggleLabel = isActive ? deactivateLabel : reactivateLabel;
  const showInlineActivate = !isActive && (canToggleStatus || canEdit);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{site.sourceUrl}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={site.status} />
          {showInlineActivate ? (
            <div className="flex items-center gap-2">
              {canToggleStatus ? (
                <SiteStatusToggleForm
                  confirmMessage={isActive ? deactivateConfirm : undefined}
                  disabled={!canToggleStatus}
                  label={toggleLabel}
                  nextStatus={nextStatus}
                  siteId={site.id}
                  action={updateSiteStatusAction}
                  size="sm"
                  variant="default"
                />
              ) : canEdit ? (
                <Button disabled size="sm" variant="default">
                  {toggleLabel}
                </Button>
              ) : null}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    aria-label={activateHelpLabel}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    size="icon"
                    variant="ghost"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-w-xs text-sm text-muted-foreground">
                  {activateHelp}
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
          <span>{verifiedDomains} verified domain(s)</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isActive ? (
          canToggleStatus ? (
            <SiteStatusToggleForm
              confirmMessage={isActive ? deactivateConfirm : undefined}
              disabled={!canToggleStatus}
              label={toggleLabel}
              nextStatus={nextStatus}
              siteId={site.id}
              action={updateSiteStatusAction}
            />
          ) : canEdit ? (
            <Button disabled variant="outline">
              {toggleLabel}
            </Button>
          ) : null
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/dashboard/sites/${site.id}/admin`}>Settings</Link>
        </Button>
        <Button asChild variant="link">
          <Link href="/dashboard/sites">Back to list</Link>
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  return <Badge variant="outline">Inactive</Badge>;
}
