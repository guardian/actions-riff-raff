import * as core from "@actions/core";
import * as yaml from "js-yaml";
import { S3Store, sync } from "./s3/s3";
import { S3Client } from "@aws-sdk/client-s3";
import type { Deployment, RiffraffYaml } from "./riffraff/riffraff";
import { riffraffPrefix, manifest } from "./riffraff/riffraff";
import { read, write, cp, printDir } from "./file/file";
import { deleteRecursively } from "./deleteRecursively/deleteRecursively";

const readConfigFile = (path: string): object => {
  const data = read(path);
  return yaml.load(data) as object;
};

const defaultProjectName = (app: string, stacks: string[]): string => {
  if (stacks.length < 1) {
    throw new Error("Must provide at least one stack.");
  }

  return `${stacks[0]}::${app}`;
};

export const main = async (): Promise<void> => {
  const app = core.getInput("app", { required: true });
  const config = core.getInput("config");
  const configPath = core.getInput("configPath");
  const projectName = core.getInput("projectName");
  const dryRun = core.getInput("dryRun");

  if (!config && !configPath) {
    throw new Error("Must specify either config or configPath.");
  }

  const configObj = (
    config ? yaml.load(config) : readConfigFile(configPath)
  ) as RiffraffYaml;
  core.info(
    `Inputs are: dryRun: ${dryRun}; app: ${app}; config: ${JSON.stringify(
      configObj
    )}}`
  );

  const deployments: Deployment[] = Object.entries(configObj.deployments).map(
    ([name, data]) => {
      const { sources, ...rest } = data;

      return {
        name: name,
        sources: (sources as string[]).map((source) => source.trim()),
        data: rest,
      };
    }
  );

  // ensure sources doesn't end up in rrYaml as RiffRaff errors with unexpected fields
  const rrObj = deleteRecursively(configObj, "sources");
  const rrYaml = yaml.dump(rrObj);

  const name = projectName
    ? projectName
    : defaultProjectName(app, configObj.stacks);
  const mfest = manifest(name);
  const manifestJSON = JSON.stringify(mfest);

  const stagingDir = "staging";

  core.info("writting rr yaml...");
  write(`${stagingDir}/riff-raff.yaml`, rrYaml);

  deployments.forEach((deployment: Deployment) => {
    cp(deployment.sources, `${stagingDir}/${deployment.name}`);
  });

  if (dryRun) {
    core.info("Output (dryRun=true):");
    core.info(printDir(stagingDir));
    return;
  }

  const store = new S3Store(new S3Client({ region: "eu-west-1" }));
  const keyPrefix = riffraffPrefix(mfest);

  core.info(`S3 prefix: ${keyPrefix}`);

  await store.put(
    Buffer.from(manifestJSON, "utf8"),
    "riffraff-builds",
    keyPrefix + "/build.json"
  );
  await sync(store, stagingDir, "riffraff-artifact", keyPrefix);

  core.info("Upload complete.");
};

try {
  // execute only if invoked as main script (rather than test)
  if (require.main === module) main();
} catch (e) {
  const error = e as Error;
  core.error(error);
  core.setFailed(error.message);
}
