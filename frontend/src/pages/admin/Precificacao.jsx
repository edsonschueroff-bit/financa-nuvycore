import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Search,
  TrendingUp,
  DollarSign,
  Percent,
  Layers,
  Trash2,
  Edit2,
  X,
  Sparkles,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  PieChart,
} from "lucide-react";

export default function Precificacao() {
  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // todos | produto | servico
  const [search, setSearch] = useState("");
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Modal Novo / Editar Item
  const [modalItem, setModalItem] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    tipo: "servico",
    unidade_medida: "un",
    custo_direto: "",
    aliquota_impostos: "6.0", // Ex: Simples Nacional 6%
    aliquota_comissao: "5.0",
    aliquota_taxas_cartao: "3.5",
    aliquota_despesas_fixas: "15.0",
    margem_lucro_desejada: "20.0",
    preco_praticado: "",
    observacoes: "",
  });

  // Simulação em tempo real para o modal
  const [simulacao, setSimulacao] = useState(null);

  const carregarDados = async () => {
    try {
      setLoading(true);
      let url = `/precificacao?search=${search}`;
      if (tipoFiltro !== "todos") {
        url += `&tipo=${tipoFiltro}`;
      }
      const res = await api.get(url);
      setItens(res.data.itens || []);
      setResumo(res.data.resumo || null);
    } catch (err) {
      console.error("Erro ao carregar itens de precificação:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [tipoFiltro, search]);

  // Recalcular simulação ao alterar qualquer campo do formulário
  useEffect(() => {
    const calcular = async () => {
      if (!form.custo_direto || isNaN(parseFloat(form.custo_direto))) {
        setSimulacao(null);
        return;
      }
      try {
        const res = await api.post("/precificacao/simular", form);
        setSimulacao(res.data);
      } catch (err) {
        console.error("Erro ao simular:", err);
      }
    };
    calcular();
  }, [form]);

  const handleAbrirNovo = () => {
    setEditandoId(null);
    setForm({
      nome: "",
      tipo: "servico",
      unidade_medida: "un",
      custo_direto: "",
      aliquota_impostos: "6.0",
      aliquota_comissao: "5.0",
      aliquota_taxas_cartao: "3.5",
      aliquota_despesas_fixas: "15.0",
      margem_lucro_desejada: "20.0",
      preco_praticado: "",
      observacoes: "",
    });
    setModalItem(true);
  };

  const handleAbrirEditar = (item) => {
    setEditandoId(item.id);
    setForm({
      nome: item.nome || "",
      tipo: item.tipo || "servico",
      unidade_medida: item.unidade_medida || "un",
      custo_direto: item.custo_direto || "",
      aliquota_impostos: item.aliquota_impostos || "0",
      aliquota_comissao: item.aliquota_comissao || "0",
      aliquota_taxas_cartao: item.aliquota_taxas_cartao || "0",
      aliquota_despesas_fixas: item.aliquota_despesas_fixas || "0",
      margem_lucro_desejada: item.margem_lucro_desejada || "0",
      preco_praticado: item.preco_praticado || "",
      observacoes: item.observacoes || "",
    });
    setModalItem(true);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      if (editandoId) {
        await api.put(`/precificacao/${editandoId}`, form);
      } else {
        await api.post("/precificacao", form);
      }
      setModalItem(false);
      toast.success(editandoId ? "Precificação atualizada com sucesso!" : "Precificação cadastrada com sucesso!");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar precificação.");
    }
  };

  const handleExcluir = async (id) => {
    const ok = await confirm({
      title: "Excluir Precificação",
      description: "Deseja realmente excluir este cálculo de precificação?",
      variant: "danger",
      confirmText: "Excluir",
    });
    if (!ok) return;

    try {
      await api.delete(`/precificacao/${id}`);
      toast.success("Precificação excluída com sucesso.");
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir.");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="text-emerald-600" size={26} /> Precificação Inteligente & Markup
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Calculadora científica de Preço Ideal, Markup Divisor/Multiplicador e Margem de Contribuição real.
            </p>
          </div>

          <button
            onClick={handleAbrirNovo}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} /> Novo Produto / Serviço
          </button>
        </div>

        {/* Resumo Executivo da Carteira */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              TOTAL DE ITENS PRECIFADOS
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{resumo?.total_itens || 0}</p>
            <span className="text-[11px] text-slate-500">
              {resumo?.servicos_count || 0} Serviços • {resumo?.produtos_count || 0} Produtos
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
              MARGEM DE CONTRIBUIÇÃO MÉDIA
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {resumo?.margem_media || 0}%
            </p>
            <span className="text-[11px] text-slate-500">Média geral da sua carteira</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
              MÉTODO DE FORMAÇÃO
            </span>
            <p className="text-base font-bold text-slate-800 mt-1">Markup Divisor</p>
            <span className="text-[10px] text-slate-400">Garante cobertura total de custos e lucro</span>
          </div>

          <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                REGRA DE OURO
              </span>
              <Sparkles size={14} className="text-emerald-400" />
            </div>
            <p className="text-xs font-semibold mt-2 text-emerald-100">
              Margens &gt; 35% garantem saúde financeira e capacidade de investimento!
            </p>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setTipoFiltro("todos")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoFiltro === "todos"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos ({itens.length})
            </button>
            <button
              onClick={() => setTipoFiltro("servico")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoFiltro === "servico"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Serviços
            </button>
            <button
              onClick={() => setTipoFiltro("produto")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoFiltro === "produto"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Produtos
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Tabela de Produtos / Serviços Precificados */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="px-4 py-3.5">Produto / Serviço</th>
                  <th className="px-4 py-3.5">Custo Direto (CMV)</th>
                  <th className="px-4 py-3.5">Markup</th>
                  <th className="px-4 py-3.5">Preço Sugerido</th>
                  <th className="px-4 py-3.5">Preço Praticado</th>
                  <th className="px-4 py-3.5">Margem de Contribuição</th>
                  <th className="px-4 py-3.5">Lucro Unitário</th>
                  <th className="px-4 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      Carregando itens de precificação...
                    </td>
                  </tr>
                ) : itens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      Nenhum produto ou serviço precificado cadastrado. Clique no botão acima para criar o primeiro!
                    </td>
                  </tr>
                ) : (
                  itens.map((item) => {
                    const margem = parseFloat(item.margem_contribuicao_percentual);
                    const isMargemAlta = margem >= 35;
                    const isMargemMedia = margem >= 20 && margem < 35;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 text-sm">{item.nome}</p>
                          <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 mt-0.5">
                            {item.tipo === "servico" ? "Serviço" : "Produto"} ({item.unidade_medida})
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                          {formatBRL(item.custo_direto)}
                        </td>

                        <td className="px-4 py-3 font-mono font-black text-blue-600">
                          {item.markup_multiplicador}x
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-500">
                          {formatBRL(item.preco_sugerido)}
                        </td>

                        <td className="px-4 py-3 font-mono font-black text-slate-900 text-sm">
                          {formatBRL(item.preco_praticado)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full font-black text-[11px] font-mono ${
                                isMargemAlta
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isMargemMedia
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {item.margem_contribuicao_percentual}%
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-bold">
                              ({formatBRL(item.margem_contribuicao_valor)})
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-black text-emerald-600">
                          {formatBRL(item.lucro_estimado_unitario)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleAbrirEditar(item)}
                              title="Editar"
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleExcluir(item.id)}
                              title="Excluir"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Calculadora de Precificação Inteligente & Markup */}
        {modalItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-8">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Calculator className="text-emerald-600" size={18} />
                  {editandoId ? "Editar Precificação" : "Nova Calculadora de Precificação"}
                </h3>
                <button
                  onClick={() => setModalItem(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSalvar} className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nome do Produto / Serviço *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Consultoria Mensal, Plano de Internet..."
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipo</label>
                    <select
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="servico">Serviço</option>
                      <option value="produto">Produto Físico</option>
                    </select>
                  </div>
                </div>

                {/* Bloco de Entradas da Precificação */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    1. Custos Diretos & Despesas Sobre a Venda (%)
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Custo Direto / CMV (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ex: 50.00"
                        value={form.custo_direto}
                        onChange={(e) => setForm({ ...form, custo_direto: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Impostos (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.aliquota_impostos}
                        onChange={(e) => setForm({ ...form, aliquota_impostos: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Comissões (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.aliquota_comissao}
                        onChange={(e) => setForm({ ...form, aliquota_comissao: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Taxas Cartão (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.aliquota_taxas_cartao}
                        onChange={(e) =>
                          setForm({ ...form, aliquota_taxas_cartao: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Despesas Fixas (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.aliquota_despesas_fixas}
                        onChange={(e) =>
                          setForm({ ...form, aliquota_despesas_fixas: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-emerald-700 mb-1">Lucro Desejado (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.margem_lucro_desejada}
                        onChange={(e) =>
                          setForm({ ...form, margem_lucro_desejada: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco de Resultados Calculados da Simulação */}
                {simulacao && (
                  <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
                      2. Resultados da Simulação Científica
                    </span>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                        <span className="text-[9px] text-slate-400 font-bold block">MARKUP CALCULADO</span>
                        <p className="font-mono font-black text-blue-600 text-sm mt-0.5">
                          {simulacao.markup_multiplicador}x
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                        <span className="text-[9px] text-slate-400 font-bold block">PREÇO SUGERIDO</span>
                        <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                          {formatBRL(simulacao.preco_sugerido)}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                        <span className="text-[9px] text-emerald-700 font-bold block">MARGEM CONTRIBUIÇÃO</span>
                        <p className="font-mono font-black text-emerald-700 text-sm mt-0.5">
                          {simulacao.margem_contribuicao_percentual}%
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-600 font-bold">Preço Praticado no Mercado:</span>
                        <p className="text-[10px] text-slate-400">Você pode ajustar se vender por outro valor</p>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={simulacao.preco_sugerido.toString()}
                        value={form.preco_praticado}
                        onChange={(e) => setForm({ ...form, preco_praticado: e.target.value })}
                        className="w-36 px-3 py-1.5 bg-white border border-emerald-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono text-sm text-right"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalItem(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md transition-all cursor-pointer"
                  >
                    Salvar Precificação
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
