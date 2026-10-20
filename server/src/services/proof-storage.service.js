import mongoose from 'mongoose';
import multer from 'multer';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import ApiError from '../utils/api-error.js';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

const BUCKET = 'paymentProofs';

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
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw ApiError.badRequest('Ubwoko bw’ifoto ntibwemewe', 'INVALID_PROOF_TYPE');
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const safeName = `${crypto.randomUUID()}.${ext}`;

  const uploadStream = bucket().openUploadStream(safeName, {
    contentType: mimeType || 'application/octet-stream',
    metadata: {
      originalFilename: originalFilename ? String(originalFilename).slice(0, 200) : null,
      mimeType: mimeType || null,
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
      mimeType: mimeType || null,
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
  res.set('Cache-Control', 'private, max-age=300');
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
