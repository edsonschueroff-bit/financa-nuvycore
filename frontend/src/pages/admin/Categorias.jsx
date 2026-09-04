import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Modal, Card, useConfirmDialog } from "../../components/ui";
import { toast } from "sonner";
import { usePlanoContext } from "../../hooks/usePlanoContext";
import {
  FolderTree,
  Plus,
  Layers,
  Target,
  Edit2,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Building,
  Sparkles,
} from "lucide-react";

export default function Categorias() {
  const { isPersonal } = usePlanoContext();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [categorias, setCategorias] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("categorias"); // categorias | centros

  // Modal Categoria
  const [modalCat, setModalCat] = useState(false);
  const [editandoCat, setEditandoCat] = useState(null);
  const [formCat, setFormCat] = useState({
    nome: "",
    tipo: "despesa",
    dre_grupo: "despesa_fixa",
    cor: "#059669",
  });

  // Modal Centro de Custo
  const [modalCentro, setModalCentro] = useState(false);
  const [editandoCentro, setEditandoCentro] = useState(null);
  const [formCentro, setFormCentro] = useState({
    nome: "",
    codigo: "",
    responsavel: "",
    orcamento_mensal: "0.00",
    cor: "#059669",
  });

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [catRes, ccRes] = await Promise.all([
        api.get("/categorias"),
        api.get("/categorias/centros-custo/todos"),
      ]);
      setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
      setCentrosCusto(ccRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar categorias e centros:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleSalvarCategoria = async (e) => {
    e.preventDefault();
    try {
      if (editandoCat) {
        await api.put(`/categorias/${editandoCat.id}`, formCat);
        toast.success("Categoria atualizada com sucesso!");
      } else {
        await api.post("/categorias", formCat);
        toast.success("Categoria criada com sucesso!");
      }
      setModalCat(false);
      setEditandoCat(null);
      setFormCat({ nome: "", tipo: "despesa", dre_grupo: "despesa_fixa", cor: "#059669" });
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar categoria");
    }
  };

  const handleDeletarCategoria = async (id) => {
    const ok = await confirm({
      title: "Desativar categoria?",
      description: "Deseja realmente desativar esta categoria do plano de contas?",
      confirmText: "Sim, desativar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete(`/categorias/${id}`);
      carregarDados();
      toast.success("Categoria desativada com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao desativar categoria");
    }
  };

  const handleSalvarCentro = async (e) => {
    e.preventDefault();
    try {
      if (editandoCentro) {
        await api.put(`/categorias/centros-custo/${editandoCentro.id}`, formCentro);
        toast.success("Centro de custo atualizado com sucesso!");
      } else {
        await api.post("/categorias/centros-custo", formCentro);
        toast.success("Centro de custo criado com sucesso!");
      }
      setModalCentro(false);
      setEditandoCentro(null);
      setFormCentro({
        nome: "",
        codigo: "",
        responsavel: "",
        orcamento_mensal: "0.00",
        cor: "#059669",
      });
      carregarDados();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar centro de custo");
    }
  };

  const handleDeletarCentro = async (id) => {
    const ok = await confirm({
      title: "Desativar centro de custo?",
      description: "Deseja realmente desativar este centro de custo?",
      confirmText: "Sim, desativar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await api.delete(`/categorias/centros-custo/${id}`);
      carregarDados();
      toast.success("Centro de custo desativado com sucesso!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao desativar centro de custo");
    }
  };

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  // Mapeamento visual dos grupos DRE
  const gruposDreMap = {
    receita_bruta: {
      titulo: "(+) 1. Receitas Operacionais Brutas",
      badgeVariant: "success",
    },
    deducao_receita: {
      titulo: "(-) 2. Deduções da Receita & Impostos",
      badgeVariant: "warning",
    },
    imposto: {
      titulo: "(-) 2.1 Impostos sobre Vendas (Simples/ISS/ICMS)",
      badgeVariant: "warning",
    },
    custo_variavel: {
      titulo: "(-) 3. Custos Variáveis (Fornecedores & Mercadorias)",
      badgeVariant: "warning",
    },
    despesa_fixa: {
      titulo: "(-) 4. Despesas Fixas Operacionais",
      badgeVariant: "danger",
    },
    despesa_financeira: {
      titulo: "(+/-) 5. Resultado Financeiro & Tarifas",
      badgeVariant: "neutral",
    },
  };

  const gruposUnicos = Array.from(new Set(categorias.map((c) => c.dre_grupo || "despesa_fixa")));

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="text-emerald-600" size={24} /> {isPersonal ? "Minhas Categorias" : "Plano de Contas & Centros de Custo"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isPersonal
                ? "Organize suas entradas e saídas familiares por categorias (Alimentação, Moradia, Salário, etc.)."
                : "Estruturação contábil DRE e controle orçamentário por centro de custo (Budgeting)."}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {abaAtiva === "categorias" ? (
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditandoCat(null);
                  setFormCat({
                    nome: "",
                    tipo: "despesa",
                    dre_grupo: "despesa_fixa",
                    cor: "#059669",
                  });
                  setModalCat(true);
                }}
              >
                Nova Categoria
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditandoCentro(null);
                  setFormCentro({
                    nome: "",
                    codigo: "",
                    responsavel: "",
                    orcamento_mensal: "0.00",
                    cor: "#059669",
                  });
                  setModalCentro(true);
                }}
              >
                Novo Centro de Custo
              </Button>
            )}
          </div>
        </div>

        {/* Alternador de Abas (Apenas Empresas) */}
        {!isPersonal && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs w-fit text-xs font-semibold">
            <button
              onClick={() => setAbaAtiva("categorias")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "categorias"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Layers size={14} /> Plano de Contas DRE ({categorias.length})
            </button>
            <button
              onClick={() => setAbaAtiva("centros")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                abaAtiva === "centros"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Target size={14} /> Centros de Custo & Orçamento ({centrosCusto.length})
            </button>
          </div>
        )}

        {/* Aba 1: Categorias Pessoais OU Plano de Contas DRE */}
        {abaAtiva === "categorias" && (
          isPersonal ? (
            <div className="space-y-6">
              {/* Grupo Despesas Pessoais */}
              <Card padding="none" className="overflow-hidden">
                <div className="p-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="text-rose-600" size={16} />
                    <span className="font-black text-xs text-rose-900 uppercase tracking-wider">
                      Categorias de Despesas (Saídas)
                    </span>
                    <Badge variant="danger">
                      {categorias.filter((c) => c.tipo === "despesa").length} categoria(s)
                    </Badge>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {categorias
                    .filter((c) => c.tipo === "despesa")
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.cor || "#059669" }}
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{cat.nome}</p>
                            <p className="text-[11px] text-slate-400">
                              {cat.total_transacoes || 0} lançamento(s) vinculados
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Gasto no Ano
                            </span>
                            <span className="font-black text-slate-900 text-sm font-mono">
                              {formatBRL(cat.total_ano)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setEditandoCat(cat);
                                setFormCat({
                                  nome: cat.nome,
                                  tipo: cat.tipo,
                                  dre_grupo: cat.dre_grupo || "despesa_fixa",
                                  cor: cat.cor || "#059669",
                                });
                                setModalCat(true);
                              }}
                              title="Editar Categoria"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDeletarCategoria(cat.id)}
                              title="Excluir Categoria"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>

              {/* Grupo Receitas Pessoais */}
              <Card padding="none" className="overflow-hidden">
                <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-emerald-600" size={16} />
                    <span className="font-black text-xs text-emerald-900 uppercase tracking-wider">
                      Categorias de Receitas (Entradas)
                    </span>
                    <Badge variant="success">
                      {categorias.filter((c) => c.tipo === "receita").length} categoria(s)
                    </Badge>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {categorias
                    .filter((c) => c.tipo === "receita")
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.cor || "#059669" }}
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{cat.nome}</p>
                            <p className="text-[11px] text-slate-400">
                              {cat.total_transacoes || 0} lançamento(s) vinculados
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Recebido no Ano
                            </span>
                            <span className="font-black text-slate-900 text-sm font-mono">
                              {formatBRL(cat.total_ano)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setEditandoCat(cat);
                                setFormCat({
                                  nome: cat.nome,
                                  tipo: cat.tipo,
                                  dre_grupo: cat.dre_grupo || "receita_bruta",
                                  cor: cat.cor || "#059669",
                                });
                                setModalCat(true);
                              }}
                              title="Editar Categoria"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDeletarCategoria(cat.id)}
                              title="Excluir Categoria"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {gruposUnicos.map((grupoKey) => {
                const grupoConfig = gruposDreMap[grupoKey] || {
                  titulo: `Grupo: ${grupoKey}`,
                  badgeVariant: "neutral",
                };
                const categoriasDoGrupo = categorias.filter(
                  (c) => (c.dre_grupo || "despesa_fixa") === grupoKey
                );

                return (
                  <Card
                    key={grupoKey}
                    padding="none"
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-800">
                          {grupoConfig.titulo}
                        </span>
                        <Badge variant={grupoConfig.badgeVariant}>
                          {categoriasDoGrupo.length} categoria(s)
                        </Badge>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {categoriasDoGrupo.map((cat) => (
                        <div
                          key={cat.id}
                          className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.cor || "#059669" }}
                            />
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{cat.nome}</p>
                              <p className="text-[11px] text-slate-400">
                                {cat.total_transacoes || 0} lançamento(s) vinculados
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                Movimentado no Ano
                              </span>
                              <span className="font-black text-slate-900 text-sm font-mono">
                                {formatBRL(cat.total_ano)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1.5 h-auto text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                onClick={() => {
                                  setEditandoCat(cat);
                                  setFormCat({
                                    nome: cat.nome,
                                    tipo: cat.tipo,
                                    dre_grupo: cat.dre_grupo || "despesa_fixa",
                                    cor: cat.cor || "#059669",
                                  });
                                  setModalCat(true);
                                }}
                                title="Editar Categoria"
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1.5 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDeletarCategoria(cat.id)}
                                title="Excluir Categoria"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* Aba 2: Centros de Custo com Orçamento Mensal (Budget) */}
        {abaAtiva === "centros" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {centrosCusto.map((cc) => {
              const ultrapassou = cc.percentual_consumido > 100;
              const alertaAtencao = cc.percentual_consumido >= 80 && !ultrapassou;

              return (
                <Card
                  key={cc.id}
                  padding="md"
                  hover
                  className="flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cc.cor || "#059669" }}
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                          {cc.codigo || "CC"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto text-slate-400 hover:text-slate-700"
                          onClick={() => {
                            setEditandoCentro(cc);
                            setFormCentro({
                              nome: cc.nome,
                              codigo: cc.codigo || "",
                              responsavel: cc.responsavel || "",
                              orcamento_mensal: cc.orcamento_mensal || "0.00",
                              cor: cc.cor || "#059669",
                            });
                            setModalCentro(true);
                          }}
                          title="Editar Centro"
                        >
                          <Edit2 size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeletarCentro(cc.id)}
                          title="Excluir Centro"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>

                    <h3 className="text-base font-black text-slate-900 mt-2">{cc.nome}</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Responsável: {cc.responsavel || "Não definido"}
                    </p>

                    {/* Orçamento & Gasto do Mês */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Gasto no Mês:</span>
                        <span className="font-black text-slate-900 font-mono">
                          {formatBRL(cc.gasto_mes_atual)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Teto Orçamentário:</span>
                        <span className="font-bold text-slate-700 font-mono">
                          {formatBRL(cc.orcamento_mensal)}
                        </span>
                      </div>

                      {/* Barra de Progresso do Orçamento */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ultrapassou
                              ? "bg-rose-500"
                              : alertaAtencao
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, cc.percentual_consumido)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <Badge
                          variant={
                            ultrapassou ? "danger" : alertaAtencao ? "warning" : "success"
                          }
                          icon={ultrapassou ? <AlertTriangle size={10} /> : undefined}
                        >
                          {cc.percentual_consumido}% {ultrapassou ? "EXCEDIDO!" : "CONSUMIDO"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal 1: Nova / Editar Categoria */}
        <Modal
          isOpen={modalCat}
          onClose={() => setModalCat(false)}
          title={editandoCat ? "Editar Categoria" : (isPersonal ? "Nova Categoria" : "Nova Categoria do Plano de Contas")}
          icon={<FolderTree className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarCategoria} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome da Categoria</label>
              <input
                type="text"
                required
                placeholder={isPersonal ? "Ex: Mercado, Aluguel, Salário, Farmácia, Lazer..." : "Ex: Assinatura de Software, Salários, Vendas de Serviços..."}
                value={formCat.nome}
                onChange={(e) => setFormCat({ ...formCat, nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className={`grid ${isPersonal ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo</label>
                <select
                  disabled={!!editandoCat}
                  value={formCat.tipo}
                  onChange={(e) => {
                    const novoTipo = e.target.value;
                    setFormCat({
                      ...formCat,
                      tipo: novoTipo,
                      dre_grupo: novoTipo === "receita" ? "receita_bruta" : "despesa_fixa",
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="despesa">Despesa (Saída)</option>
                  <option value="receita">Receita (Entrada)</option>
                </select>
              </div>

              {!isPersonal && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grupo na DRE</label>
                  <select
                    value={formCat.dre_grupo}
                    onChange={(e) => setFormCat({ ...formCat, dre_grupo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {formCat.tipo === "receita" ? (
                      <option value="receita_bruta">Receita Operacional Bruta</option>
                    ) : (
                      <>
                        <option value="despesa_fixa">Despesa Fixa Operacional</option>
                        <option value="custo_variavel">Custo Variável / Mercadoria</option>
                        <option value="imposto">Imposto sobre Vendas</option>
                        <option value="deducao_receita">Dedução da Receita</option>
                        <option value="despesa_financeira">Resultado Financeiro</option>
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Cor de Identificação</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formCat.cor}
                  onChange={(e) => setFormCat({ ...formCat, cor: e.target.value })}
                  className="w-10 h-8 rounded-lg cursor-pointer border border-slate-200"
                />
                <span className="text-[11px] text-slate-500 font-mono">{formCat.cor}</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalCat(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Categoria
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal 2: Novo / Editar Centro de Custo */}
        <Modal
          isOpen={modalCentro}
          onClose={() => setModalCentro(false)}
          title={editandoCentro ? "Editar Centro de Custo" : "Novo Centro de Custo"}
          icon={<Target className="text-emerald-600" size={18} />}
          size="md"
        >
          <form onSubmit={handleSalvarCentro} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nome do Centro de Custo</label>
              <input
                type="text"
                required
                placeholder="Ex: Comercial & Vendas, TI & Infra, Marketing..."
                value={formCentro.nome}
                onChange={(e) => setFormCentro({ ...formCentro, nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Código / Sigla</label>
                <input
                  type="text"
                  placeholder="Ex: MKT, TI, COM"
                  value={formCentro.codigo}
                  onChange={(e) => setFormCentro({ ...formCentro, codigo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Responsável</label>
                <input
                  type="text"
                  placeholder="Ex: Gerente de Área"
                  value={formCentro.responsavel}
                  onChange={(e) => setFormCentro({ ...formCentro, responsavel: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Teto Orçamentário Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formCentro.orcamento_mensal}
                  onChange={(e) =>
                    setFormCentro({ ...formCentro, orcamento_mensal: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formCentro.cor}
                    onChange={(e) => setFormCentro({ ...formCentro, cor: e.target.value })}
                    className="w-10 h-8 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">{formCentro.cor}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setModalCentro(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar Centro de Custo
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal de Confirmação Acessível (Radix UI / Shadcn) */}
        <ConfirmDialog />
      </div>
    </AdminLayout>
  );
}
