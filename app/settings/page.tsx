import ConfigEditor from "@/components/ConfigEditor";
import { PageTitle } from "@/components/ui";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Funding Pulse" };

export default async function SettingsPage() {
  const loaded = await getConfig();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title="Mandate settings"
        description="Your target sectors, preferred stages and watchlist. Saved to the database, so they persist across sessions and devices. Ranking, mandate matches and alerts update as soon as you save; no refresh is needed."
      />
      <ConfigEditor initial={loaded} />
    </div>
  );
}
