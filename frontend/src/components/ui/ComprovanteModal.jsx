import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import {
  FileText,
  Download,
  Trash2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Paperclip,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "../../utils/api";

export default function ComprovanteModal({
  isOpen,
  onClose,
  comprovanteUrl,
  transacaoId,
  transacaoDescricao,
  onComprovanteRemovido,
}) {
  const [zoomed, setZoomed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!comprovanteUrl) return null;

  // Resolve URL se for relativa
  const fullUrl = comprovanteUrl.startsWith("http")
    ? comprovanteUrl
    : `${api.defaults.baseURL || ""}${comprovanteUrl}`;

  const isPdf = comprovanteUrl.toLowerCase().endsWith(".pdf");

  const handleRemover = async () => {
    if (!transacaoId) return;
    try {
      setDeleting(true);
      await api.delete(`/transacoes/${transacaoId}/remover-comprovante`);
      if (onComprovanteRemovido) onComprovanteRemovido(transacaoId);
      onClose();
    } catch (err) {
      console.error("Erro ao remover comprovante:", err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Comprovante / Anexo</h3>
            <p className="text-xs text-slate-400 font-normal truncate max-w-xs">
              {transacaoDescricao || "Lançamento Financeiro"}
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Visualizador de Arquivo */}
        <div className="relative bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden min-h-[350px] max-h-[550px] flex items-center justify-center p-2">
          {isPdf ? (
            <iframe
              src={`${fullUrl}#toolbar=0`}
              title="Visualizador de PDF"
              className="w-full h-[450px] rounded-lg border-0 bg-white"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-auto max-h-[480px]">
              <img
                src={fullUrl}
                alt="Comprovante"
                className={`transition-transform duration-200 rounded-lg object-contain ${
                  zoomed ? "scale-150 cursor-zoom-out" : "max-h-[450px] cursor-zoom-in"
                }`}
                onClick={() => setZoomed(!zoomed)}
              />
              <button
                onClick={() => setZoomed(!zoomed)}
                className="absolute bottom-3 right-3 p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-slate-200 rounded-lg text-xs flex items-center gap-1 shadow-lg transition"
              >
                {zoomed ? (
                  <>
                    <ZoomOut className="w-3.5 h-3.5" /> Reduzir
                  </>
                ) : (
                  <>
                    <ZoomIn className="w-3.5 h-3.5" /> Ampliar
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal de Confirmação de Exclusão */}
        {confirmDelete && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Deseja realmente remover este comprovante permanentemente?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Cancelar
              </button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemover}
                disabled={deleting}
              >
                {deleting ? "Removendo..." : "Confirmar Exclusão"}
              </Button>
            </div>
          </div>
        )}

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <a
              href={fullUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" /> Baixar Arquivo
            </a>

            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir em nova aba
            </a>
          </div>

          {transacaoId && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remover Anexo
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
