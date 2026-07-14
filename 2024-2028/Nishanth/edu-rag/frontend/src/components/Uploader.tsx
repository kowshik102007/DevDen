import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface UploaderProps {
  onUploadSuccess: (doc: any) => void;
}

export const Uploader: React.FC<UploaderProps> = ({ onUploadSuccess }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF documents are supported for PageIndex tree creation");
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload document");
      }

      const result = await response.json();
      onUploadSuccess(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="uploader-container">
      <div 
        className={`uploader-area ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="file-input" 
          accept=".pdf"
          onChange={handleChange}
          disabled={isUploading}
        />
        <div className="uploader-content">
          {isUploading ? (
            <>
              <Loader2 className="uploader-icon" size={32} style={{ animation: 'spin 2s linear infinite' }} />
              <div className="uploader-title">Uploading & Submitting...</div>
              <div className="uploader-subtitle">Submitting document to PageIndex cloud for parsing</div>
            </>
          ) : (
            <>
              <UploadCloud className="uploader-icon" size={32} />
              <div className="uploader-title">Drag & drop your PDF here</div>
              <div className="uploader-subtitle">or click to browse from files</div>
            </>
          )}
        </div>
      </div>
      {error && (
        <div style={{ 
          marginTop: '10px', 
          color: 'var(--status-failed)', 
          fontSize: '12px',
          textAlign: 'center',
          background: 'rgba(255, 8, 68, 0.05)',
          padding: '6px',
          borderRadius: '4px',
          border: '1px solid rgba(255, 8, 68, 0.15)'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};
