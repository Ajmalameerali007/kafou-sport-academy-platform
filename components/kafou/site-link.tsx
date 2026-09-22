import type { ComponentProps } from "react";
/** Native navigation keeps the small public site resilient across server deployments. */
export default function SiteLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
