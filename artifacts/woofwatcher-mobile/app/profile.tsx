import { useRouter } from "expo-router";

import DogProfileScreen from "@/components/more/DogProfileScreen";

export default function ProfileCompatibilityScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  return (
    <DogProfileScreen
      surface="standalone"
      onBack={handleBack}
      onOpenAvatarStudio={() => router.push("/portrait")}
    />
  );
}
