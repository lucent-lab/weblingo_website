import { type CustomerDeploymentHistoryResponse } from "@internal/dashboard/webhooks";
import { Badge } from "@/components/ui/badge";

type DeploymentHistoryTableProps = {
  history: CustomerDeploymentHistoryResponse;
  locale?: string;
};

type HistoryRow = {
  targetLang: string;
  title: string;
  status: string;
  createdAt?: string | null;
  publishedAt?: string | null;
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
            <th className="px-3 py-2 text-left">Event</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Published</th>
            <th className="px-3 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.targetLang}-${row.status}-${row.createdAt ?? row.publishedAt ?? index}:${index}`}
            >
              <td className="px-3 py-3 align-top font-semibold text-foreground">
                {row.targetLang.toUpperCase()}
              </td>
              <td className="px-3 py-3 align-top text-foreground">{row.title}</td>
              <td className="px-3 py-3 align-top">
                <Badge variant="outline">{row.status}</Badge>
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {formatTimestamp(row.publishedAt, dateFormatter)}
              </td>
              <td className="px-3 py-3 align-top text-muted-foreground">
                {formatTimestamp(row.createdAt, dateFormatter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function flattenHistoryRows(history: CustomerDeploymentHistoryResponse): HistoryRow[] {
  return history.entries.map((entry) => ({
    targetLang: history.targetLang,
    title: entry.titleKey,
    status: entry.customerStatus,
    createdAt: entry.createdAt ?? null,
    publishedAt: entry.publishedAt ?? null,
  }));
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
