const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class CloudflareR2Service {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL;

    if (this.isConfigured()) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
    } else {
      this.client = null;
    }
  }

  // ------------------------------- check cloudflare r2 configuration ----------------------------
  isConfigured() {
    return Boolean(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucketName
    );
  }

  // ------------------------------- generate presigned put url ----------------------------
  async getPresignedPutUrl({ filename, contentType = 'image/jpeg', folder = 'banners' }) {
    const cleanFilename = (filename || 'asset').replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${Date.now()}-${cleanFilename}`;

    // If Cloudflare R2 credentials are fully configured
    if (this.isConfigured() && this.client) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });
      const publicBase = this.publicDomain
        ? this.publicDomain.replace(/\/$/, '')
        : `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com`;

      const fileUrl = `${publicBase}/${key}`;

      return {
        uploadUrl,
        fileUrl,
        key,
        method: 'PUT',
        provider: 'cloudflare-r2',
      };
    }

    // Local Development Fallback
    return {
      uploadUrl: `/api/upload/direct-put?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`,
      fileUrl: `/uploads/${key}`,
      key,
      method: 'PUT',
      provider: 'local-fallback',
    };
  }
}

module.exports = new CloudflareR2Service();
