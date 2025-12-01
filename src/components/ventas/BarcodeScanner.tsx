"use client";
import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({
  onDetected,
  onClose,
}: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  //referencia para la instancia del escáner (se crea una sola vez)
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "html5qr-code-full-region";

  const playBeep = () => {
    const audio = new Audio("/sounds/beep.mp3");
    if (!audio.src || audio.src.includes("undefined")) {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.start();
      setTimeout(() => osc.stop(), 100);
    } else {
      audio.play().catch(() => {});
    }
  };

  //inicialización para preparar cámaras y crear instancias
  useEffect(() => {
    let mounted = true;

    //crear la instancia solo una vez
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(regionId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
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

          //Buscar cámara trasera en dispositivos que la tengan
          const backCamera = devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("environment")
          );

          //ci hay trasera, úsala. Si no, usa la primero de index 0 que suele ser la webcam principal en laptops
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          toast.error("No se detectaron cámaras");
        }
      } catch (err) {
        console.error("Error cámaras:", err);
        toast.error("Permiso de cámara denegado o no disponible.");
      }
    };

    initCameras();

    //cleanup al cerrar el modal
    return () => {
      mounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear());
      }
    };
  }, []);

  //efecto para arrancar/cambiar cámara cuando cambia el ID seleccionado
  useEffect(() => {
    if (selectedCameraId && scannerRef.current) {
      startCamera(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  const startCamera = (cameraId: string) => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    //función auxiliar para iniciar
    const start = () => {
      scanner
        .start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            playBeep();
            //detener y notificar
            scanner
              .stop()
              .then(() => {
                scanner.clear();
                onDetected(decodedText);
              })
              .catch((err) => console.error(err));
          },
          () => {} //ignorar errores de frame por segundo
        )
        .then(() => setIsScanning(true))
        .catch((err) => {
          console.error("Error iniciando:", err);
          setIsScanning(false);
          toast.error("No se pudo iniciar esta cámara");
        });
    };

    //si ya está escaneando, detener primero, luego iniciar la nueva
    if (scanner.isScanning) {
      scanner
        .stop()
        .then(() => {
          start();
        })
        .catch((err) => {
          console.error("Error al detener para cambio:", err);
          //intentar iniciar de todas formas si falló el stop
          start();
        });
    } else {
      start();
    }
  };

  const handleCameraChange = () => {
    if (cameras.length > 1 && selectedCameraId) {
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const newCameraId = cameras[nextIndex].id;

      //actualizamos el estado, lo que disparará el useEffect
      setSelectedCameraId(newCameraId);
      toast.info(
        `Cambiando a: ${
          cameras[nextIndex].label || "Cámara " + (nextIndex + 1)
        }`
      );
    } else {
      toast.info("Solo se detectó una cámara");
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
            <span style={{ fontWeight: "bold" }}>Escáner de Productos</span>
          </div>
          <button
            onClick={() => {
              //detener manualmente antes de cerrar
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
                width: "260px",
                height: "150px",
                border: "2px solid rgba(255, 0, 0, 0.6)",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                zIndex: 10,
                pointerEvents: "none",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 2,
                  background: "red",
                  position: "absolute",
                  top: "50%",
                  opacity: 0.5,
                }}
              ></div>
            </div>
          )}
        </div>

        <div style={{ padding: 20, textAlign: "center", background: "white" }}>
          <p style={{ marginBottom: 15, color: "#64748b", fontSize: "0.9rem" }}>
            Apunta la cámara al código de barras
          </p>
          {cameras.length > 1 ? (
            <button
              onClick={handleCameraChange}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "0 auto",
                padding: "10px 20px",
                borderRadius: 20,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#334155",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              <RefreshCw size={16} /> Cambiar Cámara ({cameras.length})
            </button>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              Cámara única detectada
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
