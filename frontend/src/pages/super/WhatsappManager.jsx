import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  MessageSquare,
  QrCode,
  RefreshCw,
  PowerOff,
  Send,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Bot,
  Zap,
} from "lucide-react";

export default function WhatsappManager() {
  const [status, setStatus] = useState("loading");
  const [instanciaData, setInstanciaData] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [testeNumero, setTesteNumero] = useState("");
  const [testeMensagem, setTesteMensagem] = useState("Olá! Esta é uma mensagem de teste do Nuvy Finance AI Copilot.");
  const [feedback, setFeedback] = useState(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const desconectar = async () => {
    const ok = await confirm({
      title: "Desconectar WhatsApp Oficial",
      description: "Deseja realmente desconectar o WhatsApp oficial da plataforma?",
      variant: "danger",
      confirmText: "Desconectar",
    });
    if (!ok) return;

    try {
      setLoadingStatus(true);
      await api.post("/integracoes/whatsapp/evolution/disconnect");
      setQrcode(null);
      await carregarStatus();
      toast.success("WhatsApp desconectado com sucesso.");
      setFeedback({ tipo: "sucesso", mensagem: "WhatsApp desconectado com sucesso." });
    } catch (err) {
      toast.error("Erro ao desconectar instância.");
    } finally {
      setLoadingStatus(false);
    }
  };

  const gerarQrCode = async () => {
    try {
      setLoadingQr(true);
      setFeedback(null);
      const res = await api.post("/integracoes/whatsapp/evolution/qrcode", { instance: "empresa_1" });
      if (res.data?.qrcode) {
        let raw = typeof res.data.qrcode === "string" ? res.data.qrcode : (res.data.qrcode?.base64 || res.data.qrcode?.code);
        if (raw && typeof raw === "string" && !raw.startsWith("2@")) {
          const qr = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
          setQrcode(qr);
        }
      }
      carregarStatus();
    } catch (err) {
      console.error("Erro ao gerar QR Code:", err);
      setFeedback({
        tipo: "erro",
        mensagem: err.response?.data?.error || err.response?.data?.message || "Erro ao gerar QR Code do WhatsApp.",
      });
    } finally {
      setLoadingQr(false);
    }
  };

  const carregarStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.get("/integracoes/whatsapp/evolution/status");
      setStatus(res.data?.status || "disconnected");
      setInstanciaData(res.data?.dados || null);
    } catch (err) {
      console.error("Erro ao carregar status WhatsApp:", err);
      setStatus("disconnected");
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleEnviarTeste = async (e) => {
    e.preventDefault();
    if (!testeNumero) return;
    try {
      setLoadingSend(true);
      setFeedback(null);
      await api.post("/integracoes/whatsapp/evolution/test-message", {
        numero: testeNumero,
        mensagem: testeMensagem,
      });
      setFeedback({
        tipo: "sucesso",
        mensagem: `Mensagem enviada com sucesso para ${testeNumero}!`,
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        mensagem: err.response?.data?.error || "Erro ao enviar mensagem de teste.",
      });
    } finally {
      setLoadingSend(false);
    }
  };

  useEffect(() => {
    carregarStatus();
    const interval = setInterval(carregarStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = status === "connected" || status === "open";

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-slate-800" size={24} /> WhatsApp & IA Copiloto
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Conexão oficial da Evolution API para IA conversacional, lembretes de contas e cobranças.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw size={15} className={loadingStatus ? "animate-spin" : ""} />}
              onClick={carregarStatus}
              disabled={loadingStatus}
            >
              Atualizar Status
            </Button>
            {isConnected && (
              <Button
                variant="danger"
                icon={<PowerOff size={15} />}
                onClick={desconectar}
              >
                Desconectar
              </Button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
              feedback.tipo === "sucesso"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {feedback.tipo === "sucesso" ? (
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.mensagem}</span>
          </div>
        )}

        {/* Status Card Overview - 3 Cards Topo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Conexão</span>
              <Badge
                variant={isConnected ? "success" : status === "connecting" ? "warning" : "danger"}
                icon={<span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />}
              >
                {isConnected ? "CONECTADO" : status === "connecting" ? "AGUARDANDO LEITURA" : "DESCONECTADO"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                <Smartphone size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {instanciaData?.profileName || "WhatsApp Central"}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {instanciaData?.ownerJid?.replace("@s.whatsapp.net", "") || "Instância: empresa_1"}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motor IA & OCR</span>
              <Badge variant="success" icon={<Zap size={12} />}>ATIVO</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">n8n + GPT-4o Copiloto</p>
                <p className="text-xs text-slate-500">Áudio, Texto & Cupom Fiscal</p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serviço Evolution</span>
              <Badge variant="info">PORTA 8080</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Evolution API v2</p>
                <p className="text-xs text-slate-500">Instância Local Isolada</p>
              </div>
            </div>
          </Card>
        </div>

        {/* QR Code Section */}
        {!isConnected && (
          <Card padding="lg" className="border-2 border-dashed border-emerald-300 bg-emerald-50/20">
            <div className="flex flex-col md:flex-row items-center gap-8 justify-center py-4">
              <div className="text-center md:text-left max-w-sm space-y-3">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  Passo a Passo
                </span>
                <h3 className="text-lg font-bold text-slate-900">Escaneie o QR Code no seu WhatsApp</h3>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu smartphone</li>
                  <li>Toque em <b>Mais Opções</b> (Android) ou <b>Configurações</b> (iPhone)</li>
                  <li>Selecione <b>Aparelhos Conectados</b></li>
                  <li>Toque em <b>Conectar um Aparelho</b> e aponte para o QR Code ao lado</li>
                </ol>
                <div className="pt-2">
                  <Button
                    variant="dark"
                    size="sm"
                    icon={<QrCode size={14} />}
                    onClick={gerarQrCode}
                    loading={loadingQr}
                  >
                    Recarregar QR Code
                  </Button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center justify-center min-w-[240px] min-h-[240px]">
                {loadingQr ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold">Gerando QR Code...</span>
                  </div>
                ) : qrcode ? (
                  <img
                    src={qrcode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center p-4">
                    <QrCode size={40} className="text-slate-300" />
                    <p className="text-xs text-slate-500">
                      Clique no botão <b>Gerar QR Code</b> acima para exibir o código de conexão.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Live Test Messaging Card & Comandos Aceitos */}
        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="lg">
              <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <Send size={16} className="text-emerald-600" /> Teste de Envio de Mensagem
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Envie uma mensagem instantânea para verificar a entrega pelo WhatsApp.
              </p>

              <form onSubmit={handleEnviarTeste} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número com DDD (ex: 5567999998888)</label>
                  <input
                    type="text"
                    required
                    placeholder="5567999998888"
                    value={testeNumero}
                    onChange={(e) => setTesteNumero(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mensagem de Teste</label>
                  <textarea
                    rows={3}
                    required
                    value={testeMensagem}
                    onChange={(e) => setTesteMensagem(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="dark"
                    loading={loadingSend}
                    icon={<Send size={14} />}
                  >
                    Enviar Mensagem
                  </Button>
                </div>
              </form>
            </Card>

            <Card padding="lg">
              <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <Bot size={16} className="text-emerald-600" /> Comandos Aceitos pelo Copiloto
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Qualquer usuário cadastrado na plataforma pode enviar para este número:
              </p>

              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                  <span className="font-bold text-emerald-600">🎙️ Áudio:</span>
                  <span>"Gastei 50 reais no almoço com cliente no restaurante"</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                  <span className="font-bold text-emerald-600">🧾 Foto:</span>
                  <span>Envie foto de cupom fiscal ou nota para lançamento automático por OCR</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                  <span className="font-bold text-emerald-600">💬 Pergunta:</span>
                  <span>"Qual meu saldo hoje?" ou "Quanto faturei no mês?"</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Card Integração Oficial Telegram Bot */}
        <Card padding="lg" className="border border-sky-200 bg-gradient-to-r from-sky-50/50 to-indigo-50/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                <Send size={24} className="translate-x-[-1px] translate-y-[1px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Telegram Bot Copiloto (@NuvyFinanca_bot)</h3>
                  <Badge variant="info">OFICIAL & ATIVO</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Conexão de altíssima velocidade e estabilidade com botões interativos, áudio e fotos de notas via Telegram.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <a
                href="https://t.me/NuvyFinanca_bot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <Send size={14} />
                Abrir no Telegram
              </a>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] text-slate-500">
            <span>🔹 <strong>Webhook:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 text-slate-700">/api/integracoes/telegram/webhook</code></span>
            <span>🔹 <strong>Identificação:</strong> Vinculação por e-mail ou comando <code>/start</code></span>
            <span>🔹 <strong>IA:</strong> GPT-4o-mini + Whisper + Vision</span>
          </div>
        </Card>

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
