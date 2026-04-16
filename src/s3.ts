import * as fs from 'fs';
import type { Readable } from 'stream';
import * as core from '@actions/core';
import type { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { walk } from './file';

export interface Store {
	put: (data: Buffer | Readable, bucket: string, key: string) => Promise<void>;
}

export class S3Store implements Store {
	client: S3Client;

	constructor(client: S3Client) {
		this.client = client;
	}

	async put(
		data: Buffer | Readable,
		bucket: string,
		key: string,
	): Promise<void> {
		const upload = new Upload({
			client: this.client,
			params: {
				Body: data,
				Key: key,
				Bucket: bucket,
			},
		});

		await upload.done();
	}
}

export const sync = async (
	store: Store,
	dir: string,
	bucket: string,
	keyPrefix: string,
): Promise<void> => {
	const responses = walk(dir, (filePath: string) => {
		const data = fs.createReadStream(filePath);
		const key = keyPrefix + filePath.substring(dir.length);

		core.info(`s3 sync: ${filePath} -> ${key}`);
		return store.put(data, bucket, key);
	});

	await Promise.all(responses);
};
