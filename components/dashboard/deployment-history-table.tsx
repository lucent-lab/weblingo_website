import { type DeploymentHistoryByLocale } from "@internal/dashboard/webhooks";
import { Badge } from "@/components/ui/badge";

type DeploymentHistoryTableProps = {
  history: DeploymentHistoryByLocale[];
  locale?: string;
};

type HistoryRow = {
  targetLang: string;
  deploymentId: string;
  status: string;
  activatedAt?: string | null;
  createdAt?: string | null;
  routePrefix?: string | null;
};

export function DeploymentHistoryTable({ history, locale = "en" }: DeploymentHistoryTableProps) {
  const rows = flattenHistoryRows(history);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No deployment history yet.</p>;
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Locale</th>
            <th className="px-3 py-2 text-left">Deployment</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Activated</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Route</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.targetLang}-${row.deploymentId}`}>
              <td className="px-3 py-3 align-top font-semibold text-foreground">
                {row.targetLang.toUpperCase()}
              </td>
              <td className="px-3 py-3 align-top font-mono text-foreground">{row.deploymentId}</td>
              <td className="px-3 py-3 align-top">
                <Badge variant="outline">{row.status}</Badge>
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {formatTimestamp(row.activatedAt, dateFormatter)}
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {formatTimestamp(row.createdAt, dateFormatter)}
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {row.routePrefix && row.routePrefix.length ? row.routePrefix : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function flattenHistoryRows(history: DeploymentHistoryByLocale[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const localeHistory of history) {
    for (const entry of localeHistory.entries) {
      rows.push({
        targetLang: localeHistory.targetLang,
        deploymentId: entry.deploymentId,
        status: entry.status,
        activatedAt: entry.activatedAt ?? null,
        createdAt: entry.createdAt ?? null,
        routePrefix: entry.routePrefix ?? null,
      });
    }
  }
  return rows;
}

function formatTimestamp(value: string | null | undefined, formatter: Intl.DateTimeFormat): string {
  if (!value || !value.length) {
    return "-";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return formatter.format(new Date(parsed));
}
