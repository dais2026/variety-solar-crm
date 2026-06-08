/**
 * Standalone AWS S3 Storage - Replaces Manus Storage
 * 
 * Features:
 * - Audio file uploads for call recordings
 * - Secure signed URLs
 * - Automatic cleanup of old files
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configuration
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2"; // Sydney by default for Australia
const S3_BUCKET = process.env.S3_BUCKET || "variety-solar-crm-storage";
const S3_ENDPOINT = process.env.S3_ENDPOINT;

// Initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
      ...(S3_ENDPOINT && { endpoint: S3_ENDPOINT }),
    });
  }
  return s3Client!;
}

// Types
export interface UploadOptions {
  contentType?: string;
  expiresIn?: number; // seconds
  metadata?: Record<string, string>;
}

export interface SignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
}

// Check if S3 is configured
export function isConfigured(): boolean {
  return !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && S3_BUCKET);
}

// Generate unique key for file
function generateKey(prefix: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 8);
  const ext = filename.split(".").pop() || "bin";
  return `${prefix}/${timestamp}-${random}.${ext}`;
}

// Upload file to S3
export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array,
  options: UploadOptions = {}
): Promise<{ key: string; url: string; etag: string }> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env");
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: options.contentType || "application/octet-stream",
    ...(options.metadata && { Metadata: options.metadata }),
  });

  try {
    const result = await client.send(command);
    
    return {
      key,
      url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`,
      etag: result.ETag || "",
    };
  } catch (error: any) {
    console.error("[S3] Upload error:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// Upload audio file (call recording)
export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  metadata: {
    leadId?: number;
    callId?: number;
    userId?: number;
    duration?: number;
  } = {}
): Promise<{ key: string; url: string }> {
  const key = generateKey("recordings", filename);
  
  const result = await uploadFile(key, buffer, {
    contentType: "audio/mpeg",
    metadata: {
      ...(metadata.leadId && { "x-amz-meta-lead-id": String(metadata.leadId) }),
      ...(metadata.callId && { "x-amz-meta-call-id": String(metadata.callId) }),
      ...(metadata.userId && { "x-amz-meta-user-id": String(metadata.userId) }),
      ...(metadata.duration && { "x-amz-meta-duration": String(metadata.duration) }),
      "x-amz-meta-uploaded-at": new Date().toISOString(),
    },
  });

  return {
    key: result.key,
    url: result.url,
  };
}

// Get signed URL for download
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<SignedUrlResult> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url,
      key,
      expiresAt,
    };
  } catch (error: any) {
    console.error("[S3] Signed URL error:", error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

// Get signed URL for upload
export async function getSignedUploadUrl(
  key: string,
  contentType: string = "audio/mpeg",
  expiresIn: number = 3600
): Promise<SignedUrlResult> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      url,
      key,
      expiresAt,
    };
  } catch (error: any) {
    console.error("[S3] Signed upload URL error:", error);
    throw new Error(`Failed to generate signed upload URL: ${error.message}`);
  }
}

// Download file from S3
export async function downloadFile(key: string): Promise<Buffer> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    const response = await client.send(command);
    const chunks: Uint8Array[] = [];

    if (response.Body) {
      // Handle both Readable and AsyncIterable
      const body = response.Body as any;
      if (typeof body.on === "function") {
        // Node.js Readable stream
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          body.on("data", (chunk: Buffer) => chunks.push(chunk));
          body.on("end", () => resolve(Buffer.concat(chunks)));
          body.on("error", reject);
        });
      } else {
        // Async iterable (Web API)
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
    }

    throw new Error("Empty response body");
  } catch (error: any) {
    console.error("[S3] Download error:", error);
    throw new Error(`Download failed: ${error.message}`);
  }
}

// Delete file from S3
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    await client.send(command);
  } catch (error: any) {
    console.error("[S3] Delete error:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}

// List files with prefix
export async function listFiles(prefix: string, maxKeys: number = 100): Promise<string[]> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  try {
    const response = await client.send(command);
    return (response.Contents || []).map((obj) => obj.Key || "");
  } catch (error: any) {
    console.error("[S3] List error:", error);
    throw new Error(`List failed: ${error.message}`);
  }
}

// Clean up old recordings (older than specified days)
export async function cleanupOldRecordings(daysOld: number = 30): Promise<number> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    const files = await listFiles("recordings/", 1000);
    let deletedCount = 0;

    for (const key of files) {
      // Check metadata for upload date
      try {
        const getCommand = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        });
        const response = await client.send(getCommand);
        
        const uploadedAt = response.Metadata?.["x-amz-meta-uploaded-at"];
        if (uploadedAt && new Date(uploadedAt) < cutoffDate) {
          await deleteFile(key);
          deletedCount++;
        }
      } catch (e) {
        // Skip files we can't check
      }
    }

    console.log(`[S3] Cleaned up ${deletedCount} old recordings`);
    return deletedCount;
  } catch (error: any) {
    console.error("[S3] Cleanup error:", error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
}

// Get file info
export async function getFileInfo(key: string): Promise<{
  size: number;
  lastModified: Date;
  contentType: string;
}> {
  const client = getS3Client();

  if (!client) {
    throw new Error("AWS credentials not configured");
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  try {
    const response = await client.send(command);
    
    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || "application/octet-stream",
    };
  } catch (error: any) {
    console.error("[S3] Get info error:", error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}

export default {
  isConfigured,
  uploadFile,
  uploadAudio,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  downloadFile,
  deleteFile,
  listFiles,
  cleanupOldRecordings,
  getFileInfo,
};