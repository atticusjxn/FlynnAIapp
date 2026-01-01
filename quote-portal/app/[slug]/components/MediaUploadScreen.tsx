'use client';

import { useState, useRef } from 'react';
import { UploadedFile } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { v4 as uuidv4 } from 'uuid';

interface MediaUploadScreenProps {
  maxPhotos: number;
  maxVideos: number;
  initialFiles: UploadedFile[];
  onComplete: (files: UploadedFile[]) => void;
  onSkip: () => void;
  onBack: () => void;
  primaryColor: string;
}

const MAX_PHOTO_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 50;

export default function MediaUploadScreen({
  maxPhotos,
  maxVideos,
  initialFiles,
  onComplete,
  onSkip,
  onBack,
  primaryColor,
}: MediaUploadScreenProps) {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const photoCount = files.filter((f) => f.type === 'photo').length;
  const videoCount = files.filter((f) => f.type === 'video').length;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const availableSlots = maxPhotos - photoCount;
    const filesToProcess = selectedFiles.slice(0, availableSlots);

    setIsUploading(true);

    for (const file of filesToProcess) {
      // Validate file size
      if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is ${MAX_PHOTO_SIZE_MB}MB.`);
        continue;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not a valid image file.`);
        continue;
      }

      const fileId = uuidv4();
      const preview = URL.createObjectURL(file);

      // Add to state immediately with pending status
      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        preview,
        type: 'photo',
        progress: 0,
        status: 'pending',
      };

      setFiles((prev) => [...prev, uploadedFile]);

      // Compress and upload
      try {
        await uploadPhoto(file, fileId, (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress, status: 'uploading' } : f))
          );
        });

        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 100, status: 'completed' } : f))
        );
      } catch (error) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'failed', error: 'Upload failed. Please try again.' }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const availableSlots = maxVideos - videoCount;
    const filesToProcess = selectedFiles.slice(0, availableSlots);

    setIsUploading(true);

    for (const file of filesToProcess) {
      // Validate file size
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is ${MAX_VIDEO_SIZE_MB}MB.`);
        continue;
      }

      // Validate file type
      if (!file.type.startsWith('video/')) {
        alert(`${file.name} is not a valid video file.`);
        continue;
      }

      const fileId = uuidv4();
      const preview = URL.createObjectURL(file);

      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        preview,
        type: 'video',
        progress: 0,
        status: 'pending',
      };

      setFiles((prev) => [...prev, uploadedFile]);

      try {
        await uploadVideo(file, fileId, (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress, status: 'uploading' } : f))
          );
        });

        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 100, status: 'completed' } : f))
        );
      } catch (error) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: 'failed', error: 'Upload failed. Please try again.' }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  };

  const handleContinue = () => {
    onComplete(files);
  };

  return (
    <div className="flynn-card">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Photos & Videos</h2>
      <p className="text-sm text-gray-600 mb-6">
        Help us understand your project better (optional)
      </p>

      {/* Upload Buttons */}
      <div className="mb-6 space-y-3">
        {photoCount < maxPhotos && (
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
              disabled={isUploading}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-4 px-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-all bg-white"
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-2xl">📷</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Add Photos</p>
                  <p className="text-xs text-gray-500">
                    {photoCount}/{maxPhotos} photos • Max {MAX_PHOTO_SIZE_MB}MB each
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {videoCount < maxVideos && (
          <div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleVideoSelect}
              className="hidden"
              disabled={isUploading}
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-4 px-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-all bg-white"
            >
              <div className="flex items-center justify-center space-x-3">
                <span className="text-2xl">🎥</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Add Video</p>
                  <p className="text-xs text-gray-500">
                    {videoCount}/{maxVideos} videos • Max {MAX_VIDEO_SIZE_MB}MB each
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Uploaded Files Preview */}
      {files.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Uploaded Files ({files.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {files.map((file) => (
              <FilePreview
                key={file.id}
                file={file}
                onRemove={() => handleRemoveFile(file.id)}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center space-x-3">
        <button onClick={onBack} className="flynn-button-secondary" disabled={isUploading}>
          Back
        </button>

        {files.length > 0 ? (
          <button
            onClick={handleContinue}
            disabled={isUploading || files.some((f) => f.status === 'uploading')}
            className="flynn-button-primary flex-1"
            style={{ backgroundColor: primaryColor }}
          >
            {isUploading ? 'Uploading...' : 'Continue'}
          </button>
        ) : (
          <button
            onClick={onSkip}
            className="flynn-button-secondary flex-1"
            disabled={isUploading}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

// File Preview Component
interface FilePreviewProps {
  file: UploadedFile;
  onRemove: () => void;
  primaryColor: string;
}

function FilePreview({ file, onRemove, primaryColor }: FilePreviewProps) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
      {file.type === 'photo' ? (
        <img src={file.preview} alt="Uploaded" className="w-full h-full object-cover" />
      ) : (
        <video src={file.preview} className="w-full h-full object-cover" />
      )}

      {/* Upload Progress */}
      {file.status === 'uploading' && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-2">
              <div className="w-12 h-12 mx-auto border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-xs font-semibold">{file.progress}%</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {file.status === 'failed' && (
        <div className="absolute inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center">
          <p className="text-xs text-white font-semibold text-center px-2">Failed</p>
        </div>
      )}

      {/* Remove Button */}
      {file.status !== 'uploading' && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-all shadow-md"
        >
          ×
        </button>
      )}

      {/* Type Badge */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 rounded text-xs text-white font-semibold">
        {file.type === 'photo' ? '📷' : '🎥'}
      </div>
    </div>
  );
}

// Upload functions (simplified - in production, use Supabase Storage)
async function uploadPhoto(
  file: File,
  fileId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  // Compress image
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    onProgress: (progress: number) => {
      onProgress(Math.round(progress * 0.5)); // First 50% is compression
    },
  };

  const compressedFile = await imageCompression(file, options);

  // Simulate upload (replace with actual Supabase Storage upload)
  onProgress(50);

  // In production: Upload to Supabase Storage
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      fileName: file.name,
      mimeType: compressedFile.type,
      fileSize: compressedFile.size,
    }),
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const { uploadUrl } = await response.json();

  // Upload file
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: compressedFile,
    headers: {
      'Content-Type': compressedFile.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Upload failed');
  }

  onProgress(100);
}

async function uploadVideo(
  file: File,
  fileId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  // Get upload URL
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileId,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const { uploadUrl } = await response.json();

  // Upload with progress tracking
  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
