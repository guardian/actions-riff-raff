
import { createHash } from "node:crypto";
import * as core from '@actions/core';
import { attest } from "sigstore";
import { read, walk } from "./file";

/**
 * Walk through our riff-raff artifacts directory and generate a list of file names and hashes. Returns a sigstore bundle
 * using this list as a payload which riff-raff can use to validate that a specific build was created by a Guardian repo
 * and no files have been tampered with.
 *
 * @param stagingDir - The directory being uploaded to the riffraff-artifacts bucket
 * @param buildManifest - The manifest that will eventually form the build.json file
 * @returns a sigstore bundle
 */
export const attestArtifacts = async (stagingDir: string, buildManifest: string) => {
  const start = Date.now();
  const sha256 = createHash("sha256");
  const hashes: Record<string, string> = {
    "build.json": sha256.copy().update(buildManifest).digest("base64"),
  };

  walk(stagingDir, (path) => hashes[path] = sha256.copy().update(read(path)).digest("base64"));

  const bundle = await attest(
    Buffer.from(JSON.stringify(hashes)),
    "application/json"
  );

  core.debug(`Attesting artifacts took ${Date.now() - start}ms`);
  core.debug(JSON.stringify(bundle));

  return bundle;
}
