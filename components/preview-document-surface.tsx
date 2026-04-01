import type { ReactNode } from "react";

import { CardContent } from "@/components/ui/card";

type PreviewDocumentSurfaceProps = {
  previewHtml: string;
  previewTitle: string;
  children?: ReactNode;
};

export function PreviewDocumentSurface({
  previewHtml,
  previewTitle,
  children,
}: PreviewDocumentSurfaceProps) {
  return (
    <CardContent className="relative h-full p-0">
      <iframe
        title={previewTitle}
        className="h-full w-full border-0 bg-background"
        srcDoc={previewHtml}
        sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
      />
      {children}
    </CardContent>
  );
}
