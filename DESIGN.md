---
name: Nuvy Finance — Precision Emerald
description: Design system oficial do Nuvy Finance (SaaS Multi-Tenant B2B). Limpo, preciso, moderno e corporativo.
version: "3.0"
colors:
  primary: "#059669" # Emerald 600
  primary-hover: "#047857" # Emerald 700
  primary-light: "#ecfdf5" # Emerald 50
  primary-500: "#10b981" # Emerald 500
  success: "#10b981"
  success-light: "#ecfdf5"
  warning: "#f59e0b"
  warning-light: "#fffbeb"
  danger: "#ef4444"
  danger-light: "#fef2f2"
  danger-rose: "#e11d48"
  danger-rose-light: "#fff1f2"
  accent-blue: "#2563eb"
  accent-blue-light: "#eff6ff"
  surface: "#ffffff"
  surface-secondary: "#f8fafc"
  surface-tertiary: "#f1f5f9"
  border: "#e2e8f0"
  border-strong: "#cbd5e1"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
  text-muted: "#94a3b8"
  sidebar-bg: "#ffffff"
  sidebar-border: "#e2e8f0"
typography:
  display:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  heading-lg:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
  heading-md:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  heading-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label-xs:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.05em
    textTransform: uppercase
rounded:
  button: 12px # rounded-xl
  card: 16px # rounded-2xl
  modal: 16px # rounded-2xl
  badge: 9999px # rounded-full
  input: 12px # rounded-xl
shadows:
  card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" # shadow-xs
  card-hover: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)"
  modal: "0 10px 25px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)"
---

# Nuvy Finance — Precision Emerald Design System

## 1. Visão Geral

- **Público:** Diretores Financeiros (CFOs), gestores de PMEs, controllers e empresários no Brasil.
- **Tom Visual:** Precisão contábil, sofisticação executiva e clareza. Visual limpo com foco nos dados e indicadores financeiros.
- **Princípio:** "Informação em primeiro lugar". Sem sombras pesadas, sem gradientes caóticos e sem alternância aleatória de cards escuros e claros.

---

## 2. Paleta de Cores Oficial

### 🟢 Cores Primárias (Emerald Brand)
- **`primary` (`#059669` / `emerald-600`):** Botões principais, indicadores de receita, lucro positivo, links de destaque e status ativos.
- **`primary-hover` (`#047857` / `emerald-700`):** Hover em botões primários.
- **`primary-light` (`#ecfdf5` / `emerald-50`):** Fundo de badges e cards de receita.
- **`primary-500` (`#10b981` / `emerald-500`):** Barras de progresso e acentos dinâmicos.

### 🔴 Cores de Despesa / Perigo (Rose / Danger)
- **`rose-600` (`#e11d48`):** Contas a pagar, saídas de caixa, despesas, faturas vencidas e botões de exclusão.
- **`rose-50` (`#fff1f2`):** Fundo de badges de despesa, alertas e inadimplência.
- **`rose-200` (`#fecdd3`):** Borda de badges e alertas de erro.

### 🟡 Cores de Alerta / Pendência (Amber)
- **`amber-600` (`#d97706`) / `amber-500` (`#f59e0b`):** Vencendo hoje, prazos em aberto, atenção ao caixa.
- **`amber-50` (`#fffbeb`):** Fundo de badges pendentes.

### 🔵 Cores de Integração / Informação (Blue)
- **`blue-600` (`#2563eb`):** Conciliação bancária OFX, métricas neutras, cotações.
- **`blue-50` (`#eff6ff`):** Fundo de badges de informação.

### ⚪ Superfícies & Neutros (Slate)
- **`surface` (`#ffffff`):** Fundo de cards, modais e barra lateral.
- **`surface-secondary` (`#f8fafc` / `slate-50`):** Fundo geral da página e cabeçalho de tabelas.
- **`border` (`#e2e8f0` / `slate-200`):** Bordas padrão de cards e inputs.
- **`text-primary` (`#0f172a` / `slate-900`):** Títulos, dados monetários e texto principal.
- **`text-secondary` (`#64748b` / `slate-500`):** Subtítulos, labels e descrições.
- **`text-muted` (`#94a3b8` / `slate-400`):** Placeholders e metadados secundários.

---

## 3. Padrões Estruturais & Componentes

### 🔘 Botões (`<Button />`)
- **Border Radius:** `rounded-xl` (12px)
- **Altura & Padding:**
  - `sm`: `h-8 px-3 py-1 text-xs`
  - `md`: `h-9 px-4 py-2 text-xs` (Padrão)
  - `lg`: `h-11 px-6 py-2.5 text-sm`
- **Variantes:**
  - `primary`: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold`
  - `secondary`: `bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold`
  - `danger`: `bg-rose-600 hover:bg-rose-700 text-white shadow-md font-semibold`
  - `dark`: `bg-slate-900 hover:bg-slate-800 text-white shadow-md font-semibold` (Super Admin)
  - `outline`: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs font-semibold`
  - `ghost`: `hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-semibold`

### 🏷️ Badges (`<Badge />`)
- **Formato:** `rounded-full px-2.5 py-0.5 text-[10px] font-bold inline-flex items-center gap-1 border`
- **Variantes:**
  - `success`: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - `danger`: `bg-rose-50 text-rose-700 border-rose-200`
  - `warning`: `bg-amber-50 text-amber-800 border-amber-200`
  - `info`: `bg-blue-50 text-blue-700 border-blue-200`
  - `neutral`: `bg-slate-100 text-slate-600 border-slate-200`

### 📦 Cards (`<Card />`)
- **Container:** `bg-white rounded-2xl border border-slate-200 shadow-xs`
- **Padding:** `p-5` ou `p-6`

### 🪟 Modais (`<Modal />`)
- **Backdrop:** `fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto`
- **Container:** `bg-white rounded-2xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200`
- **Header:** Título `font-bold text-slate-900 text-base` + botão de fechar (X).

### 📊 Tabelas
- **Thead:** `bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]`
- **Row Hover:** `hover:bg-slate-50/70 transition-colors`
- **Valores Monetários:** `font-mono font-black text-slate-900`
