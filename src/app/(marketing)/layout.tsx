import { FloatingActions } from "@/components/marketing/floating-actions";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingEffects } from "@/components/marketing/marketing-effects";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { WebMcpTools } from "@/components/marketing/webmcp-tools";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh overflow-x-clip bg-background">
      <MarketingEffects />
      <MarketingHeader />
      <WebMcpTools />
      <main>{children}</main>
      <MarketingFooter />
      <FloatingActions />
    </div>
  );
}
