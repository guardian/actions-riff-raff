import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { walk } from "../file/file";
import * as fs from "fs";

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
    return store.put(
      data,
      bucket,
      keyPrefix + "/" + filePath.substring(dir.length)
    );
  });

  await Promise.all(responses);
};
