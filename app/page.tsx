import SceneLoader from "@/components/scene/SceneLoader";
import DebugPanel from "@/components/ui/DebugPanel";
import HoverLabel from "@/components/ui/HoverLabel";
import InfoPanel from "@/components/ui/InfoPanel";
import LoadingScreen from "@/components/ui/LoadingScreen";
import SoundController from "@/components/ui/SoundController";
import MetricsHUD from "@/components/ui/MetricsHUD";
import ScenarioPanel from "@/components/ui/ScenarioPanel";
import SimulationPanel from "@/components/ui/SimulationPanel";
import Toolbar from "@/components/ui/Toolbar";
import TourPanel from "@/components/ui/TourPanel";
import WalkOverlay from "@/components/ui/WalkOverlay";
import ZoneNavigator from "@/components/ui/ZoneNavigator";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0a0c10]">
      <SceneLoader />
      <Toolbar />
      <ZoneNavigator />
      <SimulationPanel />
      <ScenarioPanel />
      <TourPanel />
      <WalkOverlay />
      <SoundController />
      <LoadingScreen />
      <MetricsHUD />
      <InfoPanel />
      <HoverLabel />
      <DebugPanel />
    </main>
  );
}
