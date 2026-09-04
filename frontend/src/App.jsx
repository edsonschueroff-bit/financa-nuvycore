import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/admin/Dashboard";
import ContasPagar from "./pages/admin/ContasPagar";
import ContasReceber from "./pages/admin/ContasReceber";
import ContasBancarias from "./pages/admin/ContasBancarias";
import ConciliacaoBancaria from "./pages/admin/ConciliacaoBancaria";
import Investimentos from "./pages/admin/Investimentos";
import DreGerencial from "./pages/admin/DreGerencial";
import FluxoCaixaProjetado from "./pages/admin/FluxoCaixaProjetado";
import Contatos from "./pages/admin/Contatos";
import Categorias from "./pages/admin/Categorias";
import Precificacao from "./pages/admin/Precificacao";
import OrcamentoMetas from "./pages/admin/OrcamentoMetas";
import RelatorioCentrosCusto from "./pages/admin/RelatorioCentrosCusto";
import InteligenciaEstrategica from "./pages/admin/InteligenciaEstrategica";
import AutomacoesWhatsApp from "./pages/admin/AutomacoesWhatsApp";
import UsuariosEmpresa from "./pages/admin/UsuariosEmpresa";
import MinhaAssinatura from "./pages/admin/MinhaAssinatura";
import MinhaEmpresa from "./pages/admin/MinhaEmpresa";
import AuditoriaLogs from "./pages/admin/AuditoriaLogs";
import GatewayCobranca from "./pages/admin/GatewayCobranca";
import ChamadosSuporte from "./pages/admin/ChamadosSuporte";
import PlanoFeatureGuard from "./components/common/PlanoFeatureGuard";

// Super Admin
import SuperDashboard from "./pages/super/SuperDashboard";
import Empresas from "./pages/super/Empresas";
import SaasPlanos from "./pages/super/SaasPlanos";
import SaasFaturas from "./pages/super/SaasFaturas";
import SuperChamados from "./pages/super/SuperChamados";
import SuperComunicados from "./pages/super/SuperComunicados";
import Branding from "./pages/super/Branding";
import WhatsappManager from "./pages/super/WhatsappManager";
import SuperAuditoria from "./pages/super/SuperAuditoria";

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg animate-pulse mb-4">
      NF
    </div>
    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
    <p className="text-xs text-slate-400 font-medium">Carregando ambiente seguro...</p>
  </div>
);

const RotaPrivada = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const SuperAdminOnly = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_super) return <Navigate to={`/admin/${user.empresa_slug || "demo"}`} replace />;
  return children;
};

const AdminRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_super) return <Navigate to="/super" replace />;
  return <Navigate to={`/admin/${user.empresa_slug || "demo"}`} replace />;
};

export default function App() {
  return (
    <>
      <Routes>
        {/* Autenticação & Entrada */}
      <Route path="/" element={<AdminRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/admin" element={<AdminRedirect />} />

      {/* Rotas Administrativas do Tenant */}
      <Route
        path="/admin/:empresaSlug"
        element={
          <RotaPrivada>
            <Dashboard />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/receber"
        element={
          <RotaPrivada>
            <ContasReceber />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/pagar"
        element={
          <RotaPrivada>
            <ContasPagar />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/contas"
        element={
          <RotaPrivada>
            <ContasBancarias />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/conciliacao"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="open_finance" featureName="Conciliação Bancária">
              <ConciliacaoBancaria />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/investimentos"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="investimentos_b3" featureName="Investimentos & B3">
              <Investimentos />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/dre"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="dre" b2bOnly={true} featureName="DRE Gerencial">
              <DreGerencial />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/fluxo-caixa"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="fluxo_caixa" b2bOnly={true} featureName="Fluxo de Caixa Projetado">
              <FluxoCaixaProjetado />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/contatos"
        element={
          <RotaPrivada>
            <Contatos />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/categorias"
        element={
          <RotaPrivada>
            <Categorias />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/precificacao"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard b2bOnly={true} featureName="Precificação & Markup">
              <Precificacao />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/orcamento"
        element={
          <RotaPrivada>
            <OrcamentoMetas />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/rateio-centros"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="centros_custo" b2bOnly={true} featureName="Rateio por Centros de Custo">
              <RelatorioCentrosCusto />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/inteligencia"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard b2bOnly={true} featureName="Inteligência Estratégica">
              <InteligenciaEstrategica />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/automacoes"
        element={
          <RotaPrivada>
            <AutomacoesWhatsApp />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/usuarios"
        element={
          <RotaPrivada>
            <UsuariosEmpresa />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/empresa"
        element={
          <RotaPrivada>
            <MinhaEmpresa />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/assinatura"
        element={
          <RotaPrivada>
            <MinhaAssinatura />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/auditoria"
        element={
          <RotaPrivada>
            <AuditoriaLogs />
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/gateways"
        element={
          <RotaPrivada>
            <PlanoFeatureGuard featureKey="gateways_proprios" b2bOnly={true} featureName="Gateways de Cobrança Próprios">
              <GatewayCobranca />
            </PlanoFeatureGuard>
          </RotaPrivada>
        }
      />
      <Route
        path="/admin/:empresaSlug/suporte"
        element={
          <RotaPrivada>
            <ChamadosSuporte />
          </RotaPrivada>
        }
      />

      {/* Rotas Super Admin */}
      <Route
        path="/super"
        element={
          <SuperAdminOnly>
            <SuperDashboard />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/empresas"
        element={
          <SuperAdminOnly>
            <Empresas />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/saas-planos"
        element={
          <SuperAdminOnly>
            <SaasPlanos />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/saas-faturas"
        element={
          <SuperAdminOnly>
            <SaasFaturas />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/chamados"
        element={
          <SuperAdminOnly>
            <SuperChamados />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/comunicados"
        element={
          <SuperAdminOnly>
            <SuperComunicados />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/whatsapp"
        element={
          <SuperAdminOnly>
            <WhatsappManager />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/branding"
        element={
          <SuperAdminOnly>
            <Branding />
          </SuperAdminOnly>
        }
      />
      <Route
        path="/super/auditoria"
        element={
          <SuperAdminOnly>
            <SuperAuditoria />
          </SuperAdminOnly>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Toaster richColors position="top-right" closeButton />
    </>
  );
}
