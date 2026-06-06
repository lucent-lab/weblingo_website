"use client";

import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

import {
  captureAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@internal/analytics/client";

type AnalyticsTrackedLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  event: AnalyticsEventName;
  analyticsProperties?: AnalyticsProperties;
  external?: boolean;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

function shouldRenderExternalLink(href: string, external?: boolean): boolean {
  if (external) {
    return true;
  }

  return /^[a-z]+:/i.test(href);
}

export const AnalyticsTrackedLink = forwardRef<HTMLAnchorElement, AnalyticsTrackedLinkProps>(
  function AnalyticsTrackedLink(
    { analyticsProperties, event, external, href, onClick, prefetch, replace, scroll, ...rest },
    ref,
  ) {
    const handleClick = (clickEvent: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(clickEvent);

      if (clickEvent.defaultPrevented) {
        return;
      }

      captureAnalyticsEvent(event, analyticsProperties, { sendInstantly: true });
    };

    if (shouldRenderExternalLink(href, external)) {
      return <a {...rest} ref={ref} href={href} onClick={handleClick} />;
    }

    return (
      <Link
        {...rest}
        href={href}
        onClick={handleClick}
        prefetch={prefetch}
        ref={ref}
        replace={replace}
        scroll={scroll}
      />
    );
  },
);
