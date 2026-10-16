const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { publicUrl } = require('./media');

class CloudflareR2Service {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    this.accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.CLOUDFLARE_R2_PUBLIC_URL;

    const endpoint =
      process.env.CLOUDFLARE_R2_ENDPOINT ||
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

  // ------------------------------- check cloudflare r2 configuration ----------------------------
  isConfigured() {
    return Boolean(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucketName
    );
  }

  // ------------------------------------------------------------- [ getMediaUrl ]
  async getMediaUrl(key) {
    if (!key) return null;

    let cleanKey = key;
    if (typeof cleanKey === 'string') {
      if (cleanKey.includes('r2.cloudflarestorage.com/')) {
        cleanKey = cleanKey.split('r2.cloudflarestorage.com/')[1];
      } else if (cleanKey.includes('/api/upload/file/')) {
        cleanKey = cleanKey.split('/api/upload/file/')[1];
      } else if (this.publicDomain && cleanKey.includes(this.publicDomain)) {
        cleanKey = cleanKey.replace(this.publicDomain, '');
      }
      cleanKey = cleanKey.replace(/^\/+/, '');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: cleanKey,
    });

    const downloadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 86400,
    });

    return downloadUrl;
  }

  // ------------------------------- generate presigned put url ----------------------------
  async getPresignedPutUrl({ filename, contentType = 'image/jpeg', folder = 'banners' }) {
    const cleanFilename = (filename || 'asset').replace(/[^a-zA-Z0-9.-]/g, '_');
    const cleanFolder = (folder || 'general').replace(/^\/+|\/+$/g, '');
    const key = `${cleanFolder}/${Date.now()}-${cleanFilename}`;

    const fileUrl = publicUrl(key);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return {
      uploadUrl,
      url: fileUrl,
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

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      })
    );
  }
}

const cloudflareR2Service = new CloudflareR2Service();
cloudflareR2Service.getMediaUrl = cloudflareR2Service.getMediaUrl.bind(cloudflareR2Service);

module.exports = cloudflareR2Service;
module.exports.CloudflareR2Service = CloudflareR2Service;
