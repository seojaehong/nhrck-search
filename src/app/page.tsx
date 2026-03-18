"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpIcon,
  Search,
  Scale,
  ShieldAlert,
  Users,
  Gavel,
  X,
  ExternalLink,
} from "lucide-react";

// ── Types ──
type Decision = {
  id: number;
  doc_id: number;
  case_name: string;
  case_number: string;
  decision_date: string;
  committee: string;
  decision_type: string;
  topic: string;
  result: string;
  applicant: string;
  respondent: string;
  victim: string;
  order_summary: string;
  decision_summary: string;
  judgment_summary: string;
  reason?: string;
  order_text: string;
  category: string;
  view_url: string;
  full_text?: string;
};

// ── Constants ──
const TOPICS = [
  { label: "성희롱", icon: ShieldAlert },
  { label: "성폭력", icon: ShieldAlert },
  { label: "성차별", icon: Scale },
  { label: "괴롭힘", icon: Users },
  { label: "장애차별", icon: Users },
  { label: "인권침해", icon: Gavel },
  { label: "차별", icon: Scale },
];

const RESULTS = [
  { label: "인정(권고)", style: "text-neutral-300 border-neutral-700/50 bg-neutral-800/40" },
  { label: "불인정(기각)", style: "text-neutral-400 border-neutral-700/50 bg-neutral-800/40" },
  { label: "각하", style: "text-neutral-500 border-neutral-700/40 bg-neutral-800/30" },
  { label: "의견표명", style: "text-neutral-400 border-neutral-700/50 bg-neutral-800/40" },
];

const PAGE_SIZE = 20;

function getResultStyle(r: string) {
  if (r?.includes("인정(권고)")) return "text-neutral-300 bg-neutral-800/30 border-neutral-700/40";
  if (r?.includes("불인정")) return "text-neutral-400 bg-neutral-800/30 border-neutral-700/40";
  if (r?.includes("각하")) return "text-neutral-500 bg-neutral-800/20 border-neutral-700/30";
  if (r?.includes("의견표명")) return "text-neutral-400 bg-neutral-800/30 border-neutral-700/40";
  return "text-neutral-500 bg-neutral-800/20 border-neutral-700/30";
}

function getTopicStyle(t: string) {
  return "text-neutral-400 bg-neutral-800/30 border-neutral-700/40";
}

