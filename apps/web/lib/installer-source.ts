import { readFile } from "node:fs/promises";
import path from "node:path";

const installerSourcePath = path.join(process.cwd(), "public", "install.sh");

export async function readInstallerSource(): Promise<string> {
  return readFile(installerSourcePath, "utf8");
}
