import SocialComposer from "@/components/content/SocialComposer";
import { ContentView } from "@/components/dashboards/Dashboards";

export default function Page() {
  return (
    <div className="space-y-8">
      <SocialComposer />
      <ContentView />
    </div>
  );
}