// ── Auto-resize textarea hook ──
function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback((reset?: boolean) => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (reset) { ta.style.height = `${minHeight}px`; return; }
    ta.style.height = `${minHeight}px`;
    ta.style.height = `${Math.max(minHeight, Math.min(ta.scrollHeight, maxHeight ?? Infinity))}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

const formatDate = (d: string) => {
  if (!d || d.length < 8) return d || "";
  return `${d.slice(0, 4)}. ${d.slice(4, 6)}. ${d.slice(6, 8)}`;
};

// ── Main Component ──
export default function Home() {
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [stats, setStats] = useState<{ topic: string; count: number }[]>([]);
  const [searched, setSearched] = useState(false);
  const isFirstLoad = useRef(true);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 160 });

  // Load stats
  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase.from("nhrck_decisions").select("topic").not("topic", "is", null);
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((d) => { counts[d.topic || "기타"] = (counts[d.topic || "기타"] || 0) + 1; });
        setStats(Object.entries(counts).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count));
      }
    }
    loadStats();
  }, []);

  async function doSearch(q: string, topics: string[], results: string[], from: string, to: string, p: number) {
    setLoading(true);
    setSearched(true);
    let qb = supabase
      .from("nhrck_decisions")
      .select("id,doc_id,case_name,case_number,decision_date,committee,decision_type,topic,result,applicant,respondent,victim,order_summary,decision_summary,judgment_summary,order_text,category,view_url", { count: "exact" })
      .order("decision_date", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

    if (q.trim()) qb = qb.or(`case_name.ilike.%${q.trim()}%,decision_summary.ilike.%${q.trim()}%,order_summary.ilike.%${q.trim()}%`);
    if (topics.length > 0) qb = qb.in("topic", topics);
    if (results.length > 0) qb = qb.in("result", results);
    if (from) qb = qb.gte("decision_date", from.replace(/-/g, ""));
    if (to) qb = qb.lte("decision_date", to.replace(/-/g, ""));

    const { data, count } = await qb;
    setDecisions(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; }
  }, []);

  function handleSearch() {
    setPage(0);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, 0);
  }

  function toggleTopic(t: string) {
    const next = topicFilter.includes(t) ? topicFilter.filter((v) => v !== t) : [...topicFilter, t];
    setTopicFilter(next);
    setPage(0);
    doSearch(query, next, resultFilter, dateFrom, dateTo, 0);
  }

  function toggleResult(r: string) {
    const next = resultFilter.includes(r) ? resultFilter.filter((v) => v !== r) : [...resultFilter, r];
    setResultFilter(next);
    setPage(0);
    doSearch(query, topicFilter, next, dateFrom, dateTo, 0);
  }

  function handleReset() {
    setQuery(""); setTopicFilter([]); setResultFilter([]); setDateFrom(""); setDateTo("");
    setPage(0); setSearched(false); setDecisions([]); setTotalCount(0);
    adjustHeight(true);
  }

  function goPage(p: number) {
    setPage(p);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadDetail(d: Decision) {
    setSelected(d);
    const { data } = await supabase.from("nhrck_decisions").select("*").eq("id", d.id).single();
    if (data) setSelected(data);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const totalAll = stats.reduce((a, b) => a + b.count, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* 히어로 / 검색 영역 */}
      <div className={cn(
        "flex flex-col items-center w-full max-w-3xl mx-auto px-4 transition-all duration-500",
        searched ? "pt-8 pb-4" : "pt-[18vh] pb-8"
      )}>
        {!searched && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              인권위 결정문 검색
            </h1>
            <p className="text-neutral-500 mt-3 text-[15px]">
              국가인권위원회 결정례 {totalAll > 0 ? `${totalAll.toLocaleString()}건` : ""} 전문 검색
            </p>
          </div>
        )}

        {/* V0 스타일 검색 입력 */}
        <div className="w-full">
          <div className="relative bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg">
            <div className="overflow-y-auto">
              <Textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); adjustHeight(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="성희롱, 직장 내 괴롭힘, 장애차별 등 검색..."
                className={cn(
                  "w-full px-5 py-4",
                  "resize-none",
                  "bg-transparent",
                  "border-none",
                  "text-white text-[15px]",
                  "focus:outline-none",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "placeholder:text-neutral-600 placeholder:text-[15px]",
                  "min-h-[48px]"
                )}
                style={{ overflow: "hidden" }}
              />
            </div>

            {/* 하단 바 */}
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-2">
                {/* 기간 필터 */}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1 bg-transparent border border-dashed border-neutral-700 rounded-lg text-[12px] text-neutral-500 hover:border-neutral-500 transition-colors focus:outline-none"
                />
                <span className="text-neutral-700 text-xs">~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1 bg-transparent border border-dashed border-neutral-700 rounded-lg text-[12px] text-neutral-500 hover:border-neutral-500 transition-colors focus:outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  query.trim() || topicFilter.length > 0 || resultFilter.length > 0
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "bg-neutral-800 text-neutral-500 border border-neutral-700 hover:border-neutral-600"
                )}
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 퀵 필터 태그 */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {TOPICS.map((t) => (
              <button
                key={t.label}
                onClick={() => toggleTopic(t.label)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[12px] font-medium transition-all",
                  topicFilter.includes(t.label)
                    ? "bg-white text-black border-white"
                    : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-neutral-200"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {stats.find((s) => s.topic === t.label) && (
                  <span className={cn("text-[10px]", topicFilter.includes(t.label) ? "text-neutral-500" : "text-neutral-600")}>
                    {stats.find((s) => s.topic === t.label)?.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 처리결과 필터 */}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            {RESULTS.map((r) => (
              <button
                key={r.label}
                onClick={() => toggleResult(r.label)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all",
                  resultFilter.includes(r.label)
                    ? "bg-white text-black border-white"
                    : `${r.style} hover:brightness-125`
                )}
              >
                {r.label}
              </button>
            ))}
            {(topicFilter.length > 0 || resultFilter.length > 0 || dateFrom || dateTo) && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 결과 영역 */}
      {searched && (
        <main className="max-w-3xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[13px] text-neutral-500 font-medium">
              {loading ? "검색 중..." : `${totalCount.toLocaleString()}건의 결정문`}
            </p>
          </div>

          <div className="space-y-2">
            {decisions.map((d) => (
              <div
                key={d.id}
                onClick={() => loadDetail(d)}
                className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-700 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-neutral-100 group-hover:text-white transition-colors leading-snug">
                      {d.case_name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2 text-[12px] text-neutral-500">
                      <span className="font-mono">{d.case_number}</span>
                      <span className="text-neutral-700">·</span>
                      <span>{formatDate(d.decision_date)}</span>
                      <span className="text-neutral-700">·</span>
                      <span>{d.committee}</span>
                    </div>
                    {(d.decision_summary || d.order_summary) && (
                      <p className="mt-3 text-[13px] text-neutral-400 leading-relaxed line-clamp-2">
                        {d.decision_summary || d.order_summary}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0 pt-0.5">
                    {d.topic && (
                      <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium border", getTopicStyle(d.topic))}>
                        {d.topic}
                      </span>
                    )}
                    {d.result && (
                      <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium border", getResultStyle(d.result))}>
                        {d.result}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && decisions.length === 0 && (
            <div className="text-center py-24">
              <Search className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
              <p className="text-[16px] font-semibold text-neutral-500">검색 결과가 없습니다</p>
              <p className="text-[13px] text-neutral-600 mt-1">다른 키워드나 필터를 시도해보세요</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-8">
              <button onClick={() => goPage(Math.max(0, page - 1))} disabled={page === 0}
                className="w-10 h-10 rounded-xl border border-neutral-800 text-neutral-500 disabled:opacity-20 hover:bg-neutral-800 transition-colors flex items-center justify-center">
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const p = start + i;
                if (p >= totalPages) return null;
                return (
                  <button key={p} onClick={() => goPage(p)}
                    className={cn("w-10 h-10 rounded-xl text-[14px] font-medium transition-colors flex items-center justify-center",
                      p === page ? "bg-white text-black" : "text-neutral-500 hover:bg-neutral-800"
                    )}>
                    {p + 1}
                  </button>
                );
              })}
              <button onClick={() => goPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="w-10 h-10 rounded-xl border border-neutral-800 text-neutral-500 disabled:opacity-20 hover:bg-neutral-800 transition-colors flex items-center justify-center">
                ›
              </button>
            </div>
          )}
        </main>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 px-4" onClick={() => setSelected(null)}>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-[720px] w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="px-6 py-5 border-b border-neutral-800 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    {selected.topic && (
                      <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium border", getTopicStyle(selected.topic))}>
                        {selected.topic}
                      </span>
                    )}
                    {selected.result && (
                      <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium border", getResultStyle(selected.result))}>
                        {selected.result}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[18px] font-bold text-white leading-snug">{selected.case_name}</h2>
                  <p className="text-[13px] text-neutral-500 mt-1.5 font-mono">
                    {selected.case_number} · {formatDate(selected.decision_date)}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 모달 본문 */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  ["위원회", selected.committee],
                  ["결정유형", selected.decision_type],
                  ["신청인", selected.applicant],
                  ["피신청인", selected.respondent],
                  ["피해자", selected.victim],
                  ["분류", selected.category],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label as string} className="flex text-[13px]">
                      <span className="text-neutral-600 w-16 flex-shrink-0 font-medium">{label}</span>
                      <span className="text-neutral-300">{value}</span>
                    </div>
                  ) : null
                )}
              </div>

              {selected.order_text && (
                <section>
                  <h3 className="text-[13px] font-bold text-neutral-300 mb-2">주문</h3>
                  <div className="text-[14px] text-neutral-200 whitespace-pre-wrap bg-blue-950/30 border border-blue-900/30 p-4 rounded-xl leading-relaxed">
                    {selected.order_text}
                  </div>
                </section>
              )}

              {selected.decision_summary && (
                <section>
                  <h3 className="text-[13px] font-bold text-neutral-300 mb-2">결정요지</h3>
                  <p className="text-[14px] text-neutral-400 whitespace-pre-wrap leading-relaxed">{selected.decision_summary}</p>
                </section>
              )}

              {selected.judgment_summary && (
                <section>
                  <h3 className="text-[13px] font-bold text-neutral-300 mb-2">판단요지</h3>
                  <p className="text-[14px] text-neutral-400 whitespace-pre-wrap leading-relaxed">{selected.judgment_summary}</p>
                </section>
              )}

              {selected.reason && (
                <section>
                  <h3 className="text-[13px] font-bold text-neutral-300 mb-2">이유</h3>
                  <div className="text-[13px] text-neutral-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-neutral-950 border border-neutral-800 p-4 rounded-xl">
                    {selected.reason}
                  </div>
                </section>
              )}

              {selected.view_url && (
                <a
                  href={selected.view_url.startsWith("http") ? selected.view_url : `https://www.law.go.kr${selected.view_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-[13px] font-semibold hover:bg-neutral-200 transition-colors"
                >
                  원본 보기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
