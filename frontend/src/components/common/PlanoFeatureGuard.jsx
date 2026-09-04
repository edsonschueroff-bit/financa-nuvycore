import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "../admin/AdminLayout";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card } from "../ui";
import { Lock, Sparkles, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

export default function PlanoFeatureGuard({
  children,
  featureKey,
  b2bOnly = false,
  featureName = "Recurso Avançado",
  featureDesc,
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return null;
  }

  // Super Admin tem acesso irrestrito
  if (user?.is_super) {
    return children;
  }

  // Empresas em período de teste gratuito (Trial) têm acesso para degustação
  if (user?.empresa_status === "trial") {
    return children;
  }

  const isPersonalPlan = user?.plano_tipo_publico === "pessoal";
  const planoRecursos = user?.plano_recursos || {};

  let bloqueado = false;
  let motivoBloqueio = "";

  // 1. Verificação de módulo estritamente corporativo/B2B em plano pessoal
  if (b2bOnly && isPersonalPlan) {
    bloqueado = true;
    motivoBloqueio = `O módulo "${featureName}" foi desenvolvido especificamente para gestão corporativa (empresas, comércios e PMEs) e não está disponível no plano pessoal (${user?.plano_nome || "Cora Pessoal"}).`;
  }

  // 2. Verificação de Feature Flag explícita no plano
  if (!bloqueado && featureKey && planoRecursos[featureKey] === false) {
    bloqueado = true;
    motivoBloqueio = `O módulo "${featureName}" não está ativo no seu plano atual (${user?.plano_nome || "Básico"}).`;
  }

  if (!bloqueado) {
    return children;
  }

  const slug = user?.empresa_slug || "";

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto py-12 px-4">
        <Card padding="lg" className="text-center relative overflow-hidden border-2 border-slate-200/80 shadow-lg">
          {/* Fundo sutil de destaque */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Ícone de Bloqueio Seguro */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-4 shadow-xs relative">
            <Lock size={28} />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
              <Sparkles size={11} />
            </span>
          </div>

          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100/80 text-amber-800 text-xs font-black uppercase rounded-full tracking-wider mb-2">
            Módulo Bloqueado no seu Plano
          </span>

          <h2 className="text-2xl font-black text-slate-900 mt-1 mb-2">
            {featureName}
          </h2>

          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed mb-6">
            {featureDesc || motivoBloqueio}
          </p>

          {/* Benefícios ao fazer o Upgrade */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-left max-w-lg mx-auto mb-8 space-y-2.5 text-xs text-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              O que você ganha com o upgrade:
            </span>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Acesso completo ao <strong>{featureName}</strong> e relatórios executivos.</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Mais limites de transações, contas e suporte prioritário.</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Liberação imediata no PIX ou Cartão sem complicações.</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate(`/admin/${slug}`)}
            >
              Voltar ao Início
            </Button>

            <Button
              variant="primary"
              icon={<ArrowRight size={16} />}
              onClick={() => navigate(`/admin/${slug}/assinatura`)}
              className="shadow-md"
            >
              Conhecer Planos e Fazer Upgrade
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
