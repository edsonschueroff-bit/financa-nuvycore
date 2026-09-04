import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card, Modal, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
    CreditCard,
    CheckCircle,
    Clock,
    QrCode,
    Zap,
    Lock,
    Copy,
    DollarSign,
    Star,
    Sparkles,
    Check,
    Calendar,
    ExternalLink,
    Building2,
    MapPin,
    Search,
    FileText,
    AlertCircle,
    Edit2,
} from "lucide-react";

const RECURSOS_PADRAO = [
    { key: "copiloto_ia", label: "Copiloto IA Cora (WhatsApp/Telegram)" },
    { key: "orcamento_metas", label: "Metas & Orçamento (Budget 12M)" },
    { key: "contas_cartoes", label: "Contas Bancárias & Cartões" },
    { key: "investimentos_b3", label: "Carteira B3 & Investimentos" },
    { key: "dre", label: "DRE Gerencial em Tempo Real" },
    { key: "fluxo_caixa", label: "Fluxo de Caixa Projetado" },
    { key: "recibos_pdf", label: "Recibos Oficiais em PDF" },
    { key: "regua_cobranca", label: "Régua de Cobrança WhatsApp" },
    { key: "gateways_proprios", label: "Gateways Próprios (Asaas/MP)" },
    { key: "centros_custo", label: "Centros de Custo & Rateio" },
    { key: "open_finance", label: "Conciliação Bancária & OFX" },
    { key: "suporte_vip", label: "Suporte Técnico VIP" },
];

