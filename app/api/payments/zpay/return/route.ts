import { paymentReturnOrigin, publicSiteOrigin } from "@/lib/server/payments";

// Browser return after paying on the provider page. Navigation only: it never
// marks an order paid. The open checkout dialog keeps polling the order.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const site = publicSiteOrigin() || url.origin;
  const host = request.headers.get("host") || url.host;
  const origin = paymentReturnOrigin(`${url.protocol}//${host}`, site);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${origin}/?payment=return`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
