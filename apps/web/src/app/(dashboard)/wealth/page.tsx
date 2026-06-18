import { redirect } from "next/navigation";

// The Wealth feature is currently disabled. The route redirects to the
// dashboard so existing/bookmarked links do not 404. To re-enable, restore the
// previous implementation from git history and re-add the sidebar nav item.
export default function WealthPage() {
  redirect("/dashboard");
}
