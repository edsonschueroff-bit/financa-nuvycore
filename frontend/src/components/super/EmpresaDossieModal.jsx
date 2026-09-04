import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { Modal, Button, Badge, Card } from "../ui";
import {
  Building2,
  TrendingUp,
  Wallet,
  Users,
  CreditCard,
  LifeBuoy,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Clock,
  Sparkles,
} from "lucide-react";

export default function EmpresaDossieModal({ isOpen, onClose, empresaId, onImpersonate }) {
  const [dossie, setDossie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("visao_geral"); // visao_geral | usuarios | financeiro | suporte

  useEffect(() => {
    if (isOpen && empresaId) {
      carregarDossie(empresaId);
    }
  }, [isOpen, empresaId]);

  const carregarDossie = async (id) => {
    try {
      setLoading(true);
      const res = await api.get(`/empresas/${id}/dossie`);
      setDossie(res.data);
    } catch (err) {
      console.error("Erro ao carregar dossiê:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatBRL = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dossiê 360° da Empresa Assinante"
      icon={<Building2 className="text-blue-600" size={20} />}
      size="lg"
    >
      {loading || !dossie ? (
        <div className="p-12 text-center text-xs text-slate-400">Carregando dossiê 360°...</div>
      ) : (
        <div className="space-y-5 text-xs">
          {/* Header da Empresa */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">{dossie.empresa.nome}</h3>
                <span className="text-xs text-slate-400 font-mono">({dossie.empresa.slug})</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    dossie.empresa.status_saas === "ativo"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : dossie.empresa.status_saas === "trial"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {dossie.empresa.status_saas}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                CNPJ/CPF: {dossie.empresa.cnpj_cpf || "Não informado"} • Plano:{" "}
                <strong className="text-slate-200">{dossie.empresa.plano_nome || "Sem Plano"}</strong> ({formatBRL(dossie.empresa.plano_valor)}/mês)
              </p>
            </div>

            {onImpersonate && (
              <Button
                variant="primary"
                size="sm"
                icon={<ExternalLink size={13} />}
                onClick={() => onImpersonate(dossie.empresa)}
                className="shrink-0"
              >
                Acessar Painel da Empresa
              </Button>
            )}
          </div>

          {/* Navegação por Abas */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl font-bold text-xs">
            <button
              type="button"
              onClick={() => setAbaAtiva("visao_geral")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                abaAtiva === "visao_geral" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              📊 Uso & Métricas
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("usuarios")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                abaAtiva === "usuarios" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              👥 Usuários ({dossie.usuarios?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("financeiro")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                abaAtiva === "financeiro" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              💳 Faturas SaaS & LTV
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("suporte")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                abaAtiva === "suporte" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🎫 Chamados ({dossie.suporte?.total_chamados || 0})
            </button>
          </div>

          {/* Aba 1: Visão Geral de Uso */}
          {abaAtiva === "visao_geral" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Transações Criadas</span>
                  <h4 className="text-xl font-black text-slate-900 font-mono mt-0.5">
                    {dossie.estatisticas.total_transacoes}
                  </h4>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {dossie.estatisticas.transacoes_mes_atual} no mês atual
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Saldo em Contas</span>
                  <h4 className="text-xl font-black text-emerald-600 font-mono mt-0.5">
                    {formatBRL(dossie.estatisticas.saldo_bancario_atual)}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">
                    em {dossie.estatisticas.total_contas_bancarias} conta(s)
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Contatos / Clientes</span>
                  <h4 className="text-xl font-black text-slate-900 font-mono mt-0.5">
                    {dossie.estatisticas.total_contatos}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {dossie.estatisticas.total_centros_custo} centros de custo
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">LTV (Total Pago)</span>
                  <h4 className="text-xl font-black text-indigo-700 font-mono mt-0.5">
                    {formatBRL(dossie.financeiro_saas.ltv)}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {dossie.financeiro_saas.total_faturas} faturas geradas
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Aba 2: Usuários */}
          {abaAtiva === "usuarios" && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Nome & Email</th>
                    <th className="px-3 py-2">Perfil</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Cadastrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dossie.usuarios?.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2">
                        <strong className="text-slate-900 block">{u.nome}</strong>
                        <span className="text-[11px] text-slate-500">{u.email}</span>
                      </td>
                      <td className="px-3 py-2 uppercase font-bold text-[10px] text-slate-600">
                        {u.role}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aba 3: Financeiro SaaS & Faturas */}
          {abaAtiva === "financeiro" && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-900">Total Pago Acumulado (LTV):</span>
                  <h4 className="text-xl font-black text-indigo-900 font-mono">
                    {formatBRL(dossie.financeiro_saas.ltv)}
                  </h4>
                </div>
                <Badge variant="info">Cliente desde {new Date(dossie.empresa.created_at).toLocaleDateString("pt-BR")}</Badge>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Fatura</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dossie.financeiro_saas.faturas?.map((f) => (
                      <tr key={f.id}>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700">#{f.id}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(f.data_vencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 font-bold font-mono text-slate-900">
                          {formatBRL(f.valor)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              f.status === "pago"
                                ? "bg-emerald-100 text-emerald-800"
                                : f.status === "pendente"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba 4: Suporte Técnico */}
          {abaAtiva === "suporte" && (
            <div className="space-y-2">
              {dossie.suporte.chamados?.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhum chamado de suporte registrado.</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {dossie.suporte.chamados?.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">{c.codigo}</span>
                          <strong className="text-slate-900">{c.assunto}</strong>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Criado em {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <Badge variant={c.status === "resolvido" ? "success" : "warning"}>{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Fechar Dossiê
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
