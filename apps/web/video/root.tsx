import { Composition } from "remotion";
import { InstallationFilm } from "./installation-film";

export function RemotionRoot() {
  return (
    <Composition
      id="TailHomeInstall"
      component={InstallationFilm}
      durationInFrames={720}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
