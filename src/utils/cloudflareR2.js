const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { publicUrl } = require('./media');
const { generateR2ObjectKey } = require('./r2UploadHelper');
const { CLOUDFLARE_R2 } = require('../config/constants');

class CloudflareR2Service {
  constructor() {
    this.accountId = CLOUDFLARE_R2.ACCOUNT_ID;
    this.accessKeyId = CLOUDFLARE_R2.ACCESS_KEY_ID;
    this.secretAccessKey = CLOUDFLARE_R2.SECRET_ACCESS_KEY;
    this.bucketName = CLOUDFLARE_R2.BUCKET_NAME;
    this.publicDomain = CLOUDFLARE_R2.PUBLIC_DOMAIN;
    const endpoint =
      CLOUDFLARE_R2.ENDPOINT ||
      (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : undefined);

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  // ------------------------------- generate presigned put url ----------------------------
  async getPresignedPutUrl({ module: rawModule, folder, contentType, productId, subfolder, expiresIn = 3600 }) {
    const { key, contentType: validatedContentType } = generateR2ObjectKey({
      module: rawModule || folder,
      contentType,
      productId,
      subfolder,
    });

    const fileUrl = publicUrl(key);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: validatedContentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    return {
      uploadUrl,
      key,
      url: fileUrl,
      contentType: validatedContentType,
    };
  }

  // ------------------------------- upload buffer directly to R2 ----------------------------
  async uploadBuffer(buffer, filename, folder = 'OrnateProducts', contentType = 'image/jpeg') {
    const cleanFilename = (filename || 'asset.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${Date.now()}-${cleanFilename}`;

    const fileUrl = publicUrl(key);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);


    return {
      url: fileUrl,
      key,
    };
  }

  // ------------------------------- delete file from R2 ----------------------------
  async deleteFile(key) {
    if (!key) return;
    const cleanKey = this.extractKey(key);
    if (!cleanKey) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        })
      );
      console.log(`[Cloudflare R2] Successfully deleted object "${cleanKey}" from bucket "${this.bucketName}"`);
    } catch (err) {
      console.error(`[Cloudflare R2] Failed to delete object "${cleanKey}" from bucket "${this.bucketName}":`, err.message);
      throw err;
    }
  }

  // ------------------------------- extract clean R2 key from string or URL ----------------------------
  extractKey(input) {
    if (!input) return '';
    if (typeof input === 'object' && input !== null) {
      if (typeof input.key === 'string' && input.key) return this.extractKey(input.key);
      if (typeof input.url === 'string' && input.url) return this.extractKey(input.url);
      return '';
    }
    if (typeof input !== 'string') return '';
    let clean = input.trim();
    if (/^https?:\/\//i.test(clean)) {
      try {
        const parsed = new URL(clean);
        clean = parsed.pathname;
      } catch {
        clean = clean.replace(/^https?:\/\/[^\/]+\/?/i, '');
      }
    }
    clean = clean.replace(/^\/+/, '').split(/[?#]/)[0];
    if (this.bucketName && clean.startsWith(`${this.bucketName}/`)) {
      clean = clean.slice(this.bucketName.length + 1);
    }
    return clean;
  }

  // ------------------------------- get file metadata & size from R2 ----------------------------
  async getFileMetadata(keyOrUrl) {
    const key = this.extractKey(keyOrUrl);
    if (!key) return null;

    try {
      const data = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      const size = Number(data.ContentLength) || 0;
      const isKb = size < 1024 * 1024;
      const formattedSize = size >= 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(size / 1024)} KB`;

      return {
        key,
        fileSize: size,
        size: formattedSize,
        unit: isKb ? 'KB' : 'MB',
        isKB: isKb,
        allowCompression: !isKb, // If file is in KB, compression is NOT allowed
        contentType: data.ContentType || '',
        lastModified: data.LastModified || null,
      };
    } catch (err) {
      return null;
    }
  }

  // ------------------------------- get file size in bytes ----------------------------
  async getFileSize(keyOrUrl) {
    const meta = await this.getFileMetadata(keyOrUrl);
    return meta ? meta.fileSize : null;
  }

  async getFile(key) {
    return this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
  }
}

const cloudflareR2Service = new CloudflareR2Service();

module.exports = cloudflareR2Service;
module.exports.CloudflareR2Service = CloudflareR2Service;
