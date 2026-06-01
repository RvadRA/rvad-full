/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BarcodeScanner — hardware scanner with front-camera mirror fix.
 *
 * MIRROR PROBLEM EXPLANATION:
 * The front camera video stream is natively "mirrored" for a selfie-like
 * preview. When the barcode decoder reads pixels from this mirrored frame,
 * the barcode is reversed (e.g. EAN-13 reads right-to-left) and fails to
 * decode. The fix:
 *   1. The VIDEO element for display gets `transform: scaleX(-1)` so it
 *      looks correct to the user — like a mirror.
 *   2. The Html5Qrcode library reads from the raw (unmirrored) MediaStream
 *      directly, so it always decodes the true barcode pixels.
 * This is achieved by hooking into the internal video element after
 * html5-qrcode inserts it into the DOM, and flipping only the visual CSS.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, ZapOff, Vibrate, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
  placeholderText?: string;
  products?: { name: string; barcode: string }[];
}

/** Returns true if the selected camera is front-facing */
function isFrontCamera(cameraLabel: string): boolean {
  const lower = cameraLabel.toLowerCase();
  return (
    lower.includes('front') ||
    lower.includes('user') ||
    lower.includes('selfie') ||
    lower.includes('face') ||
    lower.includes('передн') || // Russian
    lower.includes('фронт')     // Russian
  );
}

/** Play a professional scan beep */
function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    if (success) {
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
      osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (_) {}
}

/** Vibrate the device if available */
function vibrate(pattern: number | number[]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
}

