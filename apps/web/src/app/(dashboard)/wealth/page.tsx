"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Wallet, TrendingUp, TrendingDown, Sparkles, Plus, Trash2, Upload, Target, PiggyBank, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { WealthAccount, Transaction, Investment, SavingsGoal } from "@secondbrain/types";
import { formatINR } from "@secondbrain/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank Account", icon: "🏦" },
  { value: "investment", label: "Investment", icon: "📈" },
  { value: "property", label: "Property", icon: "🏠" },
  { value: "vehicle", label: "Vehicle", icon: "🚗" },
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "loan", label: "Loan", icon: "🏛️" },
  { value: "credit_card", label: "Credit Card", icon: "💳" },
  { value: "other", label: "Other", icon: "📦" },
];

const EXPENSE_CATEGORIES = ["Housing", "Food", "Transport", "Healthcare", "Education", "Entertainment", "Shopping", "Utilities", "Investment", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Investment Return", "Gift", "Other Income"];
const INVESTMENT_TYPES = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "stock", label: "Stock" },
  { value: "fd", label: "Fixed Deposit" },
  { value: "ppf", label: "PPF" },
  { value: "gold", label: "Gold" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" },
];

const accountMeta = (type: string) => ACCOUNT_TYPES.find(a => a.value === type) ?? { value: type, label: type, icon: "📦" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function WealthPage() {
  const [accounts, setAccounts] = useState<WealthAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Account form
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("bank");
  const [accBalance, setAccBalance] = useState("");
  const [accInstitution, setAccInstitution] = useState("");
  const [addingAcc, setAddingAcc] = useState(false);

  // Transaction form
  const [txAccount, setTxAccount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Other");
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [txNote, setTxNote] = useState("");
  const [addingTx, setAddingTx] = useState(false);

  // CSV import
  const [importAccount, setImportAccount] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ type: string; amountPaise: number; date: string; note: string }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Investment form
  const [invName, setInvName] = useState("");
  const [invType, setInvType] = useState("mutual_fund");
  const [invUnits, setInvUnits] = useState("1");
  const [invBuyPrice, setInvBuyPrice] = useState("");
  const [invCurrentPrice, setInvCurrentPrice] = useState("");
  const [addingInv, setAddingInv] = useState(false);

  // Goal form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null);
  const [goalUpdateAmt, setGoalUpdateAmt] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [accs, txs, invs, gs] = await Promise.all([
        fetch("/api/wealth/accounts").then(r => r.json()),
        fetch("/api/wealth/transactions").then(r => r.json()),
        fetch("/api/wealth/investments").then(r => r.json()),
        fetch("/api/wealth/goals").then(r => r.json()),
      ]);
      setAccounts(accs as WealthAccount[]);
      setTransactions(txs as Transaction[]);
      setInvestments(invs as Investment[]);
      setGoals(gs as SavingsGoal[]);
    } catch {
      toast.error("Failed to load wealth data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const assets = accounts.filter(a => !a.isLiability).reduce((s, a) => s + a.balancePaise, 0);
  const liabilities = accounts.filter(a => a.isLiability).reduce((s, a) => s + a.balancePaise, 0);
  const netWorth = assets - liabilities;

  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthIncome = thisMonth.filter(t => t.type === "income").reduce((s, t) => s + t.amountPaise, 0);
  const monthExpense = thisMonth.filter(t => t.type === "expense").reduce((s, t) => s + t.amountPaise, 0);
  const cashFlow = monthIncome - monthExpense;

  const totalInvested = investments.reduce((s, i) => s + i.buyPricePaise * i.units, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.currentPricePaise * i.units, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function addAccount() {
    if (!accName.trim()) return;
    setAddingAcc(true);
    try {
      const res = await fetch("/api/wealth/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: accName.trim(), type: accType, balancePaise: Math.round((parseFloat(accBalance) || 0) * 100), institution: accInstitution.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setAccName(""); setAccBalance(""); setAccInstitution("");
      toast.success("Account added");
      fetchAll();
    } catch { toast.error("Failed to add account"); }
    finally { setAddingAcc(false); }
  }

  async function deleteAccount(id: string) {
    const res = await fetch(`/api/wealth/accounts/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Account removed");
    fetchAll();
  }

  async function addTransaction() {
    if (!txAccount || !txAmount) return;
    setAddingTx(true);
    try {
      const res = await fetch("/api/wealth/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: txAccount,
          type: txType,
          amountPaise: Math.round(parseFloat(txAmount) * 100),
          category: txCategory,
          date: new Date(txDate).toISOString(),
          note: txNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setTxAmount(""); setTxNote("");
      toast.success("Transaction added");
      fetchAll();
    } catch { toast.error("Failed to add transaction"); }
    finally { setAddingTx(false); }
  }

  async function deleteTransaction(id: string) {
    const res = await fetch(`/api/wealth/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Transaction deleted");
    fetchAll();
  }

  async function previewCSV() {
    if (!importFile || !importAccount) { toast.error("Select a file and account first"); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("accountId", importAccount);
      const res = await fetch("/api/wealth/transactions/import?preview=true", { method: "POST", body: fd });
      const data = await res.json() as { preview: { type: string; amountPaise: number; date: string; note: string }[]; total: number };
      setImportPreview(data.preview);
      toast.success(`Preview: ${data.total} rows detected`);
    } catch { toast.error("Failed to parse CSV"); }
    finally { setImporting(false); }
  }

  async function confirmImport() {
    if (!importFile || !importAccount) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("accountId", importAccount);
      const res = await fetch("/api/wealth/transactions/import", { method: "POST", body: fd });
      const data = await res.json() as { imported: number; skipped: number };
      toast.success(`Imported ${data.imported} transactions (${data.skipped} duplicates skipped)`);
      setImportFile(null); setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchAll();
    } catch { toast.error("Import failed"); }
    finally { setImporting(false); }
  }

  async function addInvestment() {
    if (!invName.trim() || !invBuyPrice) return;
    setAddingInv(true);
    try {
      const res = await fetch("/api/wealth/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: invName.trim(),
          investmentType: invType,
          units: parseFloat(invUnits) || 1,
          buyPricePaise: Math.round(parseFloat(invBuyPrice) * 100),
          currentPricePaise: Math.round(parseFloat(invCurrentPrice || invBuyPrice) * 100),
        }),
      });
      if (!res.ok) throw new Error();
      setInvName(""); setInvUnits("1"); setInvBuyPrice(""); setInvCurrentPrice("");
      toast.success("Investment added");
      fetchAll();
    } catch { toast.error("Failed to add investment"); }
    finally { setAddingInv(false); }
  }

  async function addGoal() {
    if (!goalTitle.trim() || !goalTarget) return;
    setAddingGoal(true);
    try {
      const res = await fetch("/api/wealth/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalTitle.trim(),
          targetPaise: Math.round(parseFloat(goalTarget) * 100),
          currentPaise: Math.round((parseFloat(goalCurrent) || 0) * 100),
          targetDate: goalDate ? new Date(goalDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setGoalTitle(""); setGoalTarget(""); setGoalCurrent(""); setGoalDate("");
      toast.success("Goal added");
      fetchAll();
    } catch { toast.error("Failed to add goal"); }
    finally { setAddingGoal(false); }
  }

  async function updateGoalAmount(id: string, currentPaise: number) {
    const delta = Math.round(parseFloat(goalUpdateAmt) * 100);
    if (!delta) return;
    const res = await fetch(`/api/wealth/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPaise: currentPaise + delta }),
    });
    if (!res.ok) { toast.error("Failed to update"); return; }
    toast.success("Goal updated");
    setUpdatingGoal(null); setGoalUpdateAmt("");
    fetchAll();
  }

  async function getInsights() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/wealth-insight", { method: "POST" });
      const data = await res.json() as { insight: string };
      setAiInsight(data.insight);
    } catch { toast.error("AI insights unavailable"); }
    finally { setAiLoading(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Wealth" subtitle="Track your family finances" />
        <div className="flex-1 p-4 md:p-6 space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Wealth" subtitle="Track your family finances — net worth, spending & goals" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard title="Net Worth" value={formatINR(netWorth)} icon={Wallet} iconColor="text-amber-400"
                trend={netWorth >= 0 ? { value: 0, label: "" } : undefined} />
              <StatsCard title="Total Assets" value={formatINR(assets)} icon={TrendingUp} iconColor="text-emerald-400" />
              <StatsCard title="Liabilities" value={formatINR(liabilities)} icon={TrendingDown} iconColor="text-red-400" />
              <StatsCard title="Monthly Cash Flow" value={formatINR(cashFlow)} icon={BarChart3}
                iconColor={cashFlow >= 0 ? "text-emerald-400" : "text-red-400"} />
            </div>

            {/* AI Insights */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={getInsights} disabled={aiLoading}>
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? "Analysing..." : "AI Insights"}
              </Button>
            </div>
            {aiInsight && (
              <div className="glass rounded-xl p-5 border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Wealth Coach</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
              </div>
            )}

            {/* Accounts */}
            <div className="glass rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold">Accounts</h3>
              <div className="space-y-2">
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No accounts yet. Add one below.</p>
                ) : accounts.map(acc => {
                  const meta = accountMeta(acc.type);
                  return (
                    <div key={acc.id} className="flex items-center justify-between gap-3 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{meta.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.institution ?? meta.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-semibold ${acc.isLiability ? "text-red-400" : "text-emerald-400"}`}>
                          {acc.isLiability ? "-" : ""}{formatINR(acc.balancePaise)}
                        </span>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteAccount(acc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add account form */}
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="Account name" value={accName} onChange={e => setAccName(e.target.value)} className="flex-1 min-w-32" />
                  <Select value={accType} onValueChange={setAccType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Balance (₹)" type="number" value={accBalance} onChange={e => setAccBalance(e.target.value)} className="w-36" />
                  <Input placeholder="Institution (optional)" value={accInstitution} onChange={e => setAccInstitution(e.target.value)} className="flex-1 min-w-32" />
                  <Button size="sm" onClick={addAccount} disabled={addingAcc || !accName.trim()}>
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── TRANSACTIONS ─────────────────────────────────────────────── */}
          <TabsContent value="transactions" className="space-y-6">
            {/* Add transaction form */}
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Log transaction</h3>
              <div className="flex gap-2 flex-wrap">
                <Select value={txAccount} onValueChange={setTxAccount}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{accountMeta(a.type).icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={txType} onValueChange={v => { setTxType(v as typeof txType); setTxCategory(v === "income" ? "Other Income" : "Other"); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Amount (₹)" type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-32" />
                <Select value={txCategory} onValueChange={setTxCategory}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{(txType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                  className="w-40 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <Input placeholder="Note (optional)" value={txNote} onChange={e => setTxNote(e.target.value)} className="flex-1 min-w-32" />
                <Button size="sm" onClick={addTransaction} disabled={addingTx || !txAccount || !txAmount}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            {/* CSV Import */}
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Import from bank CSV</h3>
              <div className="flex gap-2 flex-wrap items-center">
                <Select value={importAccount} onValueChange={setImportAccount}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Target account" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{accountMeta(a.type).icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportPreview(null); }} />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" />
                  {importFile ? importFile.name : "Choose CSV"}
                </Button>
                {importFile && <Button variant="outline" size="sm" onClick={previewCSV} disabled={importing}>Preview</Button>}
                {importPreview && <Button size="sm" onClick={confirmImport} disabled={importing}>Confirm import</Button>}
              </div>
              {importPreview && (
                <div className="overflow-auto max-h-48 rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>{["Date", "Type", "Amount", "Note"].map(h => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importPreview.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5">{String(r.date).slice(0, 10)}</td>
                          <td className="px-3 py-1.5"><Badge className={`text-[10px] ${r.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{r.type}</Badge></td>
                          <td className="px-3 py-1.5">{formatINR(r.amountPaise)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-48">{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transaction feed */}
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Wallet className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No transactions yet. Log one above or import a CSV.</p>
                </div>
              ) : transactions.slice(0, 50).map(tx => (
                <div key={tx.id} className="glass rounded-xl p-4 group flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-8 rounded-full shrink-0 ${tx.type === "income" ? "bg-emerald-400" : tx.type === "transfer" ? "bg-blue-400" : "bg-red-400"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.note ?? tx.category}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className="text-[10px] bg-secondary text-muted-foreground border-border border">{tx.category}</Badge>
                        <span className="text-[11px] text-muted-foreground">{format(new Date(tx.date), "MMM d, yyyy")}</span>
                        <span className="text-[11px] text-muted-foreground">{tx.account?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-semibold ${tx.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "income" ? "+" : tx.type === "transfer" ? "" : "-"}{formatINR(tx.amountPaise)}
                    </span>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTransaction(tx.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── INVESTMENTS ──────────────────────────────────────────────── */}
          <TabsContent value="investments" className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatsCard title="Total Invested" value={formatINR(totalInvested)} icon={TrendingUp} iconColor="text-amber-400" />
              <StatsCard title="Current Value" value={formatINR(totalCurrent)} icon={BarChart3} iconColor="text-emerald-400" />
              <StatsCard title="Overall Gain" value={`${totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100).toFixed(1) : 0}%`}
                icon={TrendingUp} iconColor={totalCurrent >= totalInvested ? "text-emerald-400" : "text-red-400"} />
            </div>

            {/* Add investment form */}
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Add holding</h3>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Name e.g. HDFC Flexi Cap" value={invName} onChange={e => setInvName(e.target.value)} className="flex-1 min-w-40" />
                <Select value={invType} onValueChange={setInvType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Units" type="number" value={invUnits} onChange={e => setInvUnits(e.target.value)} className="w-20" />
                <Input placeholder="Buy price (₹/unit)" type="number" value={invBuyPrice} onChange={e => setInvBuyPrice(e.target.value)} className="w-36" />
                <Input placeholder="Current price (₹/unit)" type="number" value={invCurrentPrice} onChange={e => setInvCurrentPrice(e.target.value)} className="w-36" />
                <Button size="sm" onClick={addInvestment} disabled={addingInv || !invName.trim() || !invBuyPrice}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            {/* Holdings list */}
            <div className="space-y-2">
              {investments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No holdings yet. Add your first investment above.</p>
                </div>
              ) : investments.map(inv => {
                const invested = inv.buyPricePaise * inv.units;
                const current = inv.currentPricePaise * inv.units;
                const gainPct = invested > 0 ? ((current - invested) / invested * 100).toFixed(1) : "0.0";
                const isGain = current >= invested;
                const typeMeta = INVESTMENT_TYPES.find(t => t.value === inv.investmentType);
                return (
                  <div key={inv.id} className="glass rounded-xl p-4 group flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inv.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-[10px] bg-secondary text-muted-foreground border-border border">{typeMeta?.label ?? inv.investmentType}</Badge>
                          <span className="text-[11px] text-muted-foreground">{inv.units} units · {formatINR(inv.buyPricePaise)}/unit</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatINR(current)}</p>
                        <p className={`text-[11px] ${isGain ? "text-emerald-400" : "text-red-400"}`}>
                          {isGain ? "+" : ""}{gainPct}%
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={async () => { await fetch(`/api/wealth/investments/${inv.id}`, { method: "DELETE" }); fetchAll(); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── GOALS ────────────────────────────────────────────────────── */}
          <TabsContent value="goals" className="space-y-6">
            {/* Add goal form */}
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Add savings goal</h3>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="e.g. Emergency Fund" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="flex-1 min-w-40" />
                <Input placeholder="Target (₹)" type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="w-36" />
                <Input placeholder="Saved so far (₹)" type="number" value={goalCurrent} onChange={e => setGoalCurrent(e.target.value)} className="w-36" />
                <Input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)}
                  className="w-40 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <Button size="sm" onClick={addGoal} disabled={addingGoal || !goalTitle.trim() || !goalTarget}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            {/* Goals list */}
            <div className="space-y-4">
              {goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Target className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No savings goals yet. Create one above.</p>
                </div>
              ) : goals.map(goal => {
                const pct = goal.targetPaise > 0 ? Math.min(100, Math.round((goal.currentPaise / goal.targetPaise) * 100)) : 0;
                const remaining = goal.targetPaise - goal.currentPaise;
                return (
                  <div key={goal.id} className="glass rounded-xl p-5 space-y-3 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-amber-400 shrink-0" />
                        <h4 className="text-sm font-semibold">{goal.title}</h4>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={async () => { await fetch(`/api/wealth/goals/${goal.id}`, { method: "DELETE" }); fetchAll(); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatINR(goal.currentPaise)} saved</span>
                        <span>{formatINR(goal.targetPaise)} target · {pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-[11px] text-muted-foreground">
                        {formatINR(remaining)} remaining
                        {goal.targetDate ? ` · due ${format(new Date(goal.targetDate), "MMM yyyy")}` : ""}
                      </p>
                    </div>
                    {updatingGoal === goal.id ? (
                      <div className="flex gap-2 items-center">
                        <Input placeholder="Add amount (₹)" type="number" value={goalUpdateAmt} onChange={e => setGoalUpdateAmt(e.target.value)} className="h-8 text-xs w-36" />
                        <Button size="sm" className="h-8 text-xs" onClick={() => updateGoalAmount(goal.id, goal.currentPaise)}>Save</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setUpdatingGoal(null); setGoalUpdateAmt(""); }}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUpdatingGoal(goal.id)}>
                        <Plus className="w-3 h-3" /> Add savings
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
