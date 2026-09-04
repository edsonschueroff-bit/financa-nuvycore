import React, { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, Switch, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import {
  MessageSquare,
  Sun,
  CreditCard,
  Bot,
  Mic,
  Image,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
  QrCode,
  Calendar,
  Send,
  Sparkles,
  Phone,
  HelpCircle,
  Play,
  Check,
  User,
  Users,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  Smartphone,
  ShieldCheck,
  Zap,
  Building2,
} from "lucide-react";

export default function AutomacoesWhatsApp() {
  const { user } = useAuth();
  const isPersonalPlan = user?.plano_tipo_publico === "pessoal";
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [testandoResumo, setTestandoResumo] = useState(false);
  const [testandoCobranca, setTestandoCobranca] = useState(false);
  const [testandoSms, setTestandoSms] = useState(false);
  const [simulacaoResultado, setSimulacaoResultado] = useState(null);
  const [proximasFaturas, setProximasFaturas] = useState([]);
  const [usuariosEmpresa, setUsuariosEmpresa] = useState([]);
  const [mostrarNumeroExtra, setMostrarNumeroExtra] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // WhatsApp Tenant Connection State
  const [whatsappStatus, setWhatsappStatus] = useState("desconectado"); // 'desconectado' | 'conectando' | 'conectado'
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [whatsappProfile, setWhatsappProfile] = useState(null);
  const [whatsappQrCode, setWhatsappQrCode] = useState(null);
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false);
  const [disconnectingWhatsapp, setDisconnectingWhatsapp] = useState(false);

  const pollIntervalRef = useRef(null);

  const [config, setConfig] = useState({
    resumo_matinal_ativo: true,
    resumo_matinal_horario: "08:30",
    resumo_matinal_telefones: "",
    regua_cobranca_ativa: true,
    regua_cobranca_horario: "09:00",
    regua_aviso_previo: true,
    regua_dias_antes: 3,
    regua_no_vencimento: true,
    regua_aviso_atraso: true,
    regua_dias_depois: 3,
    chave_pix_cobranca: "",
    copiloto_ia_ativo: true,
    audio_transcricao_ativa: true,
    ocr_comprovantes_ativo: true,
    sms_ativo: false,
    smsnet_usuario: "",
    smsnet_token: "",
    canal_preferencial: "whatsapp",
  });

  const carregarStatusWhatsapp = async () => {
    try {
      const res = await api.get("/integracao-whatsapp/tenant/status");
      if (res.data) {
        setWhatsappStatus(res.data.status || "desconectado");
        setWhatsappNumero(res.data.numero_conectado || "");
        setWhatsappProfile({
          nome: res.data.profile_name,
          foto: res.data.profile_pic_url,
        });

        if (res.data.status === "conectado") {
          setWhatsappQrCode(null);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status do WhatsApp da empresa:", err);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resConfig, resFaturas] = await Promise.all([
        api.get("/empresas/automacoes-whatsapp"),
        api.get("/transacoes?tipo=receita&status=pendente").catch(() => ({ data: [] })),
        carregarStatusWhatsapp(),
      ]);

      if (resConfig.data) {
        const uList = resConfig.data.usuarios || [];
        setUsuariosEmpresa(uList);

        let telefonesIniciais = resConfig.data.resumo_matinal_telefones || "";

        if (!telefonesIniciais && uList.length > 0) {
          const comTel = uList
            .filter((u) => u.telefone && u.telefone.trim())
            .map((u) => u.telefone.replace(/\D/g, ""));
          telefonesIniciais = comTel.join(", ");
        }

        setConfig({
          resumo_matinal_ativo: Boolean(resConfig.data.resumo_matinal_ativo),
          resumo_matinal_horario: resConfig.data.resumo_matinal_horario || "08:30",
          resumo_matinal_telefones: telefonesIniciais,
          regua_cobranca_ativa: Boolean(resConfig.data.regua_cobranca_ativa),
          regua_cobranca_horario: resConfig.data.regua_cobranca_horario || "09:00",
          regua_aviso_previo: Boolean(resConfig.data.regua_aviso_previo),
          regua_dias_antes: Number(resConfig.data.regua_dias_antes) || 3,
          regua_no_vencimento: Boolean(resConfig.data.regua_no_vencimento),
          regua_aviso_atraso: Boolean(resConfig.data.regua_aviso_atraso),
          regua_dias_depois: Number(resConfig.data.regua_dias_depois) || 3,
          chave_pix_cobranca: resConfig.data.chave_pix_cobranca || "",
          copiloto_ia_ativo: Boolean(resConfig.data.copiloto_ia_ativo),
          audio_transcricao_ativa: Boolean(resConfig.data.audio_transcricao_ativa),
          ocr_comprovantes_ativo: Boolean(resConfig.data.ocr_comprovantes_ativo),
          sms_ativo: Boolean(resConfig.data.sms_ativo),
          smsnet_usuario: resConfig.data.smsnet_usuario || "",
          smsnet_token: resConfig.data.smsnet_token || "",
          canal_preferencial: resConfig.data.canal_preferencial || "whatsapp",
        });
      }

      const lista = Array.isArray(resFaturas.data) ? resFaturas.data : resFaturas.data?.transacoes || [];
      setProximasFaturas(lista.slice(0, 5));
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
      setFeedback({ type: "error", message: "Não foi possível carregar as configurações." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleConectarWhatsapp = async () => {
    try {
      setConnectingWhatsapp(true);
      setFeedback({ type: "", message: "" });
      const res = await api.post("/integracao-whatsapp/tenant/conectar");

      if (res.data?.qrcode) {
        setWhatsappQrCode(res.data.qrcode);
        setWhatsappStatus("conectando");

        // Iniciar polling a cada 3.5 segundos para checar se o usuário leu o QR Code
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await api.get("/integracao-whatsapp/tenant/status");
            if (statusRes.data?.status === "conectado") {
              setWhatsappStatus("conectado");
              setWhatsappNumero(statusRes.data.numero_conectado || "");
              setWhatsappProfile({
                nome: statusRes.data.profile_name,
                foto: statusRes.data.profile_pic_url,
              });
              setWhatsappQrCode(null);
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              setFeedback({ type: "success", message: "WhatsApp conectado com sucesso!" });
            }
          } catch (e) {
            // Silencioso
          }
        }, 3500);
      } else {
        setFeedback({ type: "error", message: "Não foi possível gerar o QR Code. Tente novamente." });
      }
    } catch (err) {
      console.error("Erro ao conectar WhatsApp:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.error || "Erro ao conectar WhatsApp da empresa.",
      });
    } finally {
      setConnectingWhatsapp(false);
    }
  };

  const handleDesconectarWhatsapp = async () => {
    const ok = await confirm({
      title: "Desconectar WhatsApp",
      description: "Deseja realmente desconectar o WhatsApp da sua empresa? As cobranças automáticas voltarão a ser emitidas pelo canal padrão.",
      variant: "danger",
      confirmText: "Desconectar",
    });
    if (!ok) return;

    try {
      setDisconnectingWhatsapp(true);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      await api.post("/integracao-whatsapp/tenant/desconectar");
      setWhatsappStatus("desconectado");
      setWhatsappNumero("");
      setWhatsappProfile(null);
      setWhatsappQrCode(null);
      setFeedback({ type: "success", message: "WhatsApp desconectado com sucesso." });
    } catch (err) {
      console.error("Erro ao desconectar WhatsApp:", err);
      setFeedback({ type: "error", message: "Erro ao desconectar WhatsApp." });
    } finally {
      setDisconnectingWhatsapp(false);
    }
  };

  const handleSalvar = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setFeedback({ type: "", message: "" });
      await api.put("/empresas/automacoes-whatsapp", config);
      setFeedback({ type: "success", message: "Configurações de automações salvas com sucesso!" });
      setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
    } catch (err) {
      console.error("Erro ao salvar automações:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.error || "Erro ao salvar configurações de automações.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Gerenciamento dos checkboxes de usuários do Resumo Matinal
  const handleToggleUsuarioResumo = (telefone) => {
    if (!telefone) return;
    const cleanTel = telefone.replace(/\D/g, "");
    if (!cleanTel) return;

    let arrayAtual = (config.resumo_matinal_telefones || "")
      .split(",")
      .map((t) => t.trim().replace(/\D/g, ""))
      .filter(Boolean);

    if (arrayAtual.includes(cleanTel)) {
      arrayAtual = arrayAtual.filter((t) => t !== cleanTel);
    } else {
      arrayAtual.push(cleanTel);
    }

    setConfig({
      ...config,
      resumo_matinal_telefones: arrayAtual.join(", "),
    });
  };

  const isUsuarioSelecionado = (telefone) => {
    if (!telefone) return false;
    const cleanTel = telefone.replace(/\D/g, "");
    if (!cleanTel) return false;

    const arrayAtual = (config.resumo_matinal_telefones || "")
      .split(",")
      .map((t) => t.trim().replace(/\D/g, ""))
      .filter(Boolean);

    return arrayAtual.includes(cleanTel);
  };

  const handleSimularRegua = async () => {
    try {
      setSimulating(true);
      setFeedback({ type: "", message: "" });
      const res = await api.post("/integracao-whatsapp/cobrancas/disparar-regua", {
        enviar_whatsapp: false,
      });
      setSimulacaoResultado(res.data);
      setFeedback({
        type: "success",
        message: `Simulação concluída! ${res.data?.total_processados || 0} faturas identificadas no escopo da régua.`,
      });
    } catch (err) {
      console.error("Erro ao simular régua:", err);
      setFeedback({ type: "error", message: "Erro ao processar simulação da régua de cobrança." });
    } finally {
      setSimulating(false);
    }
  };

  const handleTestarResumo = async () => {
    try {
      setTestandoResumo(true);
      setFeedback({ type: "", message: "" });
      const res = await api.post("/integracao-whatsapp/testar-resumo-matinal", {
        telefone: config.resumo_matinal_telefones || undefined,
      });
      setFeedback({ type: "success", message: res.data?.mensagem || "Resumo Matinal enviado com sucesso!" });
    } catch (err) {
      console.error("Erro ao testar resumo:", err);
      setFeedback({ type: "error", message: err.response?.data?.error || "Erro ao disparar resumo teste." });
    } finally {
      setTestandoResumo(false);
    }
  };

  const handleTestarCobranca = async () => {
    try {
      setTestandoCobranca(true);
      setFeedback({ type: "", message: "" });
      const res = await api.post("/integracao-whatsapp/testar-cobranca", {
        telefone: config.resumo_matinal_telefones || undefined,
      });
      setFeedback({ type: "success", message: res.data?.mensagem || "Mensagem de cobrança teste enviada com sucesso!" });
    } catch (err) {
      console.error("Erro ao testar cobrança:", err);
      setFeedback({ type: "error", message: err.response?.data?.error || "Erro ao disparar cobrança teste." });
    } finally {
      setTestandoCobranca(false);
    }
  };

  const handleTestarSms = async () => {
    try {
      setTestandoSms(true);
      setFeedback({ type: "", message: "" });
      const res = await api.post("/integracao-whatsapp/testar-sms", {
        telefone: config.resumo_matinal_telefones || undefined,
      });
      setFeedback({ type: "success", message: res.data?.mensagem || "SMS de teste disparado com sucesso via SMSNET!" });
    } catch (err) {
      console.error("Erro ao testar SMS:", err);
      setFeedback({ type: "error", message: err.response?.data?.error || "Erro ao disparar SMS de teste." });
    } finally {
      setTestandoSms(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <MessageSquare size={22} />
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                {isPersonalPlan ? "Copiloto Cora & Automações Pessoais" : "Automações & WhatsApp Copiloto"}
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              {isPersonalPlan
                ? "Configure seu briefing matinal diário no WhatsApp e as preferências de inteligência artificial da Cora."
                : "Conecte o WhatsApp da sua empresa, ative o briefing matinal e automatize cobranças com PIX."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              icon={<Save size={18} />}
              loading={saving}
              onClick={handleSalvar}
            >
              Salvar Alterações
            </Button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium animate-in fade-in duration-200 ${feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
          >
            {feedback.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* NOVO CARD PRINCIPAL: CANAL DE WHATSAPP DA EMPRESA (APENAS PLANOS EMPRESARIAIS) */}
        {/* ========================================================================= */}
        {!isPersonalPlan && (
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">Canal de WhatsApp da sua Empresa</h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${whatsappStatus === "conectado"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : whatsappStatus === "conectando"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                          }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${whatsappStatus === "conectado"
                            ? "bg-emerald-400 animate-pulse"
                            : whatsappStatus === "conectando"
                              ? "bg-amber-400"
                              : "bg-slate-400"
                            }`}
                        />
                        {whatsappStatus === "conectado"
                          ? "Conectado"
                          : whatsappStatus === "conectando"
                            ? "Aguardando Leitura"
                            : "Desconectado"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Utilizado para disparar avisos de faturas e cobranças PIX aos seus clientes finais com o nome e número da sua empresa.
                    </p>
                  </div>
                </div>

                {/* Box de Instrução / Como Funciona a Separação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300 flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block">WhatsApp Conectado da Empresa:</strong>
                      Seus clientes recebem as cobranças e o PIX diretamente do seu número oficial.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300 flex items-start gap-2.5">
                    <Bot className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block">Copiloto IA Nuvy Finance:</strong>
                      Para lançar contas e falar por voz/foto, envie mensagens para o robô oficial central.
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações de Conexão */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-3 shrink-0">
                {whatsappStatus === "conectado" ? (
                  <div className="bg-white/10 border border-white/15 p-4 rounded-2xl flex flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
                    <div className="text-right">
                      <span className="text-[11px] text-emerald-400 font-bold block">
                        ✓ NÚMERO ATIVO PARA COBRANÇA
                      </span>
                      <span className="text-sm font-mono font-bold text-white">
                        {whatsappNumero ? `+${whatsappNumero}` : "WhatsApp Conectado"}
                      </span>
                      {whatsappProfile?.nome && (
                        <span className="text-xs text-slate-400 block">{whatsappProfile.nome}</span>
                      )}
                    </div>

                    <button
                      onClick={handleDesconectarWhatsapp}
                      disabled={disconnectingWhatsapp}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {disconnectingWhatsapp ? "Desconectando..." : "Desconectar WhatsApp"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start lg:items-end gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleConectarWhatsapp}
                      disabled={connectingWhatsapp}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-950/50 transition-all text-sm cursor-pointer disabled:opacity-50"
                    >
                      {connectingWhatsapp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Gerando QR Code...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Conectar WhatsApp da Empresa</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Gera um QR Code exclusivo para leitura no app
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal / Card de Leitura de QR Code */}
            {whatsappStatus === "conectando" && whatsappQrCode && (
              <div className="mt-6 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center gap-6 bg-white/[0.03] p-6 rounded-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                <div className="bg-white p-3.5 rounded-2xl shadow-2xl shrink-0 border-2 border-emerald-500/40">
                  <img
                    src={whatsappQrCode.startsWith("data:") ? whatsappQrCode : `data:image/png;base64,${whatsappQrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56 object-contain"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>Escaneie o QR Code com o WhatsApp da sua empresa:</span>
                  </div>

                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed">
                    <li>Abra o <strong>WhatsApp</strong> no celular comercial da empresa.</li>
                    <li>Acesse o menu <strong>Configurações</strong> ou <strong>Mais Opções</strong> (⋮).</li>
                    <li>Toque em <strong>Aparelhos Conectados</strong> e depois em <strong>Conectar um aparelho</strong>.</li>
                    <li>Aponte a câmera para este QR Code. A tela atualizará automaticamente!</li>
                  </ol>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleConectarWhatsapp}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Recarregar QR Code
                    </button>
                    <button
                      onClick={() => {
                        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        setWhatsappQrCode(null);
                        setWhatsappStatus("desconectado");
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* NOVO CARD: COPILOTO FINANCEIRO OFICIAL NO TELEGRAM (@NuvyFinanca_bot) */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-sky-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-lg">
                  <Send className="w-6 h-6 translate-x-[-1px] translate-y-[1px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Copiloto Financeiro no Telegram (@NuvyFinanca_bot)</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-sky-500/20 text-sky-300 border-sky-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      OFICIAL & ATIVO
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Converse com a Cora no Telegram para lançar contas por voz, enviar fotos de recibos, consultar o caixa e baixar recibos oficiais em PDF.
                  </p>
                </div>
              </div>

              {/* Benefícios Rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">🎙️ Voz & Foto OCR</strong>
                  <span>Transcreve áudios com Whisper e extrai comprovantes com GPT-4o.</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">⚡ Sem Configuração</strong>
                  <span>Não precisa ler QR Code nem deixar celular conectado.</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">📄 Recibos em PDF</strong>
                  <span>Gera comprovantes timbrados com QR Code de autenticidade na hora.</span>
                </div>
              </div>
            </div>

            {/* Ação Telegram */}
            <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
              <a
                href="https://t.me/NuvyFinanca_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl shadow-lg shadow-sky-950/50 transition-all text-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Abrir @NuvyFinanca_bot</span>
              </a>
              <span className="text-[11px] text-slate-400">
                Toque em <strong>Iniciar</strong> e informe seu e-mail cadastrado
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Carregando configurações...</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${isPersonalPlan ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-6`}>
            {/* Coluna Esquerda */}
            <div className={`${isPersonalPlan ? "lg:col-span-1" : "lg:col-span-2"} space-y-6`}>
              {/* 1. Card Resumo Matinal */}
              <Card
                title={isPersonalPlan ? "☀️ Resumo Matinal Pessoal no WhatsApp" : "☀️ Resumo Matinal Financeiro"}
                subtitle={
                  isPersonalPlan
                    ? "Briefing diário no seu WhatsApp com saldo do dia e contas que vencem hoje"
                    : "Briefing executivo diário no WhatsApp com saldos, contas do dia e DRE"
                }
                headerAction={
                  <Switch
                    checked={config.resumo_matinal_ativo}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, resumo_matinal_ativo: checked })
                    }
                  />
                }
              >
                <div className={`space-y-4 ${!config.resumo_matinal_ativo ? "opacity-50 pointer-events-none" : ""}`}>
                  {/* Seletor de Horário */}
                  <div className="max-w-xs">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Clock size={14} className="text-emerald-600" /> Horário de Envio (Seg a Sex)
                    </label>
                    <select
                      value={config.resumo_matinal_horario}
                      onChange={(e) =>
                        setConfig({ ...config, resumo_matinal_horario: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    >
                      <option value="07:00">07:00 da manhã</option>
                      <option value="07:30">07:30 da manhã</option>
                      <option value="08:00">08:00 da manhã</option>
                      <option value="08:30">08:30 da manhã (Padrão)</option>
                      <option value="09:00">09:00 da manhã</option>
                      <option value="09:30">09:30 da manhã</option>
                    </select>
                  </div>

                  {/* Lista de Usuários com Checkbox */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={14} className="text-emerald-600" /> Quem deve receber o Resumo no WhatsApp?
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Selecione os usuários da sua empresa
                      </span>
                    </div>

                    <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                      {usuariosEmpresa.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2 text-center">
                          Nenhum usuário cadastrado. Acesse a aba de Usuários para cadastrar.
                        </p>
                      ) : (
                        usuariosEmpresa.map((u) => {
                          const temTel = Boolean(u.telefone && u.telefone.trim());
                          const selecionado = isUsuarioSelecionado(u.telefone);

                          return (
                            <label
                              key={u.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${selecionado
                                ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                                } ${!temTel ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  disabled={!temTel}
                                  checked={selecionado}
                                  onChange={() => handleToggleUsuarioResumo(u.telefone)}
                                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                />
                                <div>
                                  <div className="font-bold text-xs flex items-center gap-2">
                                    <span>{u.nome}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-normal">
                                      {u.email}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {temTel ? `WhatsApp: ${u.telefone}` : "⚠️ Sem WhatsApp cadastrado"}
                                  </div>
                                </div>
                              </div>

                              {selecionado && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full flex items-center gap-1">
                                  <Check size={10} /> Ativo
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Adicionar número adicional avulso */}
                    <div className="pt-1">
                      {!mostrarNumeroExtra ? (
                        <button
                          type="button"
                          onClick={() => setMostrarNumeroExtra(true)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> Adicionar outro número de WhatsApp avulso
                        </button>
                      ) : (
                        <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-700">
                              Telefones Extras (separados por vírgula):
                            </label>
                            <button
                              type="button"
                              onClick={() => setMostrarNumeroExtra(false)}
                              className="text-[11px] text-slate-400 hover:text-slate-600"
                            >
                              Ocultar
                            </button>
                          </div>
                          <input
                            type="text"
                            value={config.resumo_matinal_telefones}
                            onChange={(e) =>
                              setConfig({ ...config, resumo_matinal_telefones: e.target.value })
                            }
                            placeholder="5567999998888, 5511988887777"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Disparo seguro direto via Evolution API e n8n.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Send size={14} />}
                      loading={testandoResumo}
                      onClick={handleTestarResumo}
                    >
                      Enviar Resumo Teste Agora
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 2. Card Régua de Cobrança - Apenas Empresas */}
              {!isPersonalPlan && (
                <Card
                  title="💳 Régua de Cobrança de Faturas com PIX"
                  subtitle="Notificações automáticas no WhatsApp para clientes com contas a vencer ou em atraso"
                  headerAction={
                    <Switch
                      checked={config.regua_cobranca_ativa}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, regua_cobranca_ativa: checked })
                      }
                    />
                  }
                >
                  <div className={`space-y-4 ${!config.regua_cobranca_ativa ? "opacity-50 pointer-events-none" : ""}`}>
                    {/* Chave PIX */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <QrCode size={14} className="text-emerald-600" /> Chave PIX para Cobrança Automática
                      </label>
                      <input
                        type="text"
                        value={config.chave_pix_cobranca}
                        onChange={(e) =>
                          setConfig({ ...config, chave_pix_cobranca: e.target.value })
                        }
                        placeholder="CNPJ, CPF, E-mail, Celular ou Chave Aleatória"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        O sistema gera o payload <strong>PIX Copia e Cola Oficial</strong> com valor exato de cada fatura.
                      </p>
                    </div>

                    {/* Gatilhos de Cobrança */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Momentos de Disparo da Régua
                      </h4>

                      {/* Aviso Prévio */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="aviso_previo"
                            checked={config.regua_aviso_previo}
                            onChange={(e) =>
                              setConfig({ ...config, regua_aviso_previo: e.target.checked })
                            }
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <label htmlFor="aviso_previo" className="text-xs font-medium text-slate-800">
                            Aviso Preventivo de Vencimento
                          </label>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <select
                            value={config.regua_dias_antes}
                            onChange={(e) =>
                              setConfig({ ...config, regua_dias_antes: Number(e.target.value) })
                            }
                            disabled={!config.regua_aviso_previo}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                          >
                            <option value="1">1 dia antes</option>
                            <option value="2">2 dias antes</option>
                            <option value="3">3 dias antes</option>
                            <option value="5">5 dias antes</option>
                            <option value="7">7 dias antes</option>
                          </select>
                        </div>
                      </div>

                      {/* No Vencimento */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="no_vencimento"
                            checked={config.regua_no_vencimento}
                            onChange={(e) =>
                              setConfig({ ...config, regua_no_vencimento: e.target.checked })
                            }
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <label htmlFor="no_vencimento" className="text-xs font-medium text-slate-800">
                            Lembrete no Dia do Vencimento (D-0)
                          </label>
                        </div>
                        <Badge variant="info">Hoje</Badge>
                      </div>

                      {/* Aviso de Atraso */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="aviso_atraso"
                            checked={config.regua_aviso_atraso}
                            onChange={(e) =>
                              setConfig({ ...config, regua_aviso_atraso: e.target.checked })
                            }
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <label htmlFor="aviso_atraso" className="text-xs font-medium text-slate-800">
                            Cobrança de Fatura em Atraso
                          </label>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <select
                            value={config.regua_dias_depois}
                            onChange={(e) =>
                              setConfig({ ...config, regua_dias_depois: Number(e.target.value) })
                            }
                            disabled={!config.regua_aviso_atraso}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                          >
                            <option value="1">1 dia após</option>
                            <option value="2">2 dias após</option>
                            <option value="3">3 dias após</option>
                            <option value="5">5 dias após</option>
                            <option value="10">10 dias após</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Play size={14} />}
                        loading={simulating}
                        onClick={handleSimularRegua}
                      >
                        Simular Disparos da Régua
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Send size={14} />}
                        loading={testandoCobranca}
                        onClick={handleTestarCobranca}
                      >
                        Testar Envio de Exemplo
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

            </div>

            {/* Coluna Direita: Copiloto IA e Faturas no Radar */}
            <div className="space-y-6">
              {/* Card Copiloto IA WhatsApp */}
              <Card
                title="🤖 Copiloto IA Multimodal"
                subtitle="Configurações de inteligência artificial no WhatsApp e Telegram"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <Mic className="text-emerald-600" size={16} />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Áudios de Voz (Whisper)</div>
                        <div className="text-[11px] text-slate-500">Transcreve e lança despesas</div>
                      </div>
                    </div>
                    <Switch
                      checked={config.audio_transcricao_ativa}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, audio_transcricao_ativa: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <Image className="text-emerald-600" size={16} />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Visão de Comprovantes (OCR)</div>
                        <div className="text-[11px] text-slate-500">Lê fotos de recibos e notas</div>
                      </div>
                    </div>
                    <Switch
                      checked={config.ocr_comprovantes_ativo}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, ocr_comprovantes_ativo: checked })
                      }
                    />
                  </div>

                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold mb-1 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-600" />
                      Ficha de Confirmação Ativa
                    </div>
                    A IA sempre envia uma prévia dos dados para você confirmar com <strong>"Sim"</strong> antes de efetivar o lançamento.
                  </div>
                </div>
              </Card>

              {/* Card Faturas no Radar da Régua - Apenas Empresas */}
              {!isPersonalPlan && (
                <Card
                  title="📋 Faturas no Radar"
                  subtitle="Próximas contas a receber com telefone cadastrado"
                >
                  <div className="space-y-2.5">
                    {proximasFaturas.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">
                        Nenhuma conta a receber pendente no momento.
                      </div>
                    ) : (
                      proximasFaturas.map((f) => (
                        <div
                          key={f.id}
                          className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 truncate max-w-[150px]">
                              {f.descricao}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Vencimento: {new Date(f.data_vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-600">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(f.valor)}
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">
                              Pendente
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              )}

              {/* Card Dicas da Cora para Finanças Pessoais */}
              {isPersonalPlan && (
                <Card
                  title="💡 Dicas da Cora no Telegram"
                  subtitle="Comandos práticos para o seu dia a dia"
                >
                  <div className="space-y-2.5 text-xs text-slate-600">
                    <div className="p-3 bg-sky-50/80 border border-sky-200/70 rounded-xl flex items-start gap-2.5">
                      <span className="text-base">📸</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">Comprovante de Compra:</strong>
                        Envie a foto da notinha ou do cupom fiscal. A Cora extrai valor, data e categoria na hora.
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200/70 rounded-xl flex items-start gap-2.5">
                      <span className="text-base">🎙️</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">Áudio de Despesa:</strong>
                        Mande um áudio curto: <em>"Cora, almoço de 45 reais no cartão de crédito"</em>.
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                      <span className="text-base">💬</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">Pergunte à Vontade:</strong>
                        Pergunte <em>"Quanto gastei esse mês?"</em> ou <em>"Qual meu saldo atual?"</em>.
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