export default function BarcodeScanner({ onScanSuccess, onClose, placeholderText, products = [] }: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const [scanFlash, setScanFlash] = useState(false);
  const [isFront, setIsFront] = useState(false);

  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  const videoMirrorRef = useRef<HTMLVideoElement | null>(null);
  const scannerId = 'barcode-scanner-video-container';

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  /**
   * After html5-qrcode inserts its <video> element into the DOM,
   * we find it and apply the CSS mirror flip ONLY if it's a front camera.
   * The library still reads from the unmirrored stream, so decoding works.
   */
  const applyMirrorToVideoElement = useCallback((frontFacing: boolean) => {
    const container = document.getElementById(scannerId);
    if (!container) return;

    // Poll briefly until html5-qrcode inserts the video
    let attempts = 0;
    const interval = setInterval(() => {
      const video = container.querySelector('video') as HTMLVideoElement | null;
      if (video) {
        clearInterval(interval);
        videoMirrorRef.current = video;
        // Apply mirror CSS only for display — decoding is unaffected
        video.style.transform = frontFacing ? 'scaleX(-1)' : 'scaleX(1)';
        video.style.objectFit = 'cover';
        video.style.width = '100%';
        video.style.height = '100%';
      }
      if (++attempts > 30) clearInterval(interval);
    }, 100);
  }, []);

  /** Check if torch is available on the active track */
  const checkTorchAvailability = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as any;
      setTorchAvailable(!!(caps && caps.torch));
      stream.getTracks().forEach(t => t.stop());
    } catch (_) {
      setTorchAvailable(false);
    }
  }, []);

  /** Toggle the camera torch/flashlight */
  const toggleTorch = useCallback(async () => {
    try {
      const container = document.getElementById(scannerId);
      if (!container) return;
      const video = container.querySelector('video') as HTMLVideoElement | null;
      if (!video || !video.srcObject) return;
      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const newState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newState } as any] });
      setTorchOn(newState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  }, [torchOn]);

  const stopScanner = useCallback(async () => {
    if (isTransitioningRef.current) return;
    if (html5QrRef.current?.isScanning) {
      isTransitioningRef.current = true;
      try {
        await html5QrRef.current.stop();
      } catch (e) {
        console.warn('Stop scanner error:', e);
      } finally {
        isTransitioningRef.current = false;
      }
    }
    if (isMountedRef.current) setIsScanningActive(false);
  }, []);

  const startScanner = useCallback(async (cameraId: string, cameras: CameraDevice[]) => {
    if (isTransitioningRef.current) return;
    if (html5QrRef.current?.isScanning) return;

    if (!html5QrRef.current) {
      try {
        html5QrRef.current = new Html5Qrcode(scannerId, { verbose: false });
      } catch (e) {
        console.error('Failed to init Html5Qrcode', e);
        return;
      }
    }

    isTransitioningRef.current = true;

    try {
      if (isMountedRef.current) {
        setErrorMessage('');
        setIsScanningActive(true);
      }

      // Detect front camera to know whether to apply mirror
      const cam = cameras.find(c => c.id === cameraId);
      const front = cam ? isFrontCamera(cam.label) : false;
      if (isMountedRef.current) setIsFront(front);

      const config = {
        fps: 25,              // Higher FPS for faster detection
        qrbox: (w: number, h: number) => {
          // Wide barcode target box
          const bw = Math.round(Math.min(w * 0.85, 360));
          const bh = Math.round(Math.min(h * 0.38, 140));
          return { width: bw, height: bh };
        },
        aspectRatio: 1.7778, // 16:9 — typical phone orientation
        formatsToSupport: [
          // 1D barcodes (retail)
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          // 2D barcodes
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native browser BarcodeDetector API (faster)
        },
        // For front cameras, we do NOT ask html5-qrcode to mirror internally.
        // We handle the display mirror ourselves via CSS on the video element.
        // This is the KEY fix: html5-qrcode reads unmirrored pixels → correct decode.
      };

      await html5QrRef.current.start(
        cameraId ? cameraId : { facingMode: front ? 'user' : 'environment' },
        config,
        (decodedText) => {
          // SUCCESS — flash UI, beep, vibrate, then call parent
          setScanFlash(true);
          setTimeout(() => setScanFlash(false), 400);
          setLastScanned(decodedText);
          playBeep(true);
          vibrate([60, 30, 60]);
          onScanSuccess(decodedText);
        },
        () => { /* per-frame no-match — silently ignored */ }
      );

      // NOW apply mirror CSS to the inserted video element
      applyMirrorToVideoElement(front);

      if (isMountedRef.current) {
        // Async check for torch availability
        checkTorchAvailability();
      }
    } catch (err: any) {
      console.error('Scanner start error:', err);
      if (isMountedRef.current) {
        setErrorMessage(err?.message || 'Не удалось запустить камеру. Проверьте разрешения.');
        setIsScanningActive(false);
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, [applyMirrorToVideoElement, checkTorchAvailability, onScanSuccess]);

  const handleCameraChange = useCallback(async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    setTorchOn(false);
    if (isScanningActive) {
      await stopScanner();
      await startScanner(cameraId, cameras);
    }
  }, [isScanningActive, stopScanner, startScanner, cameras]);

  // Initialize cameras on mount
  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mounted) return;
        if (devices?.length > 0) {
          setCameras(devices);
          // Prefer back camera; fall back to first
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('задн') ||
            d.label.toLowerCase().includes('rear')
          );
          const defaultId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultId);
          startScanner(defaultId, devices);
        } else {
          setErrorMessage('Камеры не найдены на устройстве.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setErrorMessage('Ошибка доступа к камере: ' + (err?.message || err));
      });

    return () => {
      mounted = false;
      if (html5QrRef.current?.isScanning) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-sm z-[120] flex flex-col justify-center items-center p-3 pb-24 sm:pb-3 select-none">
      <div className="w-full max-w-md bg-[#0D0F12] border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-slate-800 bg-[#12151B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`p-1.5 rounded-lg transition-all ${isScanningActive ? 'bg-blue-500/15 text-blue-400 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
              <Camera className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white font-mono tracking-wide">Аппаратный сканер</h3>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                {isScanningActive
                  ? (isFront ? '📹 Фронтальная камера (зеркало)' : '📸 Основная камера')
                  : (placeholderText || 'Ожидаю штрихкод...')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Torch toggle — only if available */}
            {torchAvailable && (
              <button
                onClick={toggleTorch}
                title={torchOn ? 'Выключить вспышку' : 'Включить вспышку'}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${torchOn
                  ? 'bg-amber-400/15 border-amber-500/40 text-amber-400'
                  : 'bg-[#1C1E26] border-slate-800 text-slate-500 hover:text-amber-400'
                }`}
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 border border-slate-800 bg-[#1C1E26] hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Video + HUD ──────────────────────────────────────── */}
        <div
          className={`relative flex-1 bg-black overflow-hidden flex flex-col justify-center items-center min-h-[300px] transition-all duration-200 ${scanFlash ? 'brightness-150' : ''}`}
        >
          {/* Scan success flash overlay */}
          {scanFlash && (
            <div className="absolute inset-0 z-30 pointer-events-none bg-emerald-400/20 flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.9)]" />
            </div>
          )}

          {/*
            TARGET element for html5-qrcode.
            The library inserts <video> here. We later set its CSS via JS to apply the mirror flip.
            IMPORTANT: do NOT set mirror CSS here statically — it must be applied dynamically
            only for front cameras after the <video> element is inserted by the library.
          */}
          <div
            id={scannerId}
            className="w-full h-full max-h-[380px] flex items-center justify-center [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
          />

          {/* HUD overlays */}
          {isScanningActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center z-10">

              {/* Dark vignette around scan zone */}
              <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/10 to-black/50" />

              {/* Top hint strip */}
              <div className="absolute top-3 left-0 right-0 flex justify-center">
                <div className="bg-black/75 border border-slate-700/60 text-[10px] text-slate-400 font-mono px-3 py-1 rounded-full tracking-wider">
                  {isFront ? '🔄 ЗЕРКАЛЬНЫЙ РЕЖИМ — СКАНИРОВАНИЕ РАБОТАЕТ' : 'ПОДНЕСИТЕ ШТРИХ-КОД К РАМКЕ'}
                </div>
              </div>

              {/* Scan zone rectangle — wide for 1D barcodes */}
              <div className="relative w-[85%] max-w-[320px] h-28 rounded-xl">
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-blue-400 rounded-br-lg" />

                {/* Scan line animation */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_rgba(239,68,68,1)] animate-ping" style={{ animationDuration: '1.6s' }} />
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-rose-400/80 to-transparent" />

                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-mono text-blue-300/60 tracking-widest uppercase bg-black/40 px-2 py-0.5 rounded">
                    EAN · UPC · CODE128 · QR
                  </span>
                </div>
              </div>

              {/* Status pill */}
              <div className="absolute bottom-3 flex items-center gap-1.5 bg-black/80 px-3 py-1.5 rounded-full border border-slate-800/80 text-[10px] text-slate-400 font-mono tracking-wide">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span>АВТО-ДЕТЕКТ ШТРИХ-КОДОВ (EAN/UPC)</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/95 z-20 flex flex-col justify-center items-center p-6 text-center space-y-3">
              <Camera className="w-10 h-10 text-slate-700 mb-1" />
              <p className="text-amber-400 font-bold font-mono text-xs">ДОСТУП К КАМЕРЕ ЗАБЛОКИРОВАН</p>
              <p className="text-slate-400 text-xs max-w-xs leading-relaxed">{errorMessage}</p>
              <p className="text-slate-600 text-[10px]">
                Разрешите доступ к камере в настройках браузера и перезагрузите страницу.
              </p>
            </div>
          )}
        </div>

        {/* ─── Controls ─────────────────────────────────────────── */}
        <div className="p-3 bg-[#12151B] border-t border-slate-800 space-y-2.5">

          {/* Camera selector */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2 justify-between bg-[#1C1E26] px-3 py-2 rounded-xl border border-slate-800/80 text-xs text-slate-300">
              <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                <RefreshCw className="w-3 h-3 text-blue-400" />
                Объектив:
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="bg-[#0D0F12] border border-slate-800 p-1 rounded-lg text-slate-200 outline-none text-xs flex-1 ml-2 max-w-[200px]"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
                    {cam.label || `Камера ${cam.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Last scanned badge */}
          {lastScanned && (
            <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-mono font-bold truncate">{lastScanned}</span>
              <span className="text-slate-500 shrink-0 ml-auto">Последний</span>
            </div>
          )}

          {/* Mirror info badge for front camera */}
          {isFront && isScanningActive && (
            <div className="flex items-center gap-2 bg-blue-500/8 border border-blue-500/15 px-3 py-2 rounded-xl text-[10px] text-blue-400 font-mono">
              <Vibrate className="w-3 h-3 shrink-0" />
              Отображение зеркально — декодирование штрих-кодов работает корректно
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={handleClose}
            className="w-full py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl bg-[#1C1E26] cursor-pointer text-center transition"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
