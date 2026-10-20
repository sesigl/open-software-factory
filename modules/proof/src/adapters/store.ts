// Uploads a bundle to an S3-compatible store, signed with AWS Signature V4 by aws4fetch (ADR 0028).
import { AwsClient } from "aws4fetch";

export interface StoreConfig {
  endpoint: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Puts each file at `<prefix>/<path>` in the bucket of `s3://<bucket>/<prefix>` and returns the URL of each. */
export async function upload(
  target: string,
  config: StoreConfig,
  files: { path: string; body: Buffer; mediaType: string }[],
): Promise<Map<string, string>> {
  const match = /^s3:\/\/([^/]+)\/?(.*)$/.exec(target);
  if (!match) throw new Error(`--store needs s3://<bucket>/<prefix>, not ${target}`);
  const [, bucket, prefix] = match as unknown as [string, string, string];
  const base = `${(config.endpoint ?? `https://s3.${config.region}.amazonaws.com`).replace(/\/$/, "")}/${bucket}`;
  const client = new AwsClient({ ...config, service: "s3" });
  const urls = new Map<string, string>();
  for (const file of files) {
    const url = `${base}/${[prefix.replace(/\/$/, ""), file.path].filter(Boolean).join("/")}`;
    const response = await client.fetch(url, {
      method: "PUT",
      headers: { "content-type": file.mediaType },
      body: file.body,
    });
    if (!response.ok) throw new Error(`the store answered ${response.status} to PUT ${url}: ${await response.text()}`);
    urls.set(file.path, url);
  }
  return urls;
}
