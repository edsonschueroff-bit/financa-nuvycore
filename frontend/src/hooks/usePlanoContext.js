import { useAuth } from "../contexts/AuthContext";

/**
 * Hook central para governança e adaptação dinâmica de telas por plano SaaS.
 * Diferencia se o usuário está em um plano pessoal (B2C) ou empresarial (B2B)
 * e avalia permissões e recursos contratados.
 */
export function usePlanoContext() {
  const { user, isSuperAdmin } = useAuth();

  const isPersonal = user?.plano_tipo_publico === "pessoal";
  const isEmpresarial = !isPersonal;
  const planoNome = user?.plano_nome || (isPersonal ? "Cora Pessoal" : "Empresarial");
  const recursos = user?.plano_recursos || {};
  const isTrial = user?.empresa_status === "trial";

  /**
   * Verifica se o plano ativo possui uma determinada funcionalidade
   */
  const hasFeature = (key) => {
    if (isSuperAdmin || isTrial) return true;
    if (!key) return true;
    return recursos[key] !== false;
  };

  /**
   * Helper para alternar vocabulário conforme o público do plano
   * @example termo("Salário & Entradas", "Receita Bruta")
   */
  const termo = (pessoal, empresarial) => {
    return isPersonal ? pessoal : empresarial;
  };

  return {
    user,
    isPersonal,
    isEmpresarial,
    isTrial,
    isSuperAdmin,
    planoNome,
    recursos,
    hasFeature,
    termo,
  };
}

export default usePlanoContext;
