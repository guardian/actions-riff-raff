import * as fs from 'fs';
import * as core from '@actions/core';
import type { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { walk } from './file';

export class S3Store {
	private client: S3Client;

	constructor(client: S3Client) {
		this.client = client;
	}

	async putObject(bucket: string, key: string, data: Buffer): Promise<void> {
		const cmd = new PutObjectCommand({
			Body: data,
			Key: key,
			Bucket: bucket,
		});

		await this.client.send(cmd);
	}

	async putDirectory(bucket: string, keyPrefix: string, localDir: string) {
		const responses = walk(localDir, (filePath: string) => {
			const data = fs.readFileSync(filePath);
			const key = keyPrefix + filePath.substring(localDir.length);

			core.info(`s3 sync: ${filePath} -> ${key}`);
			return this.putObject(bucket, key, data);
		});

		await Promise.all(responses);
	}
}
