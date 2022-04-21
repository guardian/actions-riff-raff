import * as core from "@actions/core";
import * as yaml from "js-yaml";
import { S3Store, sync } from "./s3/s3";
import { S3Client } from "@aws-sdk/client-s3";
import type { Deployment } from "./riffraff/riffraff";
import { riffraffYaml, riffraffPrefix, manifest } from "./riffraff/riffraff";
import { write, cp, printDir } from "./file/file";

export const main = () => {
  const app = core.getInput("app");
  const stack = core.getInput("stack");
  const projectName = core.getInput("projectName");
  const dryRun = core.getInput("dryRun");
  const deploymentsYaml = core.getInput("deployments");
  const deploymentsObj = yaml.load(deploymentsYaml);

  core.info(
    `Inputs are: dryRun: ${dryRun}; app: ${app}; stack: ${stack}; deployments: ${JSON.stringify(
      deploymentsObj
    )}`
  );

  const deployments: Deployment[] = Object.entries(
    deploymentsObj as object
  ).map(([name, data]) => {
    const { sources, ...rest } = data;

    return {
      name: name,
      sources: (sources as string).split(","),
      data: rest,
    };
  });

  const rrYaml = riffraffYaml(stack, deployments);
  const mfest = manifest(app, stack, projectName);
  const manifestJSON = JSON.stringify(mfest);

  const stagingDir = "staging";

  write(`${stagingDir}/riff-raff.yaml`, rrYaml);
  write(`${stagingDir}/build.json`, manifestJSON);

  deployments.forEach((deployment) => {
    cp(deployment.sources, `${stagingDir}/${deployment.name}`);
  });

  if (dryRun) {
    core.info("Output (dryRun=true):");
    core.info(printDir(stagingDir));
    return;
  }

  const store = new S3Store(new S3Client({ region: "eu-west-1" }));
  const keyPrefix = riffraffPrefix(mfest);

  store.put(manifestJSON, "riffraff-builds", keyPrefix + "/build.json");
  sync(store, stagingDir, "riffraff-artifacts", keyPrefix);

  core.info("Upload complete. The following files were sent:");
  core.info(printDir(stagingDir));
};

try {
  // execute only if invoked as main script (rather than test)
  if (require.main === module) main();
} catch (e) {
  const error = e as Error;
  core.error(error);
  core.setFailed(error.message);
}
