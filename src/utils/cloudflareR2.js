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
    const cleanFolder = (folder || 'general').replace(/^\/+|\/+$/g, '');
    const key = `${cleanFolder}/${Date.now()}-${cleanFilename}`;

    // If Cloudflare R2 credentials are fully configured
    if (!this.isConfigured() || !this.client) {
      throw new Error('Cloudflare R2 is not configured. Please set CLOUDFLARE_R2 credentials in .env');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    const publicBase = this.publicDomain
      ? this.publicDomain.replace(/\/$/, '')
      : (process.env.NODE_ENV === 'development' || !process.env.BACKEND_URL
          ? `/api/upload/file`
          : `${process.env.BACKEND_URL.replace(/\/$/, '')}/api/upload/file`);

    const fileUrl = `${publicBase}/${key}`;

    return {
      uploadUrl,
      fileUrl,
      key,
      method: 'PUT',
      provider: 'cloudflare-r2',
    };
  }

  // ------------------------------- upload buffer directly to R2 ----------------------------
  async uploadBuffer(buffer, filename, folder = 'OrnateProducts', contentType = 'image/jpeg') {
    const cleanFilename = (filename || 'asset.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${Date.now()}-${cleanFilename}`;

    if (!this.isConfigured() || !this.client) {
      throw new Error('Cloudflare R2 is not configured. Please set CLOUDFLARE_R2 credentials in .env');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    const publicBase = this.publicDomain
      ? this.publicDomain.replace(/\/$/, '')
      : (process.env.NODE_ENV === 'development' || !process.env.BACKEND_URL
          ? `/api/upload/file`
          : `${process.env.BACKEND_URL.replace(/\/$/, '')}/api/upload/file`);

    const fileUrl = `${publicBase}/${key}`;

    return {
      url: fileUrl,
      public_id: key,
      key,
    };
  }

  // ------------------------------- delete file from R2 ----------------------------
  async deleteFile(key) {
    if (!key) return;
    if (!this.isConfigured() || !this.client) return;

    let cleanKey = key;
    if (cleanKey.includes('r2.cloudflarestorage.com/')) {
      cleanKey = cleanKey.split('r2.cloudflarestorage.com/')[1];
    } else if (cleanKey.includes('/api/upload/file/')) {
      cleanKey = cleanKey.split('/api/upload/file/')[1];
    } else if (this.publicDomain && cleanKey.includes(this.publicDomain)) {
      cleanKey = cleanKey.replace(this.publicDomain, '');
    }
    cleanKey = cleanKey.replace(/^\/+/, '');

    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      })
    );
  }
}

module.exports = new CloudflareR2Service();
