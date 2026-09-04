import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Badge, Card } from "../../components/ui";
import { toast } from "sonner";
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  Plus,
  ExternalLink,
  AlertTriangle,
  LifeBuoy,
  Megaphone,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function SuperDashboard() {
  const navigate = useNavigate();
  const { switchEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [metricasSaas, setMetricasSaas] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarSuper = async () => {
    try {
      setLoading(true);
      const [empRes, plaRes, fatRes, metRes] = await Promise.all([
        api.get("/empresas/todas"),
        api.get("/saas-planos"),
        api.get("/saas-faturas"),
        api.get("/saas-faturas/metricas-saas").catch(() => ({ data: null })),
      ]);
      setEmpresas(empRes.data || []);
      setPlanos(plaRes.data || []);
      setFaturas(fatRes.data || []);
      setMetricasSaas(metRes.data || null);
    } catch (err) {
      console.error("Erro ao carregar Super Dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSuper();
  }, []);

  const formatBRL = (v) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const empresasAtivas = empresas.filter((e) => e.status_saas === "ativo").length;
  const empresasTrial = empresas.filter((e) => e.status_saas === "trial").length;
  const empresasBloqueadas = empresas.filter((e) => e.status_saas === "bloqueado").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="text-slate-800" size={24} /> Plataforma SaaS — Super Admin
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Visão executiva de assinantes, faturamento recorrente (MRR), suporte técnico e inadimplência.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Megaphone size={14} className="text-indigo-600" />}
              onClick={() => navigate("/super/comunicados")}
            >
              Comunicados
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<LifeBuoy size={14} className="text-blue-600" />}
              onClick={() => navigate("/super/chamados")}
            >
              Chamados
            </Button>
            <Button
              variant="dark"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => navigate("/super/empresas")}
            >
              Nova Empresa
            </Button>
          </div>
        </div>

        {/* KPIs Plataforma */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Empresas Cadastradas</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-900 font-mono">{empresas.length}</div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                <strong className="text-emerald-600">{empresasAtivas} ativas</strong> • {empresasTrial} trial • {empresasBloqueadas} bloqueadas
              </p>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">MRR Recorrente Ativo</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {formatBRL(metricasSaas?.mrr || 0)}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                ARR Anual: <strong>{formatBRL(metricasSaas?.arr || 0)}</strong>
              </p>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Faturamento Mês Atual</span>
            <div className="mt-2">
              <div className="text-2xl font-black text-blue-600 font-mono">
                {formatBRL(metricasSaas?.faturamento_mes_atual || 0)}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Mês anterior: {formatBRL(metricasSaas?.faturamento_mes_anterior || 0)}
              </p>
            </div>
          </Card>

          <Card padding="md" className="flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Inadimplência em Aberto</span>
            <div className="mt-2">
              <div className={`text-2xl font-black font-mono ${metricasSaas?.inadimplencia_total > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {formatBRL(metricasSaas?.inadimplencia_total || 0)}
              </div>
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                {metricasSaas?.faturas_vencidas || 0} fatura(s) vencida(s)
              </p>
            </div>
          </Card>
        </div>

        {/* Lista de Tenants Recentes */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Empresas Assinantes Recentes</h3>
            <Link to="/super/empresas" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Ver todas as empresas →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status SaaS</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3 text-right">Transações Registradas</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.slice(0, 5).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{e.nome}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{e.slug}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          e.status_saas === "ativo"
                            ? "success"
                            : e.status_saas === "trial"
                              ? "info"
                              : "danger"
                        }
                      >
                        {e.status_saas?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.plano_nome || "Trial Padrão"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                      {e.total_transacoes || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={async () => {
                          try {
                            const u = await switchEmpresa(e.id);
                            navigate(`/admin/${u.empresa_slug || e.slug}`);
                          } catch (err) {
                            toast.error("Erro ao alternar para a empresa " + e.nome);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Acessar <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
