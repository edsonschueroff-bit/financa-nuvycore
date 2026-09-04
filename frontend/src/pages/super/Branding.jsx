import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import api from "../../utils/api";
import { Button, Card } from "../../components/ui";
import { toast } from "sonner";
import { Sparkles, Save, Check } from "lucide-react";
import { useBranding } from "../../contexts/BrandingContext";

export default function Branding() {
  const { branding, recarregarBranding } = useBranding();
  const [form, setForm] = useState({
    nome_sistema: "Nuvy Finance",
    cor_primaria: "#059669",
    cor_secundaria: "#2563eb",
  });
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (branding) {
      setForm({
        nome_sistema: branding.nome_sistema || "Nuvy Finance",
        cor_primaria: branding.cor_primaria || "#059669",
        cor_secundaria: branding.cor_secundaria || "#2563eb",
      });
    }
  }, [branding]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      setSalvando(true);
      await api.post("/branding", { ...form, global: true });
      await recarregarBranding();
      setSucesso(true);
      toast.success("Identidade visual salva com sucesso!");
      setTimeout(() => setSucesso(false), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao salvar identidade visual");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="text-slate-800" size={24} /> Identidade Visual & White-Label
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Personalize o nome da plataforma, logo e paleta de cores para os clientes.
          </p>
        </div>

        {sucesso && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check size={16} className="text-emerald-600" /> Identidade visual atualizada com sucesso em tempo real!
          </div>
        )}

        <Card padding="lg">
          <form onSubmit={handleSalvar} className="space-y-5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Nome do Sistema / Plataforma</label>
              <input
                type="text"
                required
                value={form.nome_sistema}
                onChange={(e) => setForm({ ...form, nome_sistema: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Cor Primária (Tema)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.cor_primaria}
                    onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.cor_primaria}
                    onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Cor Secundária (Destaques)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.cor_secundaria}
                    onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.cor_secundaria}
                    onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="submit"
                variant="dark"
                loading={salvando}
                icon={<Save size={16} />}
              >
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AdminLayout>
  );
}
