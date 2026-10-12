import ConfigEditor from "@/components/ConfigEditor";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Startup Funding Pulse" };

export default async function SettingsPage() {
  const loaded = await getConfig();

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Settings</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">What should the digest watch?</h1>
      <p className="mt-2 max-w-xl text-muted">
        Deals in your focus sectors and stages are ranked to the top of every Monday brief. Any
        announcement mentioning a watchlist company is flagged. Changes apply on the next refresh.
      </p>
      <ConfigEditor initial={loaded} />
    </div>
  );
}