export default function MinhaAssinatura() {
    const { empresaSlug } = useParams();
    const { confirm, ConfirmDialog } = useConfirmDialog();
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cicloAnual, setCicloAnual] = useState(false);
    const [abaSegmento, setAbaSegmento] = useState("empresarial");

    // Modais de Pagamento
    const [modalPagamentoOpen, setModalPagamentoOpen] = useState(false);
    const [faturaSelecionada, setFaturaSelecionada] = useState(null);
    const [metodoPagamento, setMetodoPagamento] = useState("pix");

    // Pix State
    const [pixData, setPixData] = useState(null);
    const [gerandoPix, setGerandoPix] = useState(false);
    const [solicitarCpf, setSolicitarCpf] = useState(false);
    const [cpfInput, setCpfInput] = useState("");

    // Dados Fiscais e Endereço State
    const [fiscalForm, setFiscalForm] = useState({
        cnpj_cpf: "",
        razao_social: "",
        nome_fantasia: "",
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
    });
    const [buscandoCnpj, setBuscandoCnpj] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [salvandoDadosFiscais, setSalvandoDadosFiscais] = useState(false);

    // Cartão State
    const [cartaoForm, setCartaoForm] = useState({
        numero_cartao: "",
        nome_impresso: "",
        validade_mes: "",
        validade_ano: "",
        cvv: "",
        cpf_cnpj: "",
        parcelas: 1,
    });
    const [processandoCartao, setProcessandoCartao] = useState(false);
    const [trocandoPlano, setTrocandoPlano] = useState(false);

    const carregarAssinatura = async () => {
        try {
            setLoading(true);
            const res = await api.get("/minha-assinatura");
            setDados(res.data);
            if (res.data?.empresa?.plano_tipo_publico === "pessoal") {
                setAbaSegmento("pessoal");
            }
        } catch (err) {
            console.error("Erro ao carregar dados de assinatura:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarAssinatura();
    }, [empresaSlug]);

    const handleTrocarPlano = async (plano) => {
        const tipoCobranca = cicloAnual && plano.valor_anual ? "anual" : "mensal";
        const valorCobrado = tipoCobranca === "anual" ? plano.valor_anual : plano.valor;
        const textoMsg = tipoCobranca === "anual"
            ? `Deseja assinar o plano ${plano.nome} no ciclo Anual por ${formatBRL(valorCobrado)}/ano (equivale a ${formatBRL(valorCobrado / 12)}/mês)?`
            : `Deseja assinar o plano ${plano.nome} no ciclo Mensal por ${formatBRL(valorCobrado)}/mês?`;

        const ok = await confirm({
            title: "Troca de Plano",
            description: textoMsg,
            confirmText: "Sim, Confirmar Alteração",
            cancelText: "Cancelar",
            variant: "primary",
        });
        if (!ok) return;

        try {
            setTrocandoPlano(true);
            const res = await api.post("/minha-assinatura/trocar-plano", {
                plano_id: plano.id,
                ciclo: tipoCobranca,
            });

            toast.success(res.data.message || "Plano atualizado com sucesso!");

            if (res.data.pix_copia_cola) {
                setPixData({
                    pix_copia_cola: res.data.pix_copia_cola,
                    pix_qr_code_url: res.data.pix_qr_code_url,
                    valor: res.data.valor,
                });
                setFaturaSelecionada({
                    id: res.data.fatura_id,
                    valor: res.data.valor,
                    empresa_nome: dados?.empresa?.nome,
                });
                setMetodoPagamento("pix");
                setModalPagamentoOpen(true);
            }

            carregarAssinatura();
        } catch (err) {
            toast.error(err.response?.data?.error || "Erro ao trocar de plano.");
        } finally {
            setTrocandoPlano(false);
        }
    };

    const handleBuscarCnpj = async (cnpjDigitado) => {
        const clean = (cnpjDigitado || fiscalForm.cnpj_cpf).replace(/\D/g, "");
        if (clean.length !== 14) {
            toast.warning("Digite os 14 números do CNPJ para buscar.");
            return;
        }
        try {
            setBuscandoCnpj(true);
            const res = await api.get(`/empresas/cnpj/${clean}`);
            if (res.data?.sucesso) {
                setFiscalForm((prev) => ({
                    ...prev,
                    cnpj_cpf: clean,
                    razao_social: res.data.razao_social || prev.razao_social,
                    nome_fantasia: res.data.nome_fantasia || prev.nome_fantasia,
                    cep: res.data.cep || prev.cep,
                    endereco: res.data.logradouro || prev.endereco,
                    numero: res.data.numero || prev.numero,
                    complemento: res.data.complemento || prev.complemento,
                    bairro: res.data.bairro || prev.bairro,
                    cidade: res.data.cidade || prev.cidade,
                    estado: res.data.estado || prev.estado,
                }));
                toast.success("Dados do CNPJ preenchidos automaticamente!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "CNPJ não localizado automaticamente. Preencha manualmente.");
        } finally {
            setBuscandoCnpj(false);
        }
    };

    const handleBuscarCep = async (cepDigitado) => {
        const clean = (cepDigitado || fiscalForm.cep).replace(/\D/g, "");
        if (clean.length !== 8) {
            toast.warning("Digite os 8 números do CEP.");
            return;
        }
        try {
            setBuscandoCep(true);
            const res = await api.get(`/empresas/cep/${clean}`);
            if (res.data?.sucesso) {
                setFiscalForm((prev) => ({
                    ...prev,
                    cep: clean,
                    endereco: res.data.logradouro || prev.endereco,
                    bairro: res.data.bairro || prev.bairro,
                    cidade: res.data.cidade || prev.cidade,
                    estado: res.data.estado || prev.estado,
                }));
                toast.success("Endereço localizado via CEP!");
            }
        } catch (err) {
            toast.error("CEP não localizado. Preencha os campos de endereço manualmente.");
        } finally {
            setBuscandoCep(false);
        }
    };

    const handleSalvarDadosFiscais = async (e) => {
        if (e) e.preventDefault();
        const cleanCpfCnpj = fiscalForm.cnpj_cpf.replace(/\D/g, "");
        if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
            toast.warning("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
            return;
        }

        try {
            setSalvandoDadosFiscais(true);
            await api.put("/empresas/dados-fiscais", fiscalForm);
            setCpfInput(cleanCpfCnpj);
            setSolicitarCpf(false);
            setModalDadosCadastraisOpen(false);
            toast.success("Dados fiscais e endereço atualizados com sucesso!");
            if (faturaSelecionada) {
                handleGerarPix(faturaSelecionada, cleanCpfCnpj);
            }
            carregarAssinatura();
        } catch (err) {
            toast.error(err.response?.data?.error || "Erro ao salvar dados cadastrais.");
        } finally {
            setSalvandoDadosFiscais(false);
        }
    };

    const abrirModalPagamento = (fatura) => {
        setFaturaSelecionada(fatura);
        setMetodoPagamento("pix");
        setPixData(null);

        const currentCpfCnpj = fatura.empresa_cnpj || dados?.empresa?.cnpj_cpf || "";
        setCpfInput(currentCpfCnpj);

        setFiscalForm({
            cnpj_cpf: currentCpfCnpj,
            razao_social: dados?.empresa?.razao_social || "",
            nome_fantasia: dados?.empresa?.nome || "",
            cep: dados?.empresa?.cep || "",
            endereco: dados?.empresa?.endereco || "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: dados?.empresa?.cidade || "",
            estado: dados?.empresa?.estado || "",
        });

        setCartaoForm({
            numero_cartao: "",
            nome_impresso: "",
            validade_mes: "",
            validade_ano: "",
            cvv: "",
            cpf_cnpj: currentCpfCnpj,
            parcelas: 1,
        });

        setModalPagamentoOpen(true);

        if (!currentCpfCnpj) {
            setSolicitarCpf(true);
        } else {
            setSolicitarCpf(false);
            handleGerarPix(fatura, currentCpfCnpj);
        }
    };

    const handleGerarPix = async (fatura, customCpf = null) => {
        try {
            setGerandoPix(true);
            const payload = customCpf
                ? { cpf_cnpj: customCpf }
                : (cpfInput ? { cpf_cnpj: cpfInput } : {});
            const res = await api.post(`/saas-faturas/${fatura.id}/gerar-pix`, payload);
            setPixData({
                ...res.data,
                empresa_nome: dados?.empresa?.nome,
                valor: fatura.valor,
            });
            setSolicitarCpf(false);
        } catch (err) {
            if (err.response?.data?.exige_cpf) {
                setSolicitarCpf(true);
            } else {
                toast.error(err.response?.data?.error || "Erro ao gerar chave Pix");
            }
        } finally {
            setGerandoPix(false);
        }
    };

    const handlePagarCartao = async (e) => {
        e.preventDefault();
        if (!faturaSelecionada) return;

        try {
            setProcessandoCartao(true);
            const res = await api.post(`/saas-faturas/${faturaSelecionada.id}/pagar-cartao`, cartaoForm);
            toast.success(res.data.message || "Pagamento aprovado!");
            setModalPagamentoOpen(false);
            carregarAssinatura();
        } catch (err) {
            toast.error(err.response?.data?.error || "Erro ao processar cartão.");
        } finally {
            setProcessandoCartao(false);
        }
    };

    const copiarPix = (texto) => {
        if (!texto) return;
        navigator.clipboard.writeText(texto);
        toast.success("Código Pix Copia e Cola copiado para a área de transferência!");
    };

    const formatBRL = (v) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    if (loading) {
        return (
            <AdminLayout>
                <div className="py-20 text-center text-slate-400 font-medium">Carregando dados da assinatura...</div>
            </AdminLayout>
        );
    }

    const { empresa, diasTrialRestantes, faturas = [], planosDisponiveis = [] } = dados || {};

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CreditCard className="text-slate-800" size={24} /> Minha Assinatura & Plano SaaS
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        Gerencie o plano da sua empresa, consulte faturas e realize pagamentos via Pix ou Cartão.
                    </p>
                </div>

                {/* Status da Assinatura Banner */}
                <Card padding="md" className={`border-l-4 ${empresa?.status_saas === 'ativo' ? 'border-l-emerald-500 bg-emerald-50/20' : 'border-l-amber-500 bg-amber-50/20'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Status da Sua Empresa
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <h3 className="text-xl font-black text-slate-900">{empresa?.plano_nome || "Plano Profissional"}</h3>
                                <Badge variant={empresa?.status_saas === "ativo" ? "success" : "warning"}>
                                    {empresa?.status_saas?.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {empresa?.status_saas === "trial"
                                    ? empresa?.trial_ate
                                        ? `Seu período de teste gratuito expira em ${diasTrialRestantes} dias (${new Date(empresa.trial_ate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}).`
                                        : `Seu período de teste gratuito de 14 dias está ativo.`
                                    : empresa?.status_saas === "pendente"
                                        ? `Sua fatura foi gerada! Efetue o pagamento abaixo para manter seu acesso ativo.`
                                        : `Assinatura renovada e ativa para ${empresa?.nome}.`}
                            </p>
                        </div>

                        <div className="text-right">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valor Mensal</span>
                            <span className="text-2xl font-black text-slate-900 font-mono">
                                {formatBRL(empresa?.plano_valor)}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Alerta sutil se cadastro fiscal estiver incompleto */}
                {!empresa?.cnpj_cpf && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-600 shrink-0" />
                            <span>Seus dados fiscais e endereço de faturamento ainda não foram preenchidos.</span>
                        </div>
                        <a
                            href={`/admin/${empresaSlug}/empresa`}
                            className="font-bold text-amber-900 hover:text-amber-950 underline shrink-0"
                        >
                            Completar em Minha Empresa →
                        </a>
                    </div>
                )}

                {/* Seleção de Planos (Upgrades) */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        {/* Abas de Segmento (Pessoal vs Empresarial) */}
                        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start">
                            <button
                                onClick={() => setAbaSegmento("pessoal")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    abaSegmento === "pessoal"
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                <span className="text-base">👤</span> Para Você & Família (Pessoal)
                            </button>
                            <button
                                onClick={() => setAbaSegmento("empresarial")}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    abaSegmento === "empresarial"
                                        ? "bg-white text-emerald-800 shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                <span className="text-base">🏢</span> Para sua Empresa (PMEs)
                            </button>
                        </div>

                        {/* Toggle Mensal vs Anual */}
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
                            <button
                                onClick={() => setCicloAnual(false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!cicloAnual ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Mensal
                            </button>
                            <button
                                onClick={() => setCicloAnual(true)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${cicloAnual ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Anual <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">Desconto</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {planosDisponiveis
                            .filter(p => p.ativo !== 0 && (p.tipo_publico || "empresarial") === abaSegmento)
                            .map((p) => {
                            const isAtual = p.id === empresa?.plano_saas_id;
                            const recursosObj = typeof p.recursos === "string" ? JSON.parse(p.recursos || "{}") : (p.recursos || {});
                            
                            const valorMensalOriginal = parseFloat(p.valor || 0);
                            const valorAnualTotal = p.valor_anual ? parseFloat(p.valor_anual) : null;
                            const precoExibidoMes = (cicloAnual && valorAnualTotal) ? (valorAnualTotal / 12) : valorMensalOriginal;
                            const custo12Meses = valorMensalOriginal * 12;
                            const economiaAnual = (cicloAnual && valorAnualTotal && custo12Meses > valorAnualTotal) ? (custo12Meses - valorAnualTotal) : 0;

                            return (
                                <Card
                                    key={p.id}
                                    padding="md"
                                    className={`flex flex-col justify-between relative transition-all ${isAtual
                                            ? "border-2 border-emerald-500 shadow-md bg-emerald-50/10"
                                            : p.is_popular
                                                ? "border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-md"
                                                : "hover:border-slate-300"
                                        }`}
                                >
                                    {isAtual ? (
                                        <span className="absolute -top-3 right-4 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                                            Plano Atual
                                        </span>
                                    ) : Boolean(p.is_popular) ? (
                                        <span className="absolute -top-3 right-4 bg-amber-500 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                            <Sparkles size={11} /> Mais Popular
                                        </span>
                                    ) : null}

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                p.tipo_publico === "pessoal" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                                            }`}>
                                                {p.tipo_publico === "pessoal" ? "👤 Uso Pessoal" : "🏢 Uso Empresarial"}
                                            </span>
                                        </div>
                                        <h3 className="font-extrabold text-slate-900 text-lg">{p.nome}</h3>
                                        <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{p.descricao}</p>

                                        <div className="mt-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-slate-900 font-mono">{formatBRL(precoExibidoMes)}</span>
                                                <span className="text-xs text-slate-400 font-medium"> / mês</span>
                                            </div>
                                            {cicloAnual && valorAnualTotal ? (
                                                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-0.5">
                                                    <span className="text-xs text-slate-600 font-medium block">
                                                        Cobrado anualmente: <strong className="text-slate-900 font-mono">{formatBRL(valorAnualTotal)}/ano</strong>
                                                    </span>
                                                    {economiaAnual > 0 && (
                                                        <span className="text-[11px] text-emerald-700 font-extrabold flex items-center gap-1">
                                                            Economia de {formatBRL(economiaAnual)}/ano 🎉 (2 meses grátis)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-500 font-medium block mt-1.5">
                                                    Faturamento mensal sem fidelidade
                                                </span>
                                            )}
                                        </div>

                                        <ul className="text-xs text-slate-700 space-y-2 border-t border-slate-100 pt-3 mb-4">
                                            <li className="flex items-center gap-2 font-semibold">
                                                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                                                Até {p.max_filiais} {p.tipo_publico === "pessoal" ? "carteira(s)/caixa" : "filial(is)"}
                                            </li>
                                            <li className="flex items-center gap-2 font-semibold">
                                                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                                                Até {p.max_usuarios} usuário(s) simultâneo(s)
                                            </li>
                                            <li className="flex items-center gap-2 font-semibold">
                                                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                                                Até {p.max_transacoes_mes} lançamentos/mês
                                            </li>
                                        </ul>

                                        {/* Módulos do plano */}
                                        <div className="space-y-1.5 text-[11px] border-t border-slate-100 pt-3">
                                            {RECURSOS_PADRAO.map((rec) => {
                                                const temRecurso = recursosObj[rec.key] ?? false;
                                                return (
                                                    <div key={rec.key} className="flex items-center gap-1.5">
                                                        {temRecurso ? (
                                                            <Check size={13} className="text-emerald-600 shrink-0" />
                                                        ) : (
                                                            <span className="w-3 h-3 block text-slate-300 text-center leading-none shrink-0">•</span>
                                                        )}
                                                        <span className={temRecurso ? "text-slate-800 font-semibold" : "text-slate-400 line-through"}>
                                                            {rec.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-3 border-t border-slate-100">
                                        <Button
                                            variant={isAtual ? "secondary" : p.is_popular ? "dark" : "dark"}
                                            className="w-full"
                                            disabled={isAtual || trocandoPlano}
                                            onClick={() => handleTrocarPlano(p)}
                                        >
                                            {isAtual ? "Plano Ativo" : "Migrar para este Plano"}
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Histórico de Faturas */}
                <div>
                    <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Clock className="text-slate-700" size={18} /> Histórico de Faturas da Sua Empresa
                    </h2>

                    <Card padding="none" className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="px-4 py-3.5">Status</th>
                                        <th className="px-4 py-3.5">Descrição</th>
                                        <th className="px-4 py-3.5">Vencimento</th>
                                        <th className="px-4 py-3.5 text-right">Valor</th>
                                        <th className="px-4 py-3.5 text-center">Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {faturas.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-slate-400">
                                                Nenhuma fatura gerada para sua empresa.
                                            </td>
                                        </tr>
                                    ) : (
                                        faturas.map((f) => (
                                            <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={
                                                            f.status === "pago"
                                                                ? "success"
                                                                : f.status === "vencido"
                                                                    ? "danger"
                                                                    : "warning"
                                                        }
                                                        icon={f.status === "pago" ? <CheckCircle size={11} /> : <Clock size={11} />}
                                                    >
                                                        {f.status?.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-900">
                                                    {f.plano_nome || "Mensalidade SaaS"} - Fatura #{f.id}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {new Date(f.data_vencimento).toLocaleDateString("pt-BR")}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                                                    {formatBRL(f.valor)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {f.status !== "pago" ? (
                                                        <button
                                                            onClick={() => abrirModalPagamento(f)}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer transition-colors"
                                                        >
                                                            <DollarSign size={13} />
                                                            Pagar Agora (Pix / Cartão)
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                                                            <CheckCircle size={13} /> Pago em {f.data_pagamento ? new Date(f.data_pagamento).toLocaleDateString("pt-BR") : "Dia"}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Modal Seletor de Pagamento: Pix ou Cartão */}
                <Modal
                    isOpen={modalPagamentoOpen}
                    onClose={() => setModalPagamentoOpen(false)}
                    title={`Pagar Fatura #${faturaSelecionada?.id || ''}`}
                    icon={<DollarSign className="text-emerald-600" size={18} />}
                    size="md"
                >
                    {faturaSelecionada && (
                        <div className="space-y-4 text-xs">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] text-slate-500 block">Sua Empresa</span>
                                    <span className="font-bold text-slate-900 text-sm">{empresa?.nome}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[11px] text-slate-500 block">Valor a Pagar</span>
                                    <span className="font-extrabold text-slate-900 text-base font-mono">
                                        {formatBRL(faturaSelecionada.valor)}
                                    </span>
                                </div>
                            </div>

                            {/* SE PRECISA DE DADOS FISCAIS / ENDEREÇO (PASSO 1) */}
                            {solicitarCpf ? (
                                <form onSubmit={handleSalvarDadosFiscais} className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-left space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                                            <Building2 size={18} className="shrink-0 text-amber-600" />
                                            <span>Dados de Faturamento & Endereço</span>
                                        </div>
                                        <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                                            Obrigatório para emissão
                                        </span>
                                    </div>

                                    <p className="text-slate-600 text-xs">
                                        Para registrar sua cobrança oficial no Asaas e liberar seu acesso, preencha os dados abaixo. Ao digitar o <b>CNPJ</b> ou <b>CEP</b>, os campos são preenchidos automaticamente!
                                    </p>

                                    {/* CPF / CNPJ com botão de consulta */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            CPF ou CNPJ do Titular *
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                placeholder="Digite seu CPF ou CNPJ..."
                                                value={fiscalForm.cnpj_cpf}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, cnpj_cpf: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                            {fiscalForm.cnpj_cpf.replace(/\D/g, "").length === 14 && (
                                                <button
                                                    type="button"
                                                    disabled={buscandoCnpj}
                                                    onClick={() => handleBuscarCnpj(fiscalForm.cnpj_cpf)}
                                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                                >
                                                    {buscandoCnpj ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Search size={14} />
                                                    )}
                                                    Buscar CNPJ
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Razão Social / Nome Fantasia */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Razão Social / Nome Completo
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Razão social ou seu nome"
                                                value={fiscalForm.razao_social}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, razao_social: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Nome Fantasia / Empresa
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nome fantasia"
                                                value={fiscalForm.nome_fantasia}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, nome_fantasia: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* CEP com busca automática */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-1">
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                CEP
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    maxLength="9"
                                                    placeholder="00000-000"
                                                    value={fiscalForm.cep}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFiscalForm({ ...fiscalForm, cep: val });
                                                        if (val.replace(/\D/g, "").length === 8) {
                                                            handleBuscarCep(val);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                                />
                                                {buscandoCep && (
                                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Endereço / Rua
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Rua, Avenida, Alameda..."
                                                value={fiscalForm.endereco}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, endereco: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Número, Bairro, Cidade, Estado */}
                                    <div className="grid grid-cols-4 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Número
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="123"
                                                value={fiscalForm.numero}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, numero: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Bairro
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Bairro"
                                                value={fiscalForm.bairro}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, bairro: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Cidade
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Cidade"
                                                value={fiscalForm.cidade}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, cidade: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                UF
                                            </label>
                                            <input
                                                type="text"
                                                maxLength="2"
                                                placeholder="SP"
                                                value={fiscalForm.estado}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, estado: e.target.value.toUpperCase() })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 flex items-center justify-end gap-2">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="sm"
                                            loading={salvandoDadosFiscais || gerandoPix}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <CheckCircle size={16} /> Salvar Dados e Prosseguir para o Pagamento
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    {/* Abas Pix vs Cartão */}
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setMetodoPagamento("pix")}
                                            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${metodoPagamento === "pix"
                                                ? "bg-white text-emerald-700 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800"
                                                }`}
                                        >
                                            <QrCode size={15} />
                                            Pix Instantâneo
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setMetodoPagamento("cartao")}
                                            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${metodoPagamento === "cartao"
                                                ? "bg-white text-emerald-700 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800"
                                                }`}
                                        >
                                            <CreditCard size={15} />
                                            Cartão de Crédito
                                        </button>
                                    </div>

                                    {/* CONTEÚDO PIX */}
                                    {metodoPagamento === "pix" && (
                                        <div className="space-y-4 text-center py-2">
                                            {gerandoPix ? (
                                                <div className="py-8 text-slate-400 font-medium">Gerando dados de cobrança no Asaas...</div>
                                            ) : pixData ? (
                                        <>
                                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl inline-block mx-auto">
                                                {pixData.pix_qr_code_url ? (
                                                    <img
                                                        src={pixData.pix_qr_code_url}
                                                        alt="QR Code Pix"
                                                        className="w-44 h-44 mx-auto rounded-lg shadow-xs"
                                                    />
                                                ) : (
                                                    <div className="w-44 h-44 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg">
                                                        Sem imagem QR Code
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                                    Pix Copia e Cola:
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={pixData.pix_copia_cola || ""}
                                                        className="w-full text-[10px] font-mono p-2 bg-white border border-slate-200 rounded-lg text-slate-600 select-all"
                                                    />
                                                    <button
                                                        onClick={() => copiarPix(pixData.pix_copia_cola)}
                                                        className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shrink-0"
                                                        title="Copiar Código Pix"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Links extras do Asaas (Boleto Bancário e Cartão/Fatura Online) */}
                                            <div className="flex flex-col gap-2 pt-1">
                                                {pixData.bank_slip_url && (
                                                    <a
                                                        href={pixData.bank_slip_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                                                    >
                                                        <ExternalLink size={14} /> Abrir Boleto Bancário Oficial (PDF)
                                                    </a>
                                                )}

                                                {pixData.invoice_url && (
                                                    <a
                                                        href={pixData.invoice_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 shadow-xs"
                                                    >
                                                        <ExternalLink size={14} /> Pagar com Cartão ou Boleto Online
                                                    </a>
                                                )}
                                            </div>

                                            <p className="text-[11px] text-slate-400 leading-tight">
                                                Assim que o pagamento for concluído no aplicativo do banco, seu sistema reconhece em 2 segundos e renova seu acesso!
                                            </p>
                                        </>
                                    ) : null}
                                </div>
                            )}

                            {/* CONTEÚDO CARTÃO DE CRÉDITO */}
                            {metodoPagamento === "cartao" && (
                                <div className="space-y-4 pt-1">
                                    {/* Opção Rápida: Checkout Asaas Oficial */}
                                    {pixData?.invoice_url && (
                                        <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md space-y-2 text-center">
                                            <p className="font-bold text-xs">Pagar com Cartão com 1 Clique</p>
                                            <p className="text-[11px] text-blue-100">
                                                Abra a página segura da Asaas com validação 3D Secure e todas as bandeiras.
                                            </p>
                                            <a
                                                href={pixData.invoice_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-white text-slate-900 rounded-xl font-extrabold text-xs shadow hover:bg-slate-100 transition"
                                            >
                                                <ExternalLink size={14} /> Abrir Fatura Segura na Asaas
                                            </a>
                                        </div>
                                    )}

                                    {/* Formulário Direto de Cartão */}
                                    <form onSubmit={handlePagarCartao} className="space-y-3">
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <span className="font-bold text-slate-800 text-xs block mb-2">Dados do Cartão de Crédito</span>

                                            <div className="space-y-2.5">
                                                <div>
                                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Número do Cartão *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="4532 •••• •••• ••••"
                                                        maxLength="19"
                                                        value={cartaoForm.numero_cartao}
                                                        onChange={(e) => setCartaoForm({ ...cartaoForm, numero_cartao: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Nome Impresso no Cartão *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="NOME COMO NO CARTÃO"
                                                        value={cartaoForm.nome_impresso}
                                                        onChange={(e) => setCartaoForm({ ...cartaoForm, nome_impresso: e.target.value.toUpperCase() })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold text-xs"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Mês *</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="MM"
                                                            maxLength="2"
                                                            value={cartaoForm.validade_mes}
                                                            onChange={(e) => setCartaoForm({ ...cartaoForm, validade_mes: e.target.value })}
                                                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Ano *</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="AA"
                                                            maxLength="4"
                                                            value={cartaoForm.validade_ano}
                                                            onChange={(e) => setCartaoForm({ ...cartaoForm, validade_ano: e.target.value })}
                                                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">CVV *</label>
                                                        <input
                                                            type="password"
                                                            required
                                                            placeholder="•••"
                                                            maxLength="4"
                                                            value={cartaoForm.cvv}
                                                            onChange={(e) => setCartaoForm({ ...cartaoForm, cvv: e.target.value })}
                                                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono text-xs focus:ring-2 focus:ring-blue-600"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Se for plano ANUAL, exibe parcelamento de até 12x. Se for MENSAL, exibe aviso de recorrência sem parcelas */}
                                                {(() => {
                                                    const isAnual = faturaSelecionada.ciclo === "anual" || parseFloat(faturaSelecionada.valor) > 250;
                                                    return (
                                                        <div className="space-y-2.5">
                                                            <div className={isAnual ? "grid grid-cols-2 gap-2" : ""}>
                                                                <div>
                                                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">CPF do Titular *</label>
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        placeholder="000.000.000-00"
                                                                        value={cartaoForm.cpf_cnpj}
                                                                        onChange={(e) => setCartaoForm({ ...cartaoForm, cpf_cnpj: e.target.value })}
                                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-600"
                                                                    />
                                                                </div>

                                                                {isAnual && (
                                                                    <div>
                                                                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                                                            Parcelamento do Plano Anual
                                                                        </label>
                                                                        <select
                                                                            value={cartaoForm.parcelas}
                                                                            onChange={(e) => setCartaoForm({ ...cartaoForm, parcelas: parseInt(e.target.value, 10) })}
                                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-2 focus:ring-blue-600"
                                                                        >
                                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                                                                <option key={n} value={n}>
                                                                                    {n}x de {formatBRL(faturaSelecionada.valor / n)} {n === 1 ? "à vista" : "sem juros"}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {isAnual ? (
                                                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                                                                    <Sparkles size={14} className="text-emerald-600 shrink-0" />
                                                                    <span><b>Plano Anual:</b> Acesso liberado por 1 ano inteiro (365 dias) após a confirmação!</span>
                                                                </div>
                                                            ) : (
                                                                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-blue-800 text-xs">
                                                                    <Zap size={14} className="text-blue-600 shrink-0" />
                                                                    <span><b>Cobrança Recorrente Mensal:</b> Seu cartão será debitado mensalmente no valor de {formatBRL(faturaSelecionada.valor)}. Cancele quando quiser.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setModalPagamentoOpen(false)}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                loading={processandoCartao}
                                                icon={<Lock size={14} />}
                                            >
                                                Pagar no Cartão de Crédito
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </Modal>

        {/* Modal de Confirmação Acessível */}
        <ConfirmDialog />
            </div>
        </AdminLayout>
    );
}
