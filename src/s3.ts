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

export async function putObject(
	client: S3Client,
	props: PutObjectRequest,
): Promise<void> {
	const { bucket, key, content, tags } = props;

	const cmd = new PutObjectCommand({
		Body: content,
		Key: key,
		Bucket: bucket,
		Tagging: new URLSearchParams(tags).toString(),
	});

	await client.send(cmd);
}

export async function putDirectory(
	client: S3Client,
	props: PutDirectoryRequest,
) {
	const { bucket, keyPrefix, localDir, tags } = props;

	const responses = walk(localDir, (filePath: string) => {
		const data = fs.readFileSync(filePath);
		const key = keyPrefix + filePath.substring(localDir.length);

		core.info(`s3 sync: ${filePath} -> ${key}`);
		return putObject(client, {
			bucket,
			key,
			content: data,
			tags,
		});
	});

	await Promise.all(responses);
}
