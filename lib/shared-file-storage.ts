import crypto from "crypto";
import { createWriteStream } from "fs";
import path from "path";
import { mkdir, readFile, rm, stat } from "fs/promises";
import { pipeline, Readable } from "stream";
import { promisify } from "util";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LOCAL_PREFIX = "local://";
const S3_PREFIX = "s3://";
const LOCAL_BASE_DIR = path.join(process.cwd(), "storage", "shared-files");
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const streamPipeline = promisify(pipeline);

type SharedFileStorageDriver = "local" | "s3";

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function readPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBool(value: string, fallback: boolean) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function sanitizeSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "general"
  );
}

function safeExtension(fileName: string) {
  const ext = path.extname(fileName || "").slice(0, 10);
  return /^[.a-zA-Z0-9]+$/.test(ext) && ext ? ext : ".bin";
}

function formatByteLimit(size: number) {
  if (size >= 1024 * 1024) return `${Math.round((size / 1024 / 1024) * 10) / 10} MB`;
  if (size >= 1024) return `${Math.round((size / 1024) * 10) / 10} KB`;
  return `${size} B`;
}

function buildObjectKey(categoryName: string, originalName: string, folderNames: string[] = []) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const safeCategory = sanitizeSegment(categoryName);
  const safeFolders = folderNames.map((segment) => sanitizeSegment(segment));
  const storeName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${safeExtension(
    originalName
  )}`;
  return path.posix.join("shared-files", safeCategory, ...safeFolders, monthKey, storeName);
}

function getStorageDriver(): SharedFileStorageDriver {
  const driver = readEnv("SHARED_FILE_STORAGE_DRIVER").toLowerCase();
  if (driver === "s3") return "s3";
  return "local";
}

function getMaxUploadBytes() {
  return readPositiveInt(readEnv("SHARED_FILE_MAX_BYTES"), DEFAULT_MAX_UPLOAD_BYTES);
}

function getS3Config() {
  const bucket = readEnv("SHARED_FILE_S3_BUCKET");
  if (!bucket) return null;

  return {
    bucket,
    region: readEnv("SHARED_FILE_S3_REGION") || "ap-singapore",
    endpoint: readEnv("SHARED_FILE_S3_ENDPOINT") || undefined,
    forcePathStyle: parseBool(readEnv("SHARED_FILE_S3_FORCE_PATH_STYLE"), false),
    accessKeyId: readEnv("SHARED_FILE_S3_ACCESS_KEY_ID") || undefined,
    secretAccessKey: readEnv("SHARED_FILE_S3_SECRET_ACCESS_KEY") || undefined,
  };
}

function createS3Client() {
  const config = getS3Config();
  if (!config) {
    throw new Error("S3 config missing. Please configure SHARED_FILE_S3_* env vars.");
  }

  return {
    config,
    client: new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    }),
  };
}

function localUriFromObjectKey(objectKey: string) {
  return `${LOCAL_PREFIX}${objectKey.replace(/^\/+/, "")}`;
}

function s3Uri(bucket: string, objectKey: string) {
  return `${S3_PREFIX}${bucket}/${objectKey.replace(/^\/+/, "")}`;
}

function parseLocalUri(filePath: string) {
  const normalized = String(filePath || "").trim();
  if (normalized.startsWith(LOCAL_PREFIX)) {
    return normalized.slice(LOCAL_PREFIX.length);
  }
  if (normalized.startsWith("/uploads/shared-files/")) {
    return normalized.replace(/^\/+/, "");
  }
  return null;
}

function parseS3Uri(filePath: string) {
  const normalized = String(filePath || "").trim();
  if (!normalized.startsWith(S3_PREFIX)) return null;
  const rest = normalized.slice(S3_PREFIX.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex <= 0) return null;
  const bucket = rest.slice(0, slashIndex);
  const key = rest.slice(slashIndex + 1);
  if (!bucket || !key) return null;
  return { bucket, key };
}

function absoluteLocalPath(filePath: string) {
  const objectKey = parseLocalUri(filePath);
  if (!objectKey) return null;

  if (filePath.startsWith("/uploads/shared-files/")) {
    return path.join(process.cwd(), "public", ...objectKey.split("/"));
  }

  return path.join(LOCAL_BASE_DIR, ...objectKey.replace(/^shared-files\//, "").split("/"));
}

export async function storeSharedFile(file: File, categoryName: string, folderNames: string[] = []) {
  if (!(file instanceof File) || !file.size) {
    throw new Error("Please select a file.");
  }
  if (file.size > getMaxUploadBytes()) {
    throw new Error(`文件不能超过 ${formatByteLimit(getMaxUploadBytes())}`);
  }

  const objectKey = buildObjectKey(categoryName, file.name || "file", folderNames);
  const mimeType = file.type || null;
  const stream = Readable.fromWeb(file.stream() as never);

  if (getStorageDriver() === "s3") {
    const { client, config } = createS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: stream,
        ContentType: mimeType || "application/octet-stream",
      })
    );

    return {
      filePath: s3Uri(config.bucket, objectKey),
      originalName: file.name || "file",
      sizeBytes: file.size,
      mimeType,
    };
  }

  const relativeKey = objectKey.replace(/^shared-files\//, "");
  const absoluteDir = path.join(LOCAL_BASE_DIR, ...path.posix.dirname(relativeKey).split("/"));
  const absolutePath = path.join(LOCAL_BASE_DIR, ...relativeKey.split("/"));
  await mkdir(absoluteDir, { recursive: true });
  try {
    await streamPipeline(stream, createWriteStream(absolutePath));
  } catch (error) {
    await rm(absolutePath, { force: true }).catch(() => undefined);
    throw error;
  }

  return {
    filePath: localUriFromObjectKey(objectKey),
    originalName: file.name || "file",
    sizeBytes: file.size,
    mimeType,
  };
}

export async function createSharedFileAccessResponse(input: {
  filePath: string;
  originalFileName: string;
  mimeType: string | null;
  download: boolean;
}) {
  const s3 = parseS3Uri(input.filePath);
  if (s3) {
    const { client } = createS3Client();
    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: s3.bucket,
        Key: s3.key,
        ResponseContentType: input.mimeType || undefined,
        ResponseContentDisposition: input.download
          ? `attachment; filename*=UTF-8''${encodeURIComponent(input.originalFileName)}`
          : undefined,
      }),
      { expiresIn: 300 }
    );

    return Response.redirect(signedUrl, 302);
  }

  const localPath = absoluteLocalPath(input.filePath);
  if (!localPath) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) return new Response("Not Found", { status: 404 });
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  const body = await readFile(localPath);
  const headers = new Headers({
    "content-type": input.mimeType || "application/octet-stream",
    "content-length": String(body.byteLength),
    "cache-control": "private, max-age=300",
  });

  if (input.download) {
    headers.set(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(input.originalFileName)}`
    );
  }

  return new Response(body, { status: 200, headers });
}

export async function deleteSharedFileObject(filePath: string) {
  const s3 = parseS3Uri(filePath);
  if (s3) {
    const { client } = createS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: s3.bucket,
        Key: s3.key,
      })
    );
    return;
  }

  const localPath = absoluteLocalPath(filePath);
  if (!localPath) {
    return;
  }

  await rm(localPath, { force: true });
}
