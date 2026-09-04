import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card } from "../../components/ui";
import { toast } from "sonner";
import {
  Building2,
  User,
  Search,
  MapPin,
  Mail,
  Phone,
  CheckCircle,
  FileText,
  AlertCircle,
  Save,
  Globe,
} from "lucide-react";

export default function MinhaEmpresa() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [tipoPerfil, setTipoPerfil] = useState("empresa"); // 'pessoal' | 'empresa'

  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    cnpj_cpf: "",
    slug: "",
    email: "",
    telefone: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    plano_nome: "",
    status_saas: "",
  });

  const carregarEmpresa = async () => {
    try {
      setLoading(true);
      const res = await api.get("/empresas/minha");
      const d = res.data || {};

      // O tipo de perfil é estritamente determinado pelo plano do assinante
      const planoTipo = d.plano_tipo_publico || user?.plano_tipo_publico;
      const docLimpo = (d.cnpj_cpf || "").replace(/\D/g, "");
      
      const isPessoal = planoTipo === "pessoal" || (!planoTipo && docLimpo.length === 11);
      setTipoPerfil(isPessoal ? "pessoal" : "empresa");

      setForm({
        nome: d.nome || "",
        razao_social: d.razao_social || "",
        cnpj_cpf: d.cnpj_cpf || "",
        slug: d.slug || "",
        email: d.email || "",
        telefone: d.telefone || "",
        cep: d.cep || "",
        endereco: d.endereco || "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: d.cidade || "",
        estado: d.estado || "",
        plano_nome: d.plano_nome || "Plano Pro",
        status_saas: d.status_saas || "ativo",
      });
    } catch (err) {
      toast.error("Erro ao carregar dados cadastrais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEmpresa();
  }, []);

  const handleBuscarCnpj = async (cnpjDigitado) => {
    const clean = (cnpjDigitado || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.warning("Digite os 14 dígitos do CNPJ para pesquisar na Receita.");
      return;
    }

    try {
      setBuscandoCnpj(true);
      const res = await api.get(`/empresas/cnpj/${clean}`);
      if (res.data?.sucesso) {
        const d = res.data;
        setForm((prev) => ({
          ...prev,
          cnpj_cpf: clean,
          razao_social: d.razao_social || prev.razao_social,
          nome: d.nome_fantasia || d.razao_social || prev.nome,
          cep: d.cep || prev.cep,
          endereco: d.logradouro || prev.endereco,
          numero: d.numero || prev.numero,
          complemento: d.complemento || prev.complemento,
          bairro: d.bairro || prev.bairro,
          cidade: d.cidade || prev.cidade,
          estado: d.estado || prev.estado,
          email: d.email || prev.email,
          telefone: d.telefone || prev.telefone,
        }));
        toast.success("Dados preenchidos com sucesso via Receita Federal!");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "CNPJ não localizado na Receita Federal.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleBuscarCep = async (cepDigitado) => {
    const clean = (cepDigitado || "").replace(/\D/g, "");
    if (clean.length !== 8) return;

    try {
      setBuscandoCep(true);
      const res = await api.get(`/empresas/cep/${clean}`);
      if (res.data?.sucesso) {
        setForm((prev) => ({
          ...prev,
          cep: clean,
          endereco: res.data.logradouro || prev.endereco,
          bairro: res.data.bairro || prev.bairro,
          cidade: res.data.cidade || prev.cidade,
          estado: res.data.estado || prev.estado,
        }));
      }
    } catch (err) {
      // Silencioso se CEP não encontrado
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      setMensagemSucesso("");

      await api.put("/empresas/dados-fiscais", {
        cnpj_cpf: form.cnpj_cpf,
        razao_social: isPessoal ? form.nome : form.razao_social,
        nome_fantasia: form.nome,
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        cep: form.cep,
      });

      await api.put("/empresas/minha", {
        nome: form.nome,
        razao_social: isPessoal ? form.nome : form.razao_social,
        cnpj_cpf: form.cnpj_cpf,
        email: form.email,
        telefone: form.telefone,
        endereco: form.endereco,
        cidade: form.cidade,
        estado: form.estado,
        cep: form.cep,
      });

      toast.success(
        isPessoal
          ? "Seus dados pessoais foram salvos com sucesso!"
          : "Dados da empresa atualizados com sucesso!"
      );
      carregarEmpresa();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar dados.");
    } finally {
      setSalvando(false);
    }
  };

  const isCadastroCompleto = Boolean(form.cnpj_cpf && form.endereco && form.cidade);
  const isPessoal = tipoPerfil === "pessoal";

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-slate-400 font-medium">Carregando dados cadastrais...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Cabeçalho Contextual */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${
                  isPessoal ? "bg-blue-600" : "bg-emerald-600"
                }`}
              >
                {isPessoal ? <User size={20} /> : <Building2 size={20} />}
              </div>
              {isPessoal ? "Meus Dados Cadastrais" : "Minha Empresa"}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isPessoal
                ? "Gerencie suas informações pessoais, CPF e endereço residencial para emissão das suas faturas."
                : "Gerencie a identificação jurídica, dados fiscais e endereço de faturamento do seu negócio."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${
                isPessoal
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {isPessoal ? (
                <>
                  <User size={13} /> Plano Pessoal
                </>
              ) : (
                <>
                  <Building2 size={13} /> Plano Empresarial
                </>
              )}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${
                isCadastroCompleto
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {isCadastroCompleto ? (
                <>
                  <CheckCircle size={14} className="text-emerald-600" /> Cadastro Completo
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-amber-600" /> Cadastro Incompleto
                </>
              )}
            </span>
          </div>
        </div>

        {mensagemSucesso && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            {mensagemSucesso}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BLOCO 1: Identificação */}
          <Card padding="md">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText size={16} className={isPessoal ? "text-blue-600" : "text-emerald-600"} />
                {isPessoal
                  ? "Identificação do Titular (Pessoa Física)"
                  : "Identificação & Dados Fiscais (Receita Federal)"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isPessoal
                  ? "Seu CPF e nome completo para registro oficial da sua conta e faturamento."
                  : "Digite o CNPJ para preencher os dados da empresa automaticamente via Receita Federal."}
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* CPF (Pessoal) ou CNPJ (Empresarial) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isPessoal ? "CPF do Titular" : "CNPJ da Empresa"} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 max-w-md">
                  <input
                    type="text"
                    required
                    placeholder={isPessoal ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={form.cnpj_cpf}
                    onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })}
                    className={`flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:bg-white focus:outline-none font-bold ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                  {!isPessoal && form.cnpj_cpf.replace(/\D/g, "").length === 14 && (
                    <button
                      type="button"
                      disabled={buscandoCnpj}
                      onClick={() => handleBuscarCnpj(form.cnpj_cpf)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {buscandoCnpj ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search size={14} />
                      )}
                      Buscar na Receita
                    </button>
                  )}
                </div>
                {!isPessoal && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Ao clicar em "Buscar na Receita", a Razão Social, Nome Fantasia e Endereço são completados em 1 segundo.
                  </span>
                )}
              </div>

              {/* Campos de Nome / Razão Social */}
              <div className={`grid grid-cols-1 ${isPessoal ? "" : "md:grid-cols-2"} gap-4`}>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isPessoal ? "Nome Completo do Titular" : "Nome Fantasia / Nome Comercial"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isPessoal ? "Seu nome completo" : "Nome comercial da empresa"}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none font-bold ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>

                {!isPessoal && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Razão Social Oficial
                    </label>
                    <input
                      type="text"
                      placeholder="Razão social jurídica registrada"
                      value={form.razao_social}
                      onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Endereço URL do seu Painel (Slug)
                </label>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 font-mono text-xs">
                  <Globe size={14} className="text-slate-400 shrink-0" />
                  <span>financas.nuvycore.online/admin/<b>{form.slug}</b></span>
                </div>
              </div>
            </div>
          </Card>

          {/* BLOCO 2: Endereço & Localização */}
          <Card padding="md">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin size={16} className={isPessoal ? "text-blue-600" : "text-emerald-600"} />
                {isPessoal ? "Endereço Residencial" : "Endereço de Faturamento & Localização"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isPessoal
                  ? "Endereço do titular utilizado para fins de registro e emissão de cobranças."
                  : "Endereço utilizado para o faturamento e emissão de notas das mensalidades."}
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* CEP & Rua */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    CEP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength="9"
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({ ...form, cep: v });
                        if (v.replace(/\D/g, "").length === 8) handleBuscarCep(v);
                      }}
                      className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                        isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                      }`}
                    />
                    {buscandoCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div
                          className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                            isPessoal ? "border-blue-600" : "border-emerald-600"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Busca automática ao digitar 8 números</span>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Logradouro / Rua / Avenida
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Av. Paulista, Rua XV de Novembro..."
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>
              </div>

              {/* Número, Complemento, Bairro, Cidade, UF */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Apto 42, Bloco C"
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    placeholder="Centro, Jardim..."
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">UF (Estado)</label>
                  <input
                    type="text"
                    maxLength="2"
                    placeholder="SP"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* BLOCO 3: Contatos */}
          <Card padding="md">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail size={16} className={isPessoal ? "text-blue-600" : "text-emerald-600"} />
                {isPessoal ? "Seus Contatos Oficiais" : "Contatos Oficiais da Empresa"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isPessoal
                  ? "Seu e-mail e WhatsApp para recebimento de faturas, avisos e lembretes da Cora IA."
                  : "Meios de contato institucional e comunicações do sistema."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isPessoal ? "Seu E-mail" : "E-mail Oficial / Financeiro"}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                  <Mail size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isPessoal ? "Seu WhatsApp / Celular" : "WhatsApp / Telefone Comercial"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className={`w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:bg-white focus:outline-none ${
                      isPessoal ? "focus:ring-blue-500" : "focus:ring-emerald-500"
                    }`}
                  />
                  <Phone size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </Card>

          {/* Botão de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={salvando}
              icon={<Save size={16} />}
              className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-md cursor-pointer ${
                isPessoal
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isPessoal ? "Salvar Meus Dados" : "Salvar Informações da Empresa"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
