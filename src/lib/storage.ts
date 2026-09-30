import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
export const storage = new S3Client({ region: process.env.S3_REGION ?? "us-east-1", endpoint: process.env.S3_ENDPOINT, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" } });
export const bucket = () => process.env.S3_BUCKET ?? "estate-private";
export const putObject = (key: string, body: Buffer, mime: string) => storage.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: mime }));
export const getObject = (key: string) => storage.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
export const deleteObject = (key: string) => storage.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
