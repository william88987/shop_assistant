import React, { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { processImageForManualEntry } from "@/lib/ocr-service";
import { ClientImageUtils } from "@/lib/image-utils";
import { WeightInputDialog } from "@/components/weight-input-dialog";


interface PhotoCaptureProps {
  onExtractData: (productName: string, price: number, discount?: { type: "bulk_price" | "buy_x_get_y"; quantity: number; value: number; display: string }, isPerKg?: boolean, weight?: number, photo?: string) => void;
  onClose: () => void;
}

export function PhotoCapture({ onExtractData, onClose }: PhotoCaptureProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [perKgProduct, setPerKgProduct] = useState<{ name: string; pricePerKg: number; discount?: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const loadingInterval = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read product photo extraction setting
  const extractProductPhotos = localStorage.getItem('extractProductPhotos') !== 'false';

  useEffect(() => {
    if (!extractProductPhotos) {
      console.log('📸 Product photo extraction is DISABLED - photos will not be created or stored');
    }
  }, [extractProductPhotos]);

  // Create a 50x50 thumbnail from the captured image using Gemini's center-based crop
  const createProductThumbnail = async (imageData: string, cropArea?: { centerX: number; centerY: number; size: number }): Promise<string> => {
    // Skip if photo extraction is disabled
    if (!extractProductPhotos) {
      console.log('⏭️ Thumbnail creation skipped (disabled in settings)');
      return '';
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set thumbnail size to 50x50 square
        const thumbnailSize = 50;
        canvas.width = thumbnailSize;
        canvas.height = thumbnailSize;

        if (ctx) {
          const { width, height } = img;
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = width;
          let sourceHeight = height;

          // Use Gemini's center-based crop (percentages)
          if (cropArea && cropArea.size) {
            console.log('📐 Using Gemini center crop:', cropArea);
            // Convert center point and size from percentages to pixels
            const minDimension = Math.min(width, height);
            const cropSize = Math.round((cropArea.size / 100) * minDimension);
            const centerX = Math.round((cropArea.centerX / 100) * width);
            const centerY = Math.round((cropArea.centerY / 100) * height);

            // Calculate top-left corner from center point
            sourceX = centerX - cropSize / 2;
            sourceY = centerY - cropSize / 2;
            sourceWidth = cropSize;
            sourceHeight = cropSize;

            // Ensure crop doesn't exceed image bounds
            sourceX = Math.max(0, Math.min(sourceX, width - sourceWidth));
            sourceY = Math.max(0, Math.min(sourceY, height - sourceHeight));

            console.log(`📐 Calculated crop: center(${centerX},${centerY}) → ${Math.round(sourceX)},${Math.round(sourceY)} ${Math.round(sourceWidth)}x${Math.round(sourceHeight)} (image: ${width}x${height})`);
          } else {
            // Fallback: Focus on upper-center area where products typically are
            console.log('📐 Using fallback crop (no Gemini coordinates)');
            const sourceSize = Math.min(width, height);
            if (width > height) {
              sourceX = (width - height) / 2;
              sourceY = 0;
            } else {
              sourceX = 0;
              sourceY = Math.max(0, (height - width) * 0.3);
            }
            sourceWidth = sourceSize;
            sourceHeight = sourceSize;
          }

          // Draw the cropped and scaled image
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle (product area)
            0, 0, thumbnailSize, thumbnailSize // Destination rectangle (50x50)
          );

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(imageData); // Fallback to original if canvas fails
        }
      };
      img.src = imageData;
    });
  };

  // Immediately trigger camera on mount
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const originalImageData = e.target?.result as string;
        setIsProcessing(true);
        setLoadingText('Optimizing image');

        try {
          // Get original image info for logging
          const originalInfo = await ClientImageUtils.getImageInfo(originalImageData);
          console.log(`📸 Original image: ${originalInfo.width}x${originalInfo.height}, ~${Math.round(originalInfo.originalSize / 1024)}KB`);

          // Resize image on client side before uploading for maximum speed
          let optimizedImageData: string;
          try {
            optimizedImageData = await ClientImageUtils.optimizeForUpload(originalImageData);
          } catch (optimizeError) {
            console.warn('⚠️ Image optimization failed, using original image:', optimizeError);
            optimizedImageData = originalImageData;
          }

          // Get optimized image info for comparison
          const optimizedInfo = await ClientImageUtils.getImageInfo(optimizedImageData);
          console.log(`🖼️ Optimized image: ${optimizedInfo.width}x${optimizedInfo.height}, ~${Math.round(optimizedInfo.originalSize / 1024)}KB`);

          // Calculate size reduction
          const sizeReduction = ((originalInfo.originalSize - optimizedInfo.originalSize) / originalInfo.originalSize * 100).toFixed(1);
          console.log(`📊 Size reduction: ${sizeReduction}%`);

          setLoadingText('Processing image');
          let dotCount = 0;
          let loadingPhase = 0;
          const phases = [
            'Processing image',
            'Analyzing with AI',
            'Waiting for response',
            'Still processing',
            'Almost there'
          ];
          const phaseStartTime = Date.now();
          loadingInterval.current = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            const elapsedSeconds = Math.floor((Date.now() - phaseStartTime) / 1000);

            // Progress through phases based on elapsed time
            if (elapsedSeconds >= 20 && loadingPhase < 4) {
              loadingPhase = 4;
            } else if (elapsedSeconds >= 12 && loadingPhase < 3) {
              loadingPhase = 3;
            } else if (elapsedSeconds >= 6 && loadingPhase < 2) {
              loadingPhase = 2;
            } else if (elapsedSeconds >= 3 && loadingPhase < 1) {
              loadingPhase = 1;
            }

            setLoadingText(phases[loadingPhase] + '.'.repeat(dotCount + 1));
          }, 500);

          timeoutRef.current = setTimeout(() => {
            setIsProcessing(false);
            setLoadingText('Server Timeout - Please try again');
            if (loadingInterval.current) clearInterval(loadingInterval.current);
            // Clear global window variables on timeout
            (window as any).__ocrLoadingText = 'Server Timeout - Please try again';
            (window as any).__ocrIsProcessing = false;
            // Reset file input to allow re-use
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            toast({
              title: 'Processing Timeout',
              description: 'The server is taking too long. This may be due to high API traffic. Please try again.',
              variant: 'destructive',
            });
          }, 30000);

          // Process the optimized image (with photo extraction setting)
          const productInfo = await processImageForManualEntry(optimizedImageData, extractProductPhotos);

          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (loadingInterval.current) clearInterval(loadingInterval.current);
          setLoadingText(null);
          setIsProcessing(false);
          // Clear global window variables on success
          (window as any).__ocrLoadingText = null;
          (window as any).__ocrIsProcessing = false;

          // Create thumbnail from the actual captured image or use Gemini's product image (only if enabled)
          let thumbnail: string | undefined;

          if (extractProductPhotos) {
            console.log('📸 Product info:', {
              hasProductImage: !!productInfo.productImage,
              hasCropArea: !!productInfo.cropArea,
              cropArea: productInfo.cropArea,
              isPerKg: productInfo.isPerKg
            });

            if (productInfo.productImage) {
              console.log('🖼️ Using Gemini-provided product image with crop coordinates');
              thumbnail = await createProductThumbnail(productInfo.productImage, productInfo.cropArea);
            } else if (productInfo.productName && productInfo.productName.trim()) {
              console.log('🖼️ Creating thumbnail from optimized image (same as Gemini analyzed) with crop coordinates');
              // Use optimized image (same one Gemini analyzed) so crop coordinates align correctly
              thumbnail = await createProductThumbnail(optimizedImageData, productInfo.cropArea);
            }
          } else {
            console.log('⏭️ Skipping thumbnail creation (photo extraction disabled)');
            thumbnail = undefined;
          }

          // Check if this is a per-KG product
          if (productInfo.isPerKg && productInfo.price > 0) {
            setPerKgProduct({
              name: productInfo.productName,
              pricePerKg: productInfo.price,
              discount: productInfo.discount
            });
            setShowWeightDialog(true);
            // Store thumbnail for later use
            (window as any).__capturedThumbnail = thumbnail;
            // Don't close yet - wait for weight input
          } else {
            onExtractData(productInfo.productName, productInfo.price, productInfo.discount, false, undefined, thumbnail);
            onClose();
          }

        } catch (error) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (loadingInterval.current) clearInterval(loadingInterval.current);
          setLoadingText('Server Error...');
          setIsProcessing(false);
          // Clear global window variables on error
          (window as any).__ocrLoadingText = 'Server Error...';
          (window as any).__ocrIsProcessing = false;
          // Reset file input to allow re-use
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          toast({
            title: 'Processing failed',
            description: 'Please enter product information manually.',
            variant: 'destructive',
          });
          onClose();
        }
      };
      reader.readAsDataURL(file);
    } else {
      // User cancelled file selection
      // Reset file input to allow re-use
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  }, [onExtractData, onClose, toast]);

  // Expose loadingText and isProcessing via window for parent
  useEffect(() => {
    (window as any).__ocrLoadingText = loadingText;
    (window as any).__ocrIsProcessing = isProcessing;
  }, [loadingText, isProcessing]);

  const handleWeightConfirm = (weight: number) => {
    if (perKgProduct) {
      // Get the stored thumbnail
      const thumbnail = (window as any).__capturedThumbnail;
      // For per-KG items, pass the per-KG price (not the total price)
      onExtractData(perKgProduct.name, perKgProduct.pricePerKg, perKgProduct.discount, true, weight, thumbnail);
      setShowWeightDialog(false);
      setPerKgProduct(null);
      // Clean up stored thumbnail
      delete (window as any).__capturedThumbnail;
      onClose();
    }
  };

  const handleWeightCancel = () => {
    setShowWeightDialog(false);
    setPerKgProduct(null);
    // Clean up stored thumbnail
    delete (window as any).__capturedThumbnail;
    onClose();
  };

  // Cleanup effect to reset file input when component unmounts
  useEffect(() => {
    return () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingInterval.current) {
        clearInterval(loadingInterval.current);
      }
    };
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {showWeightDialog && perKgProduct && (
        <WeightInputDialog
          productName={perKgProduct.name}
          pricePerKg={perKgProduct.pricePerKg}
          onConfirm={handleWeightConfirm}
          onCancel={handleWeightCancel}
        />
      )}
    </>
  );
} 