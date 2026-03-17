"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

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

const TOPICS = [
  { label: "성희롱", color: "bg-rose-50 text-rose-600 border-rose-200" },
  { label: "성폭력", color: "bg-red-50 text-red-600 border-red-200" },
  { label: "성차별", color: "bg-orange-50 text-orange-600 border-orange-200" },
  { label: "괴롭힘", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { label: "장애차별", color: "bg-violet-50 text-violet-600 border-violet-200" },
  { label: "인권침해", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { label: "차별", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { label: "기타", color: "bg-gray-50 text-gray-500 border-gray-200" },
];

const RESULTS = [
  { label: "인정(권고)", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { label: "불인정(기각)", color: "bg-red-50 text-red-500 border-red-200" },
  { label: "각하", color: "bg-gray-50 text-gray-500 border-gray-200" },
  { label: "조정", color: "bg-sky-50 text-sky-600 border-sky-200" },
  { label: "의견표명", color: "bg-purple-50 text-purple-600 border-purple-200" },
  { label: "기타", color: "bg-gray-50 text-gray-500 border-gray-200" },
];

const PAGE_SIZE = 20;

function getTopicStyle(topic: string) {
  return TOPICS.find((t) => t.label === topic)?.color || "bg-gray-50 text-gray-500 border-gray-200";
}

function getResultStyle(result: string) {
  if (result.includes("인정(권고)")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (result.includes("불인정")) return "bg-red-50 text-red-500 border-red-200";
  if (result.includes("각하")) return "bg-gray-100 text-gray-500 border-gray-200";
  if (result.includes("조정")) return "bg-sky-50 text-sky-600 border-sky-200";
  if (result.includes("의견표명")) return "bg-purple-50 text-purple-600 border-purple-200";
  return "bg-gray-50 text-gray-500 border-gray-200";
}

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
  const isFirstLoad = useRef(true);

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase
        .from("nhrck_decisions")
        .select("topic")
        .not("topic", "is", null);
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((d) => {
          const t = d.topic || "기타";
          counts[t] = (counts[t] || 0) + 1;
        });
        setStats(
          Object.entries(counts)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
        );
      }
    }
    loadStats();
  }, []);

  async function doSearch(
    q: string, topics: string[], results: string[],
    from: string, to: string, p: number
  ) {
    setLoading(true);
    let query_builder = supabase
      .from("nhrck_decisions")
      .select(
        "id,doc_id,case_name,case_number,decision_date,committee,decision_type,topic,result,applicant,respondent,victim,order_summary,decision_summary,judgment_summary,order_text,category,view_url",
        { count: "exact" }
      )
      .order("decision_date", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

    if (q.trim()) {
      query_builder = query_builder.or(
        `case_name.ilike.%${q.trim()}%,decision_summary.ilike.%${q.trim()}%,order_summary.ilike.%${q.trim()}%`
      );
    }
    if (topics.length > 0) query_builder = query_builder.in("topic", topics);
    if (results.length > 0) query_builder = query_builder.in("result", results);
    if (from) query_builder = query_builder.gte("decision_date", from.replace(/-/g, ""));
    if (to) query_builder = query_builder.lte("decision_date", to.replace(/-/g, ""));

    const { data, count } = await query_builder;
    setDecisions(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      doSearch("", [], [], "", "", 0);
    }
  }, []);

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

  function handleSearch() {
    setPage(0);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, 0);
  }

  function handleReset() {
    setQuery("");
    setTopicFilter([]);
    setResultFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(0);
    doSearch("", [], [], "", "", 0);
  }

  function goPage(p: number) {
    setPage(p);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadDetail(d: Decision) {
    setSelected(d);
    const { data } = await supabase
      .from("nhrck_decisions")
      .select("*")
      .eq("id", d.id)
      .single();
    if (data) setSelected(data);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (d: string) => {
    if (!d || d.length < 8) return d || "";
    return `${d.slice(0, 4)}. ${d.slice(4, 6)}. ${d.slice(6, 8)}`;
  };

  const totalAll = stats.reduce((a, b) => a + b.count, 0);

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-[800px] mx-auto px-5 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
              인권위 결정문
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5 font-medium">
              국가인권위원회 결정례 검색
            </p>
          </div>
          <div className="text-right">
            <span className="text-[28px] font-bold text-gray-900 tracking-tight">
              {totalAll > 0 ? totalAll.toLocaleString() : "—"}
            </span>
            <span className="text-[13px] text-gray-400 ml-1">건</span>
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-5 py-8">
        {/* 검색 */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="사건명, 결정요지로 검색하세요"
            className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-[15px] placeholder:text-gray-300 transition-shadow"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[14px] font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            검색
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
          {/* 주제 */}
          <div className="mb-4">
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              주제
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.label}
                  onClick={() => toggleTopic(t.label)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    topicFilter.includes(t.label)
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : `${t.color} hover:shadow-sm`
                  }`}
                >
                  {t.label}
                  {stats.find((s) => s.topic === t.label) && (
                    <span className={`ml-1.5 text-[11px] ${topicFilter.includes(t.label) ? "text-gray-400" : "opacity-50"}`}>
                      {stats.find((s) => s.topic === t.label)?.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 처리결과 */}
          <div className="mb-4">
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              처리결과
            </p>
            <div className="flex flex-wrap gap-2">
              {RESULTS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => toggleResult(r.label)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
                    resultFilter.includes(r.label)
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : `${r.color} hover:shadow-sm`
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-3">
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
              기간
            </p>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); }}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <span className="text-gray-300 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); }}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            {(topicFilter.length > 0 || resultFilter.length > 0 || dateFrom || dateTo || query) && (
              <button
                onClick={handleReset}
                className="ml-auto text-[13px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 결과 헤더 */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[13px] text-gray-400 font-medium">
            {loading ? "검색 중..." : `${totalCount.toLocaleString()}건`}
          </p>
        </div>

        {/* 결과 목록 */}
        <div className="space-y-3">
          {decisions.map((d) => (
            <div
              key={d.id}
              onClick={() => loadDetail(d)}
              className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {d.case_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2 text-[12px] text-gray-400">
                    <span className="font-medium">{d.case_number}</span>
                    <span>·</span>
                    <span>{formatDate(d.decision_date)}</span>
                    <span>·</span>
                    <span>{d.committee}</span>
                  </div>
                  {(d.decision_summary || d.order_summary) && (
                    <p className="mt-3 text-[13px] text-gray-500 leading-relaxed line-clamp-2">
                      {d.decision_summary || d.order_summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 pt-0.5">
                  {d.topic && (
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getTopicStyle(d.topic)}`}>
                      {d.topic}
                    </span>
                  )}
                  {d.result && (
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getResultStyle(d.result)}`}>
                      {d.result}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 빈 결과 */}
        {!loading && decisions.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-[16px] font-semibold text-gray-400">
              검색 결과가 없습니다
            </p>
            <p className="text-[13px] text-gray-300 mt-1">
              다른 키워드나 필터를 시도해보세요
            </p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-8">
            <button
              onClick={() => goPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="w-10 h-10 rounded-xl border border-gray-200 text-[14px] text-gray-500 disabled:opacity-20 hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => goPage(p)}
                  className={`w-10 h-10 rounded-xl text-[14px] font-medium transition-colors flex items-center justify-center ${
                    p === page
                      ? "bg-gray-900 text-white"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => goPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="w-10 h-10 rounded-xl border border-gray-200 text-[14px] text-gray-500 disabled:opacity-20 hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              ›
            </button>
          </div>
        )}
      </main>

      {/* 상세 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-8 px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-[720px] w-full max-h-[88vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="px-7 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    {selected.topic && (
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getTopicStyle(selected.topic)}`}>
                        {selected.topic}
                      </span>
                    )}
                    {selected.result && (
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getResultStyle(selected.result)}`}>
                        {selected.result}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[18px] font-bold text-gray-900 leading-snug">
                    {selected.case_name}
                  </h2>
                  <p className="text-[13px] text-gray-400 mt-1.5 font-medium">
                    {selected.case_number} · {formatDate(selected.decision_date)}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 flex items-center justify-center transition-colors text-lg flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 모달 본문 */}
            <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  ["위원회", selected.committee],
                  ["결정유형", selected.decision_type],
                  ["신청인", selected.applicant],
                  ["피신청인", selected.respondent],
                  ["피해자", selected.victim],
                  ["분류", selected.category],
                ].map(
                  ([label, value]) =>
                    value && (
                      <div key={label as string} className="flex text-[13px]">
                        <span className="text-gray-400 w-16 flex-shrink-0 font-medium">
                          {label}
                        </span>
                        <span className="text-gray-700">{value}</span>
                      </div>
                    )
                )}
              </div>

              {/* 주문 */}
              {selected.order_text && (
                <section>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-2">
                    주문
                  </h3>
                  <div className="text-[14px] text-gray-700 whitespace-pre-wrap bg-blue-50/50 border border-blue-100 p-4 rounded-2xl leading-relaxed">
                    {selected.order_text}
                  </div>
                </section>
              )}

              {selected.decision_summary && (
                <section>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-2">
                    결정요지
                  </h3>
                  <p className="text-[14px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {selected.decision_summary}
                  </p>
                </section>
              )}

              {selected.judgment_summary && (
                <section>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-2">
                    판단요지
                  </h3>
                  <p className="text-[14px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {selected.judgment_summary}
                  </p>
                </section>
              )}

              {selected.reason && (
                <section>
                  <h3 className="text-[13px] font-bold text-gray-900 mb-2">
                    이유
                  </h3>
                  <div className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                    {selected.reason}
                  </div>
                </section>
              )}

              {selected.view_url && (
                <a
                  href={
                    selected.view_url.startsWith("http")
                      ? selected.view_url
                      : `https://www.law.go.kr${selected.view_url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-semibold hover:bg-gray-800 transition-colors"
                >
                  원본 보기 ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
