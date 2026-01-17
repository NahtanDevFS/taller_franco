"use client";
import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RefreshCw, ZoomIn, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const SCAN_REGION_WIDTH = 300;
const SCAN_REGION_HEIGHT = 180;

//configuración de consistencia para mejorar la precisión aumentando o disminuyendo capturas de confirmación
const CONFIRMATION_THRESHOLD = 5;

export default function BarcodeScanner({
  onDetected,
  onClose,
}: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [zoom, setZoom] = useState<number>(1);
  const [zoomCap, setZoomCap] = useState<{
    min: number;
    max: number;
    step: number;
  } | null>(null);

  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [isProcessingFrame, setIsProcessingFrame] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const scanBufferRef = useRef<{ code: string; count: number }>({
    code: "",
    count: 0,
  });

  const regionId = "html5qr-code-full-region";

  const playBeep = () => {
    const audio = new Audio("/sounds/beep.mp3");
    if (!audio.src || audio.src.includes("undefined")) {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.start();
      setTimeout(() => osc.stop(), 100);
    } else {
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    let mounted = true;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(regionId, {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
    }

    const initCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (devices && devices.length) {
          setCameras(devices);
          const backCamera = devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("trasera") ||
              d.label.toLowerCase().includes("environment"),
          );
          setSelectedCameraId(
            backCamera ? backCamera.id : devices[devices.length - 1].id,
          );
        } else {
          toast.error("No se detectaron cámaras");
        }
      } catch (err) {
        console.error("Error cámaras:", err);
        toast.error("Permiso de cámara denegado.");
      }
    };

    initCameras();

    return () => {
      mounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear());
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedCameraId && scannerRef.current) {
      startCamera(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    if (videoTrackRef.current) {
      const constraints = { advanced: [{ zoom: newZoom }] };
      videoTrackRef.current
        .applyConstraints(constraints as any)
        .catch((err) => console.error("Error zoom", err));
    }
  };

  const toggleTorch = async () => {
    if (videoTrackRef.current && hasTorch) {
      try {
        await videoTrackRef.current.applyConstraints({
          // @ts-ignore
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.error("Error flash:", err);
        toast.error("No se pudo cambiar el flash");
      }
    }
  };

  const startCamera = (cameraId: string) => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    scanBufferRef.current = { code: "", count: 0 };
    setTorchOn(false);

    const config = {
      fps: 25,
      qrbox: { width: SCAN_REGION_WIDTH, height: SCAN_REGION_HEIGHT },
      aspectRatio: 1.0,
    };

    const start = () => {
      scanner
        .start(
          cameraId,
          config,
          (decodedText) => {
            const buffer = scanBufferRef.current;
            if (buffer.code === decodedText) {
              buffer.count += 1;
            } else {
              buffer.code = decodedText;
              buffer.count = 1;
            }

            if (buffer.count >= CONFIRMATION_THRESHOLD) {
              playBeep();
              scanner
                .stop()
                .then(() => {
                  scanner.clear();
                  onDetected(decodedText);
                })
                .catch((err) => console.error(err));
            }
          },
          () => {
            setIsProcessingFrame((prev) => !prev);
          },
        )
        .then(() => {
          setIsScanning(true);

          const videoElement = document.querySelector(
            `#${regionId} video`,
          ) as HTMLVideoElement;
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            videoTrackRef.current = track;

            const capabilities = track.getCapabilities
              ? track.getCapabilities()
              : {};

            // @ts-ignore
            if (capabilities.zoom) {
              // @ts-ignore
              const { min, max, step } = capabilities.zoom;
              setZoomCap({ min, max, step });
              setZoom(min);
            } else {
              setZoomCap(null);
            }

            // @ts-ignore
            if (capabilities.torch) {
              setHasTorch(true);
            } else {
              setHasTorch(false);
            }

            // @ts-ignore
            const focusMode = capabilities.focusMode as string[] | undefined;
            if (focusMode && focusMode.includes("continuous")) {
              track
                .applyConstraints({
                  // @ts-ignore
                  advanced: [{ focusMode: "continuous" }],
                })
                .catch((err) => console.log("Enfoque no soportado:", err));
            }
          }
        })
        .catch((err) => {
          console.error("Error iniciando cámara:", err);
          setIsScanning(false);
          toast.error("Error al iniciar cámara.");
        });
    };

    if (scanner.isScanning) {
      scanner
        .stop()
        .then(() => setTimeout(start, 200))
        .catch(() => start());
    } else {
      start();
    }
  };

  const handleCameraChange = () => {
    if (cameras.length > 1 && selectedCameraId) {
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setSelectedCameraId(cameras[nextIndex].id);
      toast.info(`Cambiando cámara...`);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          width: "90%",
          maxWidth: 500,
          position: "relative",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "15px",
            background: "#1e293b",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Camera size={20} />
            <span style={{ fontWeight: "bold" }}>Escáner Pro</span>
            {isScanning && (
              <div
                title="Procesando..."
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isProcessingFrame ? "#4ade80" : "#1e293b",
                  transition: "background 0.1s",
                  boxShadow: "0 0 5px #4ade80",
                }}
              />
            )}
          </div>
          <button
            onClick={() => {
              if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                  scannerRef.current?.clear();
                  onClose();
                });
              } else {
                onClose();
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div
          style={{ position: "relative", minHeight: 300, background: "black" }}
        >
          <div id={regionId} style={{ width: "100%" }}></div>
          {isScanning && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: `${SCAN_REGION_WIDTH}px`,
                height: `${SCAN_REGION_HEIGHT}px`,
                border: "2px solid rgba(255, 255, 255, 0.6)",
                borderRadius: 8,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                zIndex: 10,
                pointerEvents: "none",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 20,
                  height: 20,
                  borderTop: "4px solid #ef4444",
                  borderLeft: "4px solid #ef4444",
                  borderTopLeftRadius: 4,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 20,
                  height: 20,
                  borderTop: "4px solid #ef4444",
                  borderRight: "4px solid #ef4444",
                  borderTopRightRadius: 4,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: 20,
                  height: 20,
                  borderBottom: "4px solid #ef4444",
                  borderLeft: "4px solid #ef4444",
                  borderBottomLeftRadius: 4,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 20,
                  height: 20,
                  borderBottom: "4px solid #ef4444",
                  borderRight: "4px solid #ef4444",
                  borderBottomRightRadius: 4,
                }}
              ></div>
              <div
                style={{
                  width: "100%",
                  height: 2,
                  background: "#ef4444",
                  position: "absolute",
                  boxShadow: "0 0 4px #ef4444",
                  animation: "scan-animation 2s infinite linear",
                }}
              ></div>
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes scan-animation {
                        0% { top: 0%; opacity: 0; }
                        50% { opacity: 1; }
                        100% { top: 100%; opacity: 0; }
                    }
                `,
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            padding: 20,
            background: "white",
            display: "flex",
            flexDirection: "column",
            gap: 15,
          }}
        >
          {zoomCap && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ZoomIn size={18} className="text-slate-500" />
              <input
                type="range"
                min={zoomCap.min}
                max={zoomCap.max}
                step={zoomCap.step}
                value={zoom}
                onChange={handleZoomChange}
                style={{
                  width: "100%",
                  accentColor: "#1e293b",
                  cursor: "pointer",
                }}
              />
              <span
                style={{ fontSize: "0.8rem", minWidth: 30, textAlign: "right" }}
              >
                {zoom.toFixed(1)}x
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 15,
              flexWrap: "wrap",
            }}
          >
            {cameras.length > 1 && (
              <button
                onClick={handleCameraChange}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                }}
              >
                <RefreshCw size={16} /> Cambiar Cámara
              </button>
            )}

            {hasTorch && (
              <button
                onClick={toggleTorch}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 20,
                  border: torchOn ? "1px solid #eab308" : "1px solid #e2e8f0",
                  background: torchOn ? "#fef9c3" : "#f8fafc", // Amarillo suave si está encendido
                  color: torchOn ? "#854d0e" : "#334155",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  transition: "all 0.2s",
                }}
              >
                {torchOn ? <ZapOff size={16} /> : <Zap size={16} />}
                {torchOn ? "Apagar Flash" : "Flash"}
              </button>
            )}
          </div>

          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.8rem",
              margin: 0,
            }}
          >
            {zoomCap
              ? "Ajusta el zoom o usa el flash para mejorar la lectura"
              : "Apunta al código para escanear"}
          </p>
        </div>
      </div>
    </div>
  );
}
