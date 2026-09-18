"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface WebSmartScanProps {
  businessId: string;
  onScanSuccess: (scannedCode: string) => void;
  onClose: () => void;
}

export default function WebSmartScan({ businessId, onScanSuccess, onClose }: WebSmartScanProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledScanRef = useRef(false);
  const closingRef = useRef(false);
  const viewfinderId = `web-smartscan-viewfinder-${useId().replace(/:/g, "")}`;
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    const scanner = new Html5Qrcode(viewfinderId);
    scannerRef.current = scanner;
    let disposed = false;

    const stopScanner = async () => {
      if (closingRef.current) return;
      closingRef.current = true;
      try {
        if (scanner.getState() === 2) {
          await scanner.stop();
        }
      } catch {
        // The camera may already be stopped during browser teardown.
      } finally {
        try {
          scanner.clear();
        } catch {
          // The DOM node may already have been removed by React.
        }
        scannerRef.current = null;
      }
    };

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            if (disposed || handledScanRef.current || closingRef.current) return;
            handledScanRef.current = true;
            void stopScanner().finally(() => onScanSuccess(decodedText));
          },
          () => undefined,
        );
      } catch (error) {
        if (!disposed) {
          setScanError(error instanceof Error ? error.message : "Unable to access the camera.");
        }
      }
    };

    void start();

    return () => {
      disposed = true;
      void stopScanner();
    };
  }, [onScanSuccess, viewfinderId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Webcam SmartScan"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.72)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#0D1B3D", fontSize: 17, fontWeight: 800 }}>Webcam SmartScan</div>
            <div style={{ color: "#6B7A99", fontSize: 12, marginTop: 2 }}>Point the camera at a barcode or QR code</div>
          </div>
          <button className="btn" type="button" onClick={onClose} aria-label="Close scanner" style={{ border: "none", background: "none", color: "#6B7A99", fontSize: 22, cursor: "pointer" }}>
            ×
          </button>
        </div>
        <div id={viewfinderId} data-business-id={businessId} style={{ width: "100%", minHeight: 240, overflow: "hidden", borderRadius: 12, background: "#060E1F" }} />
        {scanError && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#FFEBEE", color: "#C62828", fontSize: 12 }}>{scanError}</div>}
        <button className="btn" type="button" onClick={onClose} style={{ width: "100%", marginTop: 12, padding: 12, border: "none", borderRadius: 12, background: "#123A8F", color: "white", fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
