import { main } from ".";
import { walk } from "./file/file";
import * as yaml from "js-yaml";
import * as child_process from "child_process";

// Read yaml config and set env vars to mimic GHA
const readConfig = (yamlConfig: string): void => {
  const config = yaml.load(yamlConfig) as object;
  Object.entries(config).forEach(([k, v]) => {
    const name = `INPUT_${k.replace(/ /g, "_").toUpperCase()}`;
    process.env[name] = v;
  });

  // process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || ''
};

describe("action", () => {
  it("should generate expected file structure", () => {
    // Note, don't check contents here as other tests capture that

    // TODO convert automaatically to process.env vars
    const input = `dryRun: true
app: foo
stack: deploy
deployments: |
  upload:
    type: aws-s3
    sources: test-data
    parameters:
      bucket: aws-some-bucket
      cacheControl: private
      publicReadAcl: false`;

    const staging = "staging";

    const want = [
      `${staging}/riff-raff.yaml`,
      `${staging}/build.json`,
      `${staging}/upload/foo.txt`,
    ];

    child_process.execSync("mkdir test-data");
    child_process.execSync("touch test-data/foo.txt");

    readConfig(input);
    main();

    const got = walk(staging, (path: string) => path);

    expect(got.sort()).toEqual(want.sort());

    child_process.execSync("rm -rf test-data");
  });
});
