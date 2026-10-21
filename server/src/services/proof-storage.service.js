import mongoose from 'mongoose';
import multer from 'multer';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import ApiError from '../utils/api-error.js';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

const BUCKET = 'paymentProofs';

/**
 * Detects the real image type from magic bytes. Client-declared MIME types are
 * never trusted on their own - the file header must match an allowed format.
 */
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

/**
 * Multer instance accepting a single `proof` image field in memory. We validate
 * MIME type and size before ever touching storage; the original filename is
 * never trusted or persisted as a path.
 */
export const uploadProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Ifoto igomba kuba JPEG, PNG cyangwa WEBP', 'INVALID_PROOF_TYPE'));
    }
    cb(null, true);
  },
}).single('proof');

/** Wraps multer so its errors become normalized ApiErrors. */
export function handleProofUpload(req, res, next) {
  uploadProof(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('Ifoto ni nini cyane (max 5MB)', 'PROOF_TOO_LARGE'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(ApiError.badRequest('Dosiye itemewe', 'UNEXPECTED_FILE'));
    }
    return next(ApiError.badRequest(err.message || 'Kohereza ifoto byanze', 'PROOF_UPLOAD_FAILED'));
  });
}

/**
 * Streams an image buffer into GridFS. Returns the stored object id and a
 * stable public id used by the client. Thumbnails/derivatives are not needed.
 */
export async function storeProof(buffer, { mimeType, originalFilename } = {}) {
  if (!buffer?.length) throw ApiError.badRequest('Ifoto irakenewe', 'PROOF_REQUIRED');
  if (buffer.length > MAX_PROOF_BYTES) {
    throw ApiError.badRequest('Ifoto ni nini cyane (max 5MB)', 'PROOF_TOO_LARGE');
  }
  // Trust the bytes, not the client-declared MIME type: the header must match
  // an allowed image format, and it must agree with the declared type.
  const sniffed = sniffImageType(buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.includes(sniffed)) {
    throw ApiError.badRequest('Ifoto igomba kuba JPEG, PNG cyangwa WEBP gusa', 'INVALID_PROOF_TYPE');
  }
  if (mimeType && ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== sniffed) {
    throw ApiError.badRequest('Ubwoko bw’ifoto ntibwahuye n’umwanya wa dosiye', 'PROOF_TYPE_MISMATCH');
  }
  const finalMime = sniffed;

  const ext = finalMime === 'image/png' ? 'png' : finalMime === 'image/webp' ? 'webp' : 'jpg';
  const safeName = `${crypto.randomUUID()}.${ext}`;

  const uploadStream = bucket().openUploadStream(safeName, {
    contentType: finalMime,
    metadata: {
      originalFilename: originalFilename ? String(originalFilename).slice(0, 200) : null,
      mimeType: finalMime,
      uploadedAt: new Date(),
    },
  });

  await new Promise((resolve, reject) => {
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', resolve);
  });

  const id = String(uploadStream.id);
  return {
    proofImagePublicId: id,
    proofImageUrl: `/api/payments/proof/${id}`,
    metadata: {
      originalFilename: originalFilename ? String(originalFilename).slice(0, 200) : null,
      mimeType: finalMime,
      fileSize: buffer.length,
      uploadedAt: new Date(),
    },
  };
}

export async function proofExists(publicId) {
  if (!mongoose.isValidObjectId(publicId)) return false;
  const files = await mongoose.connection.db
    .collection(`${BUCKET}.files`)
    .find({ _id: new mongoose.Types.ObjectId(publicId) })
    .limit(1)
    .toArray();
  return files.length > 0;
}

/**
 * Streams a stored proof back to the response. Access control is enforced by
 * the caller (owner or billing admin) before this runs.
 */
export async function streamProof(publicId, res) {
  if (!mongoose.isValidObjectId(publicId)) {
    throw ApiError.badRequest('Indangamuntu y’ifoto ntariyo', 'INVALID_PROOF_ID');
  }
  const objectId = new mongoose.Types.ObjectId(publicId);
  const files = await mongoose.connection.db
    .collection(`${BUCKET}.files`)
    .find({ _id: objectId })
    .limit(1)
    .toArray();
  const file = files[0];
  if (!file) throw ApiError.notFound('Ifoto ntibonetse', 'PROOF_NOT_FOUND');

  res.set('Content-Type', file.contentType || 'application/octet-stream');
  // Financial proof images: never cache in any shared or browser cache.
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Length', String(file.length));

  await new Promise((resolve, reject) => {
    bucket()
      .openDownloadStream(objectId)
      .on('error', reject)
      .on('end', resolve)
      .pipe(res);
  });
}

export default {
  ALLOWED_MIME_TYPES,
  MAX_PROOF_BYTES,
  handleProofUpload,
  storeProof,
  proofExists,
  streamProof,
};
