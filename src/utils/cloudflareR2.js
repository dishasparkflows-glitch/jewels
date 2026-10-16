const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { publicUrl } = require('./media');
const { generateR2ObjectKey } = require('./r2UploadHelper');

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

  // ------------------------------- generate presigned put url ----------------------------
  async getPresignedPutUrl({ module: rawModule, folder, contentType, expiresIn = 3600 }) {
    const { key, contentType: validatedContentType } = generateR2ObjectKey({
      module: rawModule || folder,
      contentType,
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

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }
}

const cloudflareR2Service = new CloudflareR2Service();

module.exports = cloudflareR2Service;
module.exports.CloudflareR2Service = CloudflareR2Service;
