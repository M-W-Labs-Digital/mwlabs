import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const canonicalSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.BETTER_AUTH_URL?.startsWith("http") ? process.env.BETTER_AUTH_URL : undefined) ??
  "https://mwlabs.digital";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteUrl),
  title: {
    default: "M&W Labs — Build. Market. Automate. Grow.",
    template: "%s · M&W Labs",
  },
  description:
    "M&W Labs builds websites, software, brands, campaigns, content, and AI automation that drive measurable growth.",
  keywords: [
    "agency management",
    "CRM",
    "project management",
    "agency finance",
    "AI operations",
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#011645",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NWPRZP2H');`}
        </Script>
        {/* End Google Tag Manager */}
      </head>
      <body id="top" className="min-h-full">
        {/* Google Tag Manager (noscript) */}
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NWPRZP2H" height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
        {/* End Google Tag Manager (noscript) */}
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
