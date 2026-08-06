import { useRouter } from "expo-router";

import AvatarStudioScreen from "@/components/more/AvatarStudioScreen";

export default function PortraitCompatibilityScreen() {
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  };

  return (
    <AvatarStudioScreen
      surface="standalone"
      onBack={handleBack}
      onOpenSpriteQa={() =>
        router.push({
          pathname: "/care-twin-qa",
          params: { qaSurface: "avatar-sprite-production-review" },
        })
      }
    />
  );
}
