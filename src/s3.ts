import * as fs from 'fs';
import * as core from '@actions/core';
import type { PutObjectCommandOutput, S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { walk } from './file';

export class S3Store {
	client: S3Client;

	constructor(client: S3Client) {
		this.client = client;
	}

	async put(
		data: Buffer,
		bucket: string,
		key: string,
	): Promise<PutObjectCommandOutput> {
		const cmd = new PutObjectCommand({
			Body: data,
			Key: key,
			Bucket: bucket,
		});

		return this.client.send(cmd);
	}
}

export const sync = async (
	store: S3Store,
	dir: string,
	bucket: string,
	keyPrefix: string,
) => {
	const responses = walk(dir, (filePath: string) => {
		const data = fs.readFileSync(filePath);
		const key = keyPrefix + filePath.substring(dir.length);

		core.info(`s3 sync: ${filePath} -> ${key}`);
		return store.put(data, bucket, key);
	});

	const res = await Promise.allSettled(responses);

	const errors = res.filter((r) => r.status === 'rejected');
	console.log(errors);

	return res.filter((r) => r.status === 'fulfilled');
};
