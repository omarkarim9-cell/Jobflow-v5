import React, { useState } from "react";
import { Download } from "lucide-react";

interface DownloadMenuProps {
  content: string;
  filenameBase: string;
  onPdf: (content: string, filename: string) => void;
  onDocx: (content: string, filename: string) => void;
  onZip?: () => void;
}

export const DownloadMenu: React.FC<DownloadMenuProps> = ({
  content,
  filenameBase,
  onPdf,
  onDocx,
  onZip
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="p-2 text-slate-400 hover:text-indigo-600"
      >
        <Download className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
          <button
            onClick={() => {
              setOpen(false);
              onPdf(content, `${filenameBase}.pdf`);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
          >
            Download PDF
          </button>

          <button
            onClick={() => {
              setOpen(false);
              onDocx(content, `${filenameBase}.docx`);
            }}
            className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
          >
            Download DOCX
          </button>

          {onZip && (
            <button
              onClick={() => {
                setOpen(false);
                onZip();
              }}
              className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50"
            >
              Download ZIP
            </button>
          )}
        </div>
      )}
    </div>
  );
};
