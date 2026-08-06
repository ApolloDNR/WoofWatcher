import { useRouter } from "expo-router";

import StoryProgressScreen from "@/components/more/StoryProgressScreen";

export default function StoryCompatibilityScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/more");
  };

  return (
    <StoryProgressScreen
      onBack={handleBack}
      onOpenAdventure={() => router.push("/adventure")}
    />
  );
}
