import { Router } from 'express';
import multer from 'multer';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { isAllowedImage } from '../../utils/imageUpload.js';

const router = Router();
const photoService = new PhotoService();
const photoController = new PhotoController(photoService);

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImage(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Audio uploads (invitation background music). Larger limit, audio-only.
const audioUpload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Routes
router.post('/upload', upload.fields([{ name: 'files', maxCount: 10 }]), (req, res) => photoController.uploadPhotos(req, res));
router.post('/upload-audio', audioUpload.fields([{ name: 'files', maxCount: 1 }]), (req, res) => photoController.uploadAudio(req, res));
router.get('/:category', (req, res) => photoController.listPhotos(req, res));
router.delete('/:category/:filename', (req, res) => photoController.deletePhoto(req, res));

export { router as photoRoutes };