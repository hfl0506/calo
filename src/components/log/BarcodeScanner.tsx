import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { lookupBarcodeFn } from '#/lib/server/barcode'
import type { AnalyzedFood } from '#/lib/types'
import { generateId } from '#/lib/uuid'
import { ScanBarcode, X, Loader2, Keyboard } from 'lucide-react'

interface BarcodeScannerProps {
  onResult: (food: AnalyzedFood) => void
  onError: (error: string) => void
}

export default function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop()
      } catch {
        // ignore
      }
    }
    scannerRef.current = null
    setScanning(false)
  }

  const lookupProduct = async (barcode: string) => {
    setLoading(true)
    setScannedCode(barcode)
    try {
      const { food } = await lookupBarcodeFn({ data: { barcode } })
      onResult({ ...food, id: generateId() })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to look up barcode')
    } finally {
      setLoading(false)
      setScannedCode(null)
    }
  }

  const startScanner = async () => {
    setScanning(true)
    try {
      const scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          navigator.vibrate?.(50)
          void stopScanner()
          void lookupProduct(decodedText)
        },
        () => {
          // ignore scan failures (no barcode found yet)
        },
      )
    } catch (err) {
      setScanning(false)
      if (err instanceof Error && err.message.includes('Permission')) {
        onError('Camera permission denied. Please allow camera access to scan barcodes.')
      } else {
        // Camera not available, show manual entry
        setShowManual(true)
      }
    }
  }

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [])

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (!code) return
    void lookupProduct(code)
  }

  if (loading) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 py-8">
        <Loader2 size={40} className="animate-spin text-[var(--lagoon-deep)]" />
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Looking up barcode {scannedCode}…
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {scanning ? (
        <>
          <div
            ref={containerRef}
            id="barcode-reader"
            className="w-full overflow-hidden rounded-2xl"
          />
          <button
            type="button"
            onClick={() => void stopScanner()}
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-medium text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          >
            <X size={16} />
            Stop Scanning
          </button>
        </>
      ) : (
        <>
          <div className="island-shell flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--lagoon-deep)] p-6 text-center opacity-60">
            <ScanBarcode size={40} strokeWidth={1.5} className="text-[var(--lagoon-deep)]" />
            <p className="text-sm text-[var(--sea-ink-soft)]">Scan a barcode to look up nutrition info</p>
          </div>

          <button
            type="button"
            onClick={() => void startScanner()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--lagoon-deep)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ScanBarcode size={18} />
            Start Scanning
          </button>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            <Keyboard size={14} />
            Enter barcode manually
          </button>

          {showManual && (
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode number"
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-base text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon-deep)] placeholder:text-[var(--sea-ink-soft)]"
              />
              <button
                type="button"
                disabled={!manualCode.trim()}
                onClick={handleManualSubmit}
                className="rounded-xl bg-[var(--lagoon-deep)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Look up
              </button>
            </div>
          )}

          <p className="text-center text-xs text-[var(--sea-ink-soft)]">
            Nutrition data from Open Food Facts (per 100g)
          </p>
        </>
      )}
    </div>
  )
}
