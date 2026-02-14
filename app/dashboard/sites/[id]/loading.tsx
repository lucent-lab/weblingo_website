import { Card, CardContent, CardHeader } from "@/components/ui/card";

function PulseBar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function SiteRouteLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <PulseBar className="h-8 w-72" />
        <PulseBar className="h-4 w-56" />
      </div>

      <Card>
        <CardHeader>
          <PulseBar className="h-6 w-40" />
          <PulseBar className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <PulseBar className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <PulseBar className="h-6 w-48" />
          <PulseBar className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <PulseBar className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
