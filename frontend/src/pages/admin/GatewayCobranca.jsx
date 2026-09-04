import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Badge, Card } from "../../components/ui";
import { toast } from "sonner";
import {
  CreditCard,
  QrCode,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

export default function GatewayCobranca() {
  const { user } = useAuth();
  const [provedorAtivo, setProvedorAtivo] = useState("asaas"); // asaas | mercadapago
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [copiadoWebhook, setCopiadoWebhook] = useState(false);

  // Estados dos Gateways
  const [configAsaas, setConfigAsaas] = useState({
    provedor: "asaas",
    ambiente: "sandbox",
    api_key: "",
    webhook_token: "",
    ativo: 1,
    habilitar_pix: 1,
    habilitar_boleto: 1,
    habilitar_cartao: 0,
    juros_mensal: "0.00",
    multa_atraso: "0.00",
    dias_vencimento_padrao: 3,
  });

  const [configMp, setConfigMp] = useState({
    provedor: "mercadopago",
    ambiente: "sandbox",
    api_key: "",
    webhook_token: "",
    ativo: 0,
    habilitar_pix: 1,
    habilitar_boleto: 1,
    habilitar_cartao: 1,
    juros_mensal: "0.00",
    multa_atraso: "0.00",
    dias_vencimento_padrao: 3,
  });

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/gateways");
      const list = res.data?.gateways || [];

      const asaasData = list.find((g) => g.provedor === "asaas");
      if (asaasData) {
        setConfigAsaas({
          ...asaasData,
          api_key: asaasData.api_key_mascarada || "",
        });
      }

      const mpData = list.find((g) => g.provedor === "mercadopago");
      if (mpData) {
        setConfigMp({
          ...mpData,
          api_key: mpData.api_key_mascarada || "",
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de gateway:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const configAtual = provedorAtivo === "asaas" ? configAsaas : configMp;
  const setConfigAtual = provedorAtivo === "asaas" ? setConfigAsaas : setConfigMp;

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      setResultadoTeste(null);
      await api.post("/gateways/salvar", configAtual);
      toast.success(`Configurações do gateway ${provedorAtivo.toUpperCase()} salvas com sucesso!`);
      carregarConfiguracoes();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar configurações.");
    } finally {
      setSalvando(false);
    }
  };

  const handleTestarConexao = async () => {
    try {
      setTestando(true);
      setResultadoTeste(null);
      const res = await api.post("/gateways/testar", {
        provedor: configAtual.provedor,
        ambiente: configAtual.ambiente,
        api_key: configAtual.api_key,
      });

      setResultadoTeste(res.data);
    } catch (err) {
      setResultadoTeste({
        sucesso: false,
        erro: err.response?.data?.erro || "Falha na comunicação com o gateway.",
      });
    } finally {
      setTestando(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/gateways/webhook/${user?.empresa_id || 1}/${provedorAtivo}`;

  const handleCopiarWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiadoWebhook(true);
    setTimeout(() => setCopiadoWebhook(false), 3000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="text-emerald-600" size={24} /> Gateways de Pagamento & Cobrança
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Conecte sua conta do Asaas ou Mercado Pago para emitir PIX, Boletos e receber pagamentos com baixa automática.
            </p>
          </div>
        </div>

        {/* Seletor de Provedor (Asaas vs Mercado Pago) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card Asaas */}
          <div
            onClick={() => {
              setProvedorAtivo("asaas");
              setResultadoTeste(null);
            }}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative overflow-hidden ${
              provedorAtivo === "asaas"
                ? "border-emerald-500 shadow-md ring-4 ring-emerald-500/10"
                : "border-slate-200 hover:border-slate-300 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  A
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Asaas Pagamentos</h3>
                  <p className="text-xs text-slate-500">PIX Dinâmico, Boletos Registrados e Split</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  configAsaas.ativo
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {configAsaas.ativo ? "Ativo" : "Desativado"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> PIX Instantâneo
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle2 size={13} /> Boleto Bancário
              </span>
              <span>•</span>
              <span className="text-slate-400">Ambiente: {configAsaas.ambiente}</span>
            </div>
          </div>

          {/* Card Mercado Pago */}
          <div
            onClick={() => {
              setProvedorAtivo("mercadopago");
              setResultadoTeste(null);
            }}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative overflow-hidden ${
              provedorAtivo === "mercadopago"
                ? "border-sky-500 shadow-md ring-4 ring-sky-500/10"
                : "border-slate-200 hover:border-slate-300 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  MP
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Mercado Pago</h3>
                  <p className="text-xs text-slate-500">Checkout Transparente, PIX e Cartão</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  configMp.ativo
                    ? "bg-sky-100 text-sky-800"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {configMp.ativo ? "Ativo" : "Desativado"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> PIX
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-sky-600">
                <CheckCircle2 size={13} /> Cartão de Crédito
              </span>
              <span>•</span>
              <span className="text-slate-400">Ambiente: {configMp.ambiente}</span>
            </div>
          </div>
        </div>

        {/* Formulário de Configuração do Gateway Selecionado */}
        <Card className="p-6">
          <form onSubmit={handleSalvar} className="space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-600" />
                  Configurar Integração com {provedorAtivo === "asaas" ? "Asaas" : "Mercado Pago"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informe as credenciais da sua conta para emitir cobranças com seu próprio CNPJ/CPF.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Status do Gateway:</label>
                <button
                  type="button"
                  onClick={() =>
                    setConfigAtual((prev) => ({ ...prev, ativo: prev.ativo ? 0 : 1 }))
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    configAtual.ativo
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {configAtual.ativo ? "Habilitado" : "Desabilitado"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ambiente */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ambiente de Operação</label>
                <select
                  value={configAtual.ambiente}
                  onChange={(e) =>
                    setConfigAtual((prev) => ({ ...prev, ambiente: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="sandbox">Sandbox (Ambiente de Testes / Simulação)</option>
                  <option value="producao">Produção (Cobranças Reais)</option>
                </select>
              </div>

              {/* Chave de API / Access Token */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {provedorAtivo === "asaas" ? "Chave de API (API Key Asaas)" : "Access Token (Mercado Pago)"}
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    required
                    placeholder={
                      provedorAtivo === "asaas"
                        ? "$aact_YTU5YTE0M2M6N2Z..."
                        : "APP_USR-7894561230..."
                    }
                    value={configAtual.api_key}
                    onChange={(e) =>
                      setConfigAtual((prev) => ({ ...prev, api_key: e.target.value }))
                    }
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    title={mostrarSenha ? "Ocultar" : "Mostrar"}
                  >
                    {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Formas de Pagamento Habilitadas */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="font-bold text-slate-800 text-xs block">
                Métodos de Pagamento Permitidos nesta Empresa:
              </span>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(configAtual.habilitar_pix)}
                    onChange={(e) =>
                      setConfigAtual((prev) => ({
                        ...prev,
                        habilitar_pix: e.target.checked ? 1 : 0,
                      }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Habilitar PIX Dinâmico</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(configAtual.habilitar_boleto)}
                    onChange={(e) =>
                      setConfigAtual((prev) => ({
                        ...prev,
                        habilitar_boleto: e.target.checked ? 1 : 0,
                      }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Habilitar Boleto Bancário Registrado</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(configAtual.habilitar_cartao)}
                    onChange={(e) =>
                      setConfigAtual((prev) => ({
                        ...prev,
                        habilitar_cartao: e.target.checked ? 1 : 0,
                      }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Habilitar Cartão de Crédito</span>
                </label>
              </div>
            </div>

            {/* Juros e Multa por Atraso */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Juros Mensal por Atraso (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={configAtual.juros_mensal}
                  onChange={(e) =>
                    setConfigAtual((prev) => ({ ...prev, juros_mensal: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Multa por Atraso (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={configAtual.multa_atraso}
                  onChange={(e) =>
                    setConfigAtual((prev) => ({ ...prev, multa_atraso: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vencimento Padrão (Dias)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={configAtual.dias_vencimento_padrao}
                  onChange={(e) =>
                    setConfigAtual((prev) => ({
                      ...prev,
                      dias_vencimento_padrao: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* URL de Webhook para Baixa Automática */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                  <Zap size={14} className="text-emerald-600" /> URL de Notificação (Webhook de Baixa Automática):
                </span>
                <button
                  type="button"
                  onClick={handleCopiarWebhook}
                  className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-emerald-300 shadow-2xs cursor-pointer"
                >
                  {copiadoWebhook ? <Check size={12} /> : <Copy size={12} />}
                  {copiadoWebhook ? "Copiado!" : "Copiar URL"}
                </button>
              </div>
              <div className="p-2 bg-white rounded-xl border border-emerald-200 font-mono text-[11px] text-slate-700 break-all select-all">
                {webhookUrl}
              </div>
              <p className="text-[10px] text-emerald-800">
                💡 Copie esta URL e cole na aba <strong>Webhooks</strong> do seu painel do {provedorAtivo === "asaas" ? "Asaas" : "Mercado Pago"}. Quando o cliente pagar via PIX ou Boleto, a conta receberá baixa automática imediata no sistema!
              </p>
            </div>

            {/* Feedback do Teste de Conexão */}
            {resultadoTeste && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                  resultadoTeste.sucesso
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                {resultadoTeste.sucesso ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {resultadoTeste.sucesso
                      ? "Conexão estabelecida com sucesso!"
                      : "Falha na conexão com o gateway:"}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    {resultadoTeste.sucesso
                      ? `As credenciais do ${provedorAtivo.toUpperCase()} estão válidas e prontas para emitir cobranças.`
                      : resultadoTeste.erro}
                  </p>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<RefreshCw size={14} className={testando ? "animate-spin" : ""} />}
                disabled={testando || !configAtual.api_key}
                onClick={handleTestarConexao}
              >
                {testando ? "Validando Chave..." : "Testar Conexão em Tempo Real"}
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AdminLayout>
  );
}
