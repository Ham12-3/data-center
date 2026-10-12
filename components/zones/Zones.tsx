import type { ReactNode } from "react";
import { ScreenRefresher } from "@/components/simulation/ScreenRefresher";
import { CoolingPlant } from "./CoolingPlant";
import { DataHallA } from "./DataHallA";
import { DataHallB } from "./DataHallB";
import { FireRoom } from "./FireRoom";
import { MeetMeRoom } from "./MeetMeRoom";
import { NOC } from "./NOC";
import { PowerRooms } from "./PowerRooms";
import { Security } from "./Security";

/** All interior rooms and their equipment. Mounted only when the interior is visible. */
export function Zones(): ReactNode {
  return (
    <group>
      <DataHallA />
      <DataHallB />
      <MeetMeRoom />
      <FireRoom />
      <CoolingPlant />
      <PowerRooms />
      <Security />
      <NOC />
      <ScreenRefresher />
    </group>
  );
}
