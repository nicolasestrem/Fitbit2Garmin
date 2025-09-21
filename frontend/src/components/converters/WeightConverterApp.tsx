import React, { useState } from "react";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { FileUpload } from "../FileUpload";
import { ConversionProgress } from "../ConversionProgress";
import { DownloadManager } from "../DownloadManager";
import {
  apiService,
  type ConversionResponse,
  type FileValidationResult,
} from "../../services/api";

type AppState =
  | "idle"
  | "uploading"
  | "validating"
  | "converting"
  | "completed"
  | "error"
  | "partial_success";

export const WeightConverterApp: React.FC = () => {
  const [state, setState] = useState<AppState>("idle");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversionResponse, setConversionResponse] = useState<ConversionResponse | null>(null);
  const [validationResults, setValidationResults] = useState<FileValidationResult[]>([]);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [retryAfter, setRetryAfter] = useState<number>(0);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setError("");
  };

  const resetState = () => {
    setState("idle");
    setConversionResponse(null);
    setValidationResults([]);
    setError("");
    setProgress(0);
    setRetryAfter(0);
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select files to convert.");
      return;
    }

    try {
      setState("uploading");
      setProgress(15);
      const uploadResult = await apiService.uploadFiles(selectedFiles);

      setState("validating");
      setProgress(35);
      const validationResult = await apiService.validateFiles(uploadResult.upload_id);
      setValidationResults(validationResult);

      const hasInvalidFiles = validationResult.some(result => !result.is_valid);
      if (hasInvalidFiles) {
        setError("Some files have validation errors. Please check the details below.");
        setState("error");
        return;
      }

      setState("converting");
      setProgress(70);
      const conversionResult = await apiService.convertFiles(uploadResult.upload_id);
      setConversionResponse(conversionResult);

      setProgress(100);
      if (conversionResult.partial_success) {
        setState("partial_success");
      } else {
        setState("completed");
      }
    } catch (err) {
      console.error("Conversion failed:", err);

      if (err instanceof Error && err.message.includes("Rate limit exceeded")) {
        const match = err.message.match(/wait (\d+) minute/);
        if (match) {
          setRetryAfter(parseInt(match[1], 10) * 60);
        }
      }

      setError(err instanceof Error ? err.message : "Conversion failed");
      setState("error");
    }
  };

  const canConvert = selectedFiles.length > 0 && (state === "idle" || state === "error");
  const disableInputs = state === "uploading" || state === "validating" || state === "converting";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium">{error}</p>
              {retryAfter > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  You can try again in {Math.ceil(retryAfter / 60)} minute{Math.ceil(retryAfter / 60) > 1 ? "s" : ""}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Upload your files</h2>
          <p className="text-sm text-slate-600">
            Supports up to three <code className="rounded bg-slate-100 px-1 py-0.5">weight-YYYY-MM-DD.json</code> files per batch.
          </p>
        </div>

        <FileUpload onFilesSelected={handleFilesSelected} disabled={disableInputs} />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleConvert}
            disabled={!canConvert}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors ${
              canConvert ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 text-slate-500"
            }`}
          >
            Convert files
          </button>
          <button
            type="button"
            onClick={() => {
              resetState();
              setSelectedFiles([]);
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800"
          >
            Reset
          </button>
        </div>
      </section>

      {validationResults.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Validation summary</h2>
          <div className="space-y-3">
            {validationResults.map(result => (
              <div
                key={result.filename}
                className={`rounded-lg border p-4 ${
                  result.is_valid
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.is_valid ? (
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 text-green-500" />
                  ) : (
                    <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-red-500" />
                  )}
                  <div className="space-y-1">
                    <p className={`text-sm font-semibold ${result.is_valid ? "text-green-900" : "text-red-900"}`}>
                      {result.filename}
                    </p>
                    {result.is_valid ? (
                      <ul className="text-xs text-green-800">
                        {result.entry_count && <li>Entries: {result.entry_count}</li>}
                        {result.date_range && <li>Date range: {result.date_range}</li>}
                        {result.size_kb && <li>Size: {result.size_kb} KB</li>}
                      </ul>
                    ) : (
                      <p className="text-xs text-red-700">{result.error_message}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConversionProgress status={state} progress={progress} error={error} />

      {state === "partial_success" && conversionResponse && (
        <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-900">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-yellow-500" />
            <div className="space-y-2">
              <p className="font-semibold">Partial success</p>
              <p>{conversionResponse.message}</p>
              {conversionResponse.errors && conversionResponse.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">Failed files</p>
                  <ul className="list-disc pl-4">
                    {conversionResponse.errors.map((item, index) => (
                      <li key={`${item.item}-${index}`}>
                        {item.item}: {item.error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {(state === "completed" || state === "partial_success") && conversionResponse && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Download converted files</h2>
          <DownloadManager
            conversionId={conversionResponse.conversion_id}
            downloadUrls={conversionResponse.download_urls}
            filesConverted={conversionResponse.files_converted}
            totalEntries={conversionResponse.total_entries}
          />
        </section>
      )}

      {(state === "completed" || state === "partial_success") && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              resetState();
              setSelectedFiles([]);
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Convert another batch
          </button>
        </div>
      )}
    </div>
  );
};

export default WeightConverterApp;
