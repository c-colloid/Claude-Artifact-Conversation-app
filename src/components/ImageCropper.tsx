/**
 * Image Cropper Component
 * Canvas-based image cropping with zoom and pan
 */

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedImage: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [crop, zoom, imageSize]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 400;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate base scale to fit image in canvas
    const maxDimension = Math.max(imageSize.width, imageSize.height);
    const baseScale = canvasSize / maxDimension;

    // Apply user zoom on top of base scale
    const scale = baseScale * zoom;
    const imgWidth = imageSize.width * scale;
    const imgHeight = imageSize.height * scale;

    // Draw image
    ctx.drawImage(imageRef.current, crop.x, crop.y, imgWidth, imgHeight);

    // Draw crop circle overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, 150, 0, 2 * Math.PI);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, 150, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    const outputSize = 300;
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    // Calculate crop area
    const canvasSize = 400;
    const cropRadius = 150;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Calculate base scale to fit image in canvas
    const maxDimension = Math.max(imageSize.width, imageSize.height);
    const baseScale = canvasSize / maxDimension;

    // Apply user zoom on top of base scale
    const scale = baseScale * zoom;

    // Calculate source crop coordinates
    const sourceX = (centerX - cropRadius - crop.x) / scale;
    const sourceY = (centerY - cropRadius - crop.y) / scale;
    const sourceSize = (cropRadius * 2) / scale;

    // Draw cropped circle
    outputCtx.beginPath();
    outputCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
    outputCtx.clip();

    outputCtx.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    // WebP形式で圧縮（70%品質）、対応していない場合はJPEG
    const mimeType =
      outputCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
    const croppedImage = outputCanvas.toDataURL(mimeType, 0.7);
    onCrop(croppedImage);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">画像をクロップ</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full h-auto border border-gray-300 rounded-lg cursor-move"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">ズーム: {zoom.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            💡 画像をドラッグして位置を調整し、スライダーでズームできます
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCrop();
              }}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              クロップ
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ImageCropper);
