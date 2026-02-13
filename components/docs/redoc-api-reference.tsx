"use client";

import isPropValid from "@emotion/is-prop-valid";
import dynamic from "next/dynamic";
import { StyleSheetManager } from "styled-components";

import featureCatalog from "@/content/docs/_generated/backend-feature-catalog.snapshot.json";
import openApiSpec from "@/content/docs/_generated/backend-openapi.snapshot.json";

import {
  buildUserFacingOpenApiSpec,
  type FeatureCatalog,
  type OpenApiSpec,
} from "./api-reference-data";

const RedocStandalone = dynamic(() => import("redoc").then((module) => module.RedocStandalone), {
  ssr: false,
  loading: () => (
    <p className="px-4 py-3 text-sm text-muted-foreground">Loading API reference...</p>
  ),
});

const userFacingSpec = buildUserFacingOpenApiSpec(
  openApiSpec as unknown as OpenApiSpec,
  featureCatalog as unknown as FeatureCatalog,
);

const redocOptions = {
  hideDownloadButton: true,
  hideHostname: false,
  pathInMiddlePanel: true,
  requiredPropsFirst: true,
  sortPropsAlphabetically: true,
  sortOperationsAlphabetically: true,
  sortTagsAlphabetically: true,
  nativeScrollbars: true,
  disableSearch: false,
  hideFab: true,
  onlyRequiredInSamples: false,
} as const;

function shouldForwardProp(propName: string, target: unknown): boolean {
  if (typeof target === "string") {
    return isPropValid(propName);
  }
  return true;
}

export function RedocApiReference() {
  return (
    <div className="weblingo-redoc rounded-lg border border-border bg-card p-1">
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>
        <RedocStandalone spec={userFacingSpec} options={redocOptions} />
      </StyleSheetManager>
    </div>
  );
}
