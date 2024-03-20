import * as fs from 'fs';
import * as core from '@actions/core';
import type { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { walk } from './file';

type RiffRaffBucket = 'riffraff-artifact' | 'riffraff-builds';

interface PutObjectRequest {
	bucket: RiffRaffBucket;
	key: string;
	content: Buffer;
	tags: Record<string, string>;
}

interface PutDirectoryRequest {
	bucket: RiffRaffBucket;
	keyPrefix: string;
	localDir: string;
	tags: Record<string, string>;
}

export class S3Store {
	private client: S3Client;

	constructor(client: S3Client) {
		this.client = client;
	}

	async putObject(props: PutObjectRequest): Promise<void> {
		const { bucket, key, content, tags } = props;

		const cmd = new PutObjectCommand({
			Body: content,
			Key: key,
			Bucket: bucket,
			Tagging: new URLSearchParams(tags).toString(),
		});

		await this.client.send(cmd);
	}

	async putDirectory(props: PutDirectoryRequest) {
		const { bucket, keyPrefix, localDir, tags } = props;

		const responses = walk(localDir, (filePath: string) => {
			const data = fs.readFileSync(filePath);
			const key = keyPrefix + filePath.substring(localDir.length);

			core.info(`s3 sync: ${filePath} -> ${key}`);
			return this.putObject({
				bucket,
				key,
				content: data,
				tags,
			});
		});

		await Promise.all(responses);
	}
}
