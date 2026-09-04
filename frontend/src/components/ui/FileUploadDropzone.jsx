import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import api from "../../utils/api";

export default function FileUploadDropzone({
  value,
  onChange,
  transacaoId = null,
  label = "Comprovante / Nota Fiscal / Boleto",
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Validações
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg("Selecione uma imagem (JPG, PNG, WEBP) ou PDF.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("O arquivo deve ter no máximo 10 MB.");
      return;
    }

    setErrorMsg("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("comprovante", file);
      if (transacaoId) {
        formData.append("transacao_id", transacaoId);
      }

      const res = await api.post("/transacoes/upload-comprovante", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.url) {
        onChange(res.data.url);
      }
    } catch (err) {
      console.error("Erro no upload de comprovante:", err);
      setErrorMsg(err.response?.data?.error || "Falha ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const fullUrl = value
    ? value.startsWith("http")
      ? value
      : `${api.defaults.baseURL || ""}${value}`
    : null;

  const isPdf = value && value.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-300">
        {label}
      </label>

      {value ? (
        <div className="relative group p-3 bg-slate-900/90 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                <img
                  src={fullUrl}
                  alt="Anexo"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Arquivo anexado</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {value.split("/").pop()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
            >
              Visualizar
            </a>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 text-slate-400 hover:text-rose-400 transition"
              title="Remover anexo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition ${
            dragActive
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-1 py-1">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Enviando arquivo...</span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-300">
                  Clique ou arraste um comprovante / PDF
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  JPG, PNG, WEBP ou PDF até 10MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
      )}
    </div>
  );
}
