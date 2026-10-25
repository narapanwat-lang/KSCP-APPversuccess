import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  RotateCcw,
  Check,
  X,
  SwitchCamera,
  Image as ImageIcon,
  MapPin,
  Clock,
  Navigation,
  Shield,
  AlertCircle,
} from 'lucide-react';
import {
  stampSecurityWatermark,
  getThailandTimeStrings,
  WatermarkData,
} from '../utils/watermark.ts';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Photo: string) => void;
  currentPhoto: string | null;
  employeeName?: string;
  checkpointName?: string;
  shift?: string;
  buildingName?: string;
  pointName?: string;
  locationDetails?: string;
  gpsLocation?: { lat: number; lng: number; accuracy: number } | null;
  onUpdateGpsLocation?: (loc: { lat: number; lng: number; accuracy: number }) => void;
  serverOffsetMs?: number;
  situation?: 'normal' | 'abnormal' | 'emergency' | null;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  currentPhoto,
  employeeName = '',
  checkpointName = '',
  shift = '',
  buildingName = '',
  pointName = '',
  locationDetails = '',
  gpsLocation = null,
  onUpdateGpsLocation,
  serverOffsetMs = 0,
  situation = 'normal',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [tempPhoto, setTempPhoto] = useState<string | null>(currentPhoto);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  // Live GPS state within camera modal
  const [liveGps, setLiveGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(gpsLocation);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Live Thailand time ticker for HUD
  const [liveTime, setLiveTime] = useState(() => getThailandTimeStrings(serverOffsetMs));

  // Sync passed gpsLocation
  useEffect(() => {
    if (gpsLocation) {
      setLiveGps(gpsLocation);
    }
  }, [gpsLocation]);

  // Live Thailand time clock interval
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setLiveTime(getThailandTimeStrings(serverOffsetMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, serverOffsetMs]);

  // Auto-acquire GPS when modal opens if not available
  useEffect(() => {
    if (isOpen && !liveGps) {
      refreshGpsLocation();
    }
  }, [isOpen]);

  const refreshGpsLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setLiveGps(coords);
        setIsLocatingGps(false);
        if (onUpdateGpsLocation) {
          onUpdateGpsLocation(coords);
        }
      },
      (err) => {
        console.warn('GPS reading in camera modal failed:', err);
        setIsLocatingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
      }
    );
  };

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen && !tempPhoto) {
      startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: 'environment' | 'user') => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์ไม่รองรับการเปิดกล้องโดยตรง กรุณาใช้การเลือกไฟล์ภาพ');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError('ไม่สามารถเปิดกล้องถ่ายทอดสดได้ (โปรดอนุญาตสิทธิ์กล้อง หรือใช้การแนบรูปภาพจากโทรศัพท์)');
    } finally {
      setIsLoadingCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  /**
   * Capture photo from camera stream and stamp watermark
   */
  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    // Cap maximum dimension to 1280px for network efficiency while keeping high detail
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;
    const maxDim = 1280;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera was used
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // 1. Draw raw captured photo
    ctx.drawImage(video, 0, 0, width, height);

    // Reset transform if mirrored
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // 2. Stamp Official Security Watermark onto the canvas pixels
    const watermarkData: WatermarkData = {
      employeeName: employeeName.trim(),
      checkpointName: checkpointName.trim() || 'จุดตรวจ รปภ.',
      locationDetails,
      shift,
      buildingName,
      pointName,
      gps: liveGps,
      serverOffsetMs,
      situation,
    };
    stampSecurityWatermark(canvas, watermarkData);

    // 3. Export high quality JPEG base64
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.88);

    setTempPhoto(photoBase64);
    stopCamera();
  };

  const handleRetake = () => {
    setTempPhoto(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (tempPhoto) {
      onCapture(tempPhoto);
      stopCamera();
      onClose();
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  /**
   * Handle image upload from file or gallery and stamp watermark
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current || document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1280;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw image
            ctx.drawImage(img, 0, 0, width, height);

            // Stamp Watermark
            const watermarkData: WatermarkData = {
              employeeName: employeeName.trim(),
              checkpointName: checkpointName.trim() || 'จุดตรวจ รปภ.',
              locationDetails,
              shift,
              buildingName,
              pointName,
              gps: liveGps,
              serverOffsetMs,
              situation,
            };
            stampSecurityWatermark(canvas, watermarkData);

            const compressed = canvas.toDataURL('image/jpeg', 0.88);
            setTempPhoto(compressed);
            stopCamera();
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-slate-700/80">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-950 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5 leading-tight">
                <span>กล้องถ่ายรายงานตรวจจุด รปภ.</span>
              </h3>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                ระบบประทับตราวัน-เวลาไทย, สถานที่, และพิกัด GPS อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative flex-1 bg-black min-h-[380px] sm:min-h-[460px] flex items-center justify-center overflow-hidden">
          {tempPhoto ? (
            /* PREVIEW OF STAMPED PHOTO */
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black p-1 sm:p-2">
              <img
                src={tempPhoto}
                alt="ภาพตัวอย่างตรวจจุด รปภ. ที่ประทับตราแล้ว"
                className="max-h-[68vh] w-auto max-w-full rounded-xl object-contain border border-slate-700/60 shadow-2xl"
              />
              {/* Floating verified badge */}
              <div className="absolute top-4 left-4 bg-emerald-950/90 text-emerald-300 text-xs px-3 py-1.5 rounded-xl border border-emerald-500/50 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                <span className="font-semibold">ประทับตราเวลาไทย & พิกัด GPS เรียบร้อย</span>
              </div>
            </div>
          ) : (
            /* LIVE CAMERA STREAM WITH SECURITY HUD OVERLAY */
            <div className="relative w-full h-full flex items-center justify-center">
              {isLoadingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 z-20 text-slate-300 gap-2.5">
                  <div className="w-9 h-9 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">กำลังเชื่อมต่อกล้อง...</span>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center text-slate-300 max-w-sm z-10">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm mb-4 text-amber-200 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>เลือกรูปภาพจากโทรศัพท์/เครื่อง</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover max-h-[72vh] ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />

                  {/* SECURITY CAMERA LIVE HUD OVERLAY */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-4 z-10">
                    
                    {/* Top HUD: Live Thailand Clock & Security Status */}
                    <div className="flex items-start justify-between gap-2">
                      {/* Top Left: Checkpoint & Guard Badge */}
                      <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-white max-w-[55%]">
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{checkpointName || 'จุดตรวจ รปภ.'}</span>
                        </div>
                        {employeeName && (
                          <div className="text-[10px] text-slate-300 mt-0.5 truncate">
                            จนท: <span className="font-medium text-white">{employeeName}</span>
                          </div>
                        )}
                      </div>

                      {/* Top Right: Thailand Time Live Clock */}
                      <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-right text-white">
                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono font-bold text-amber-400">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{liveTime.timeFormatted} น.</span>
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          {liveTime.dateFormatted} (ไทย)
                        </div>
                      </div>
                    </div>

                    {/* Viewfinder Center Crosshair Guides */}
                    <div className="relative flex-1 flex items-center justify-center my-4">
                      <div className="w-64 h-64 sm:w-72 sm:h-72 border-2 border-white/25 rounded-2xl relative flex items-center justify-center">
                        {/* Corner brackets */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-amber-400 rounded-tl-sm" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-amber-400 rounded-tr-sm" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-amber-400 rounded-bl-sm" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-amber-400 rounded-br-sm" />
                        
                        {/* Center reticle */}
                        <div className="w-3 h-3 border border-white/50 rounded-full" />
                      </div>
                    </div>

                    {/* Bottom HUD: Live GPS Status & Audit Notice */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 text-slate-200">
                        <div className="flex items-center gap-1.5 truncate">
                          <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'text-amber-400 animate-spin' : liveGps ? 'text-sky-400' : 'text-slate-400'}`} />
                          <span className="font-mono text-[11px] truncate">
                            {liveGps
                              ? `GPS: ${liveGps.lat.toFixed(5)}, ${liveGps.lng.toFixed(5)} (±${liveGps.accuracy}m)`
                              : isLocatingGps
                              ? 'กำลังค้นหาสัญญาณพิกัด GPS...'
                              : 'พิกัด: รอรับสัญญาณ GPS'}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full shrink-0 ml-2">
                          ลายน้ำตรวจจุด
                        </span>
                      </div>

                      <div className="text-[10px] text-center text-slate-300/80 bg-black/60 py-1 px-2 rounded-lg">
                        ⚠️ เมื่อกดถ่ายภาพ ระบบจะประทับตราวัน-เวลาไทย พิกัด GPS และสถานที่ลงในรูปภาพโดยอัตโนมัติ
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

          {/* Hidden Canvas & File Input */}
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Controls Bar */}
          <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            {tempPhoto ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-300" />
                  <span>ถ่ายใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/40 cursor-pointer"
                >
                  <Check className="w-4.5 h-4.5 stroke-[2.5]" />
                  <span>ใช้รูปภาพนี้</span>
                </button>
              </>
            ) : (
              <>
                {/* Secondary actions: Switch Camera & Select File */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    disabled={Boolean(cameraError)}
                    className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                    title="สลับกล้องหน้า/หลัง"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                    title="แนบรูปภาพจากอัลบั้ม (พร้อมประทับตรา)"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Shutter Button */}
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={Boolean(cameraError || isLoadingCamera)}
                  className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 border-4 border-slate-700 flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                  aria-label="กดถ่ายภาพตรวจจุด"
                  title="กดถ่ายภาพตรวจจุด"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-slate-900 bg-amber-400 flex items-center justify-center shadow-inner">
                    <Camera className="w-5 h-5 text-slate-900" />
                  </div>
                </button>

                {/* GPS Refresh button on right for symmetry */}
                <div className="flex items-center justify-end w-20">
                  <button
                    type="button"
                    onClick={refreshGpsLocation}
                    disabled={isLocatingGps}
                    className="p-2.5 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
                    title="รีเฟรชพิกัด GPS"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin text-amber-400' : 'text-sky-400'}`} />
                    <span className="text-[10px] hidden sm:inline">GPS</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
};
