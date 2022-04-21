import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { walk } from "../file/file";
import * as fs from "fs";
import * as core from "@actions/core";
export interface Store {
  put: (data: string, bucket: string, key: string) => Promise<void>;
}

export class S3Store implements Store {
  client: S3Client;

  constructor(client: S3Client) {
    this.client = client;
  }

  async put(data: string, bucket: string, key: string): Promise<void> {
    const cmd = new PutObjectCommand({
      Body: data,
      Key: key,
      Bucket: bucket,
    });

    await this.client.send(cmd);
  }
}

export const sync = async (
  store: Store,
  dir: string,
  bucket: string,
  keyPrefix: string
): Promise<void> => {
  const responses = walk(dir, (filePath: string) => {
    const data = fs.readFileSync(filePath).toString("utf-8");
    const key = keyPrefix + "/" + filePath.substring(dir.length);

    core.info(`s3 sync: ${filePath} -> ${key}`);
    return store.put(data, bucket, key);
  });

  await Promise.all(responses);
};
