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
  reason: string;
  order_text: string;
  category: string;
  view_url: string;
  full_text: string;
};

const TOPICS = [
  "성희롱",
  "성폭력",
  "성차별",
  "괴롭힘",
  "장애차별",
  "인권침해",
  "차별",
  "기타",
];

const RESULTS = ["인정(권고)", "불인정(기각)", "각하", "조정", "의견표명", "기타"];

const PAGE_SIZE = 20;

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

  // 통계 로드
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
        const sorted = Object.entries(counts)
          .map(([topic, count]) => ({ topic, count }))
          .sort((a, b) => b.count - a.count);
        setStats(sorted);
      }
    }
    loadStats();
  }, []);

  // 검색 함수
  async function doSearch(
    searchQuery: string,
    topics: string[],
    results: string[],
    from: string,
    to: string,
    pageNum: number
  ) {
    setLoading(true);

    // 본문 제외 필드만 가져오기 (목록용)
    let q = supabase
      .from("nhrck_decisions")
      .select(
        "id,doc_id,case_name,case_number,decision_date,committee,decision_type,topic,result,applicant,respondent,victim,order_summary,decision_summary,judgment_summary,order_text,category,view_url",
        { count: "exact" }
      )
      .order("decision_date", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    // 텍스트 검색: 사건명 + 결정요지에서 검색
    if (searchQuery.trim()) {
      q = q.or(
        `case_name.ilike.%${searchQuery.trim()}%,decision_summary.ilike.%${searchQuery.trim()}%,order_summary.ilike.%${searchQuery.trim()}%`
      );
    }

    // 주제 필터
    if (topics.length > 0) {
      q = q.in("topic", topics);
    }

    // 처리결과 필터
    if (results.length > 0) {
      q = q.in("result", results);
    }

    // 기간 필터
    if (from) {
      q = q.gte("decision_date", from.replace(/-/g, ""));
    }
    if (to) {
      q = q.lte("decision_date", to.replace(/-/g, ""));
    }

    const { data, count, error } = await q;
    if (error) {
      console.error("Search error:", error);
    }
    setDecisions(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }

  // 초기 로드
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      doSearch("", [], [], "", "", 0);
    }
  }, []);

  // 태그 토글 → 즉시 검색
  function toggleTopic(t: string) {
    const next = topicFilter.includes(t)
      ? topicFilter.filter((v) => v !== t)
      : [...topicFilter, t];
    setTopicFilter(next);
    setPage(0);
    doSearch(query, next, resultFilter, dateFrom, dateTo, 0);
  }

  function toggleResult(r: string) {
    const next = resultFilter.includes(r)
      ? resultFilter.filter((v) => v !== r)
      : [...resultFilter, r];
    setResultFilter(next);
    setPage(0);
    doSearch(query, topicFilter, next, dateFrom, dateTo, 0);
  }

  // 검색 실행
  function handleSearch() {
    setPage(0);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, 0);
  }

  // 초기화
  function handleReset() {
    setQuery("");
    setTopicFilter([]);
    setResultFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(0);
    doSearch("", [], [], "", "", 0);
  }

  // 페이지 이동
  function goPage(p: number) {
    setPage(p);
    doSearch(query, topicFilter, resultFilter, dateFrom, dateTo, p);
  }

  // 상세 조회 (reason 포함)
  async function loadDetail(d: Decision) {
    const { data } = await supabase
      .from("nhrck_decisions")
      .select("*")
      .eq("id", d.id)
      .single();
    setSelected(data || d);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (d: string) => {
    if (!d || d.length < 8) return d || "";
    return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  };

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            국가인권위원회 결정문 검색
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            전체 {totalCount.toLocaleString()}건
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 검색바 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="사건명, 결정요지, 주문요지 검색..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? "검색 중..." : "검색"}
            </button>
          </div>

          {/* 기간 필터 */}
          <div className="flex items-center gap-2 mt-3 text-sm">
            <span className="text-gray-500 font-medium">기간</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* 주제 태그 */}
          <div className="mt-3">
            <span className="text-sm text-gray-500 font-medium mr-2">
              주제
            </span>
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    topicFilter.includes(t)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 처리결과 태그 */}
          <div className="mt-2">
            <span className="text-sm text-gray-500 font-medium mr-2">
              결과
            </span>
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {RESULTS.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleResult(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    resultFilter.includes(r)
                      ? r.includes("인정(권고)")
                        ? "bg-green-600 text-white"
                        : r.includes("불인정")
                        ? "bg-red-600 text-white"
                        : "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 초기화 */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleReset}
              className="px-4 py-1.5 bg-white text-gray-600 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              초기화
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        {stats.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {stats.slice(0, 8).map((s) => (
              <div
                key={s.topic}
                onClick={() => {
                  const next = [s.topic];
                  setTopicFilter(next);
                  setPage(0);
                  doSearch(query, next, resultFilter, dateFrom, dateTo, 0);
                }}
                className={`flex-shrink-0 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  topicFilter.includes(s.topic)
                    ? "bg-blue-50 border-blue-400"
                    : "bg-white border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="text-xs text-gray-500">{s.topic}</div>
                <div className="text-lg font-bold text-gray-900">
                  {s.count}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 검색 결과 */}
        <div className="space-y-2">
          {decisions.map((d) => (
            <div
              key={d.id}
              onClick={() => loadDetail(d)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {d.case_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span>{d.case_number}</span>
                    <span>|</span>
                    <span>{formatDate(d.decision_date)}</span>
                    <span>|</span>
                    <span>{d.committee}</span>
                  </div>
                  {(d.order_summary || d.decision_summary) && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {d.decision_summary || d.order_summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {d.topic && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {d.topic}
                    </span>
                  )}
                  {d.result && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        d.result.includes("인정(권고)")
                          ? "bg-green-50 text-green-700"
                          : d.result.includes("불인정")
                          ? "bg-red-50 text-red-700"
                          : d.result.includes("각하")
                          ? "bg-gray-100 text-gray-600"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {d.result}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 결과 없음 */}
        {!loading && decisions.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 키워드나 필터를 시도해보세요</p>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">검색 중...</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => goPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-30 hover:bg-gray-50"
            >
              이전
            </button>
            <span className="text-sm text-gray-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => goPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-30 hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        )}
      </main>

      {/* 상세 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-10 px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selected.case_name}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 flex-wrap">
                  <span>{selected.case_number}</span>
                  <span>|</span>
                  <span>{formatDate(selected.decision_date)}</span>
                  {selected.topic && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {selected.topic}
                    </span>
                  )}
                  {selected.result && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        selected.result.includes("인정(권고)")
                          ? "bg-green-50 text-green-700"
                          : selected.result.includes("불인정")
                          ? "bg-red-50 text-red-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {selected.result}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selected.committee && (
                  <div>
                    <span className="text-gray-500">위원회: </span>
                    {selected.committee}
                  </div>
                )}
                {selected.decision_type && (
                  <div>
                    <span className="text-gray-500">결정유형: </span>
                    {selected.decision_type}
                  </div>
                )}
                {selected.applicant && (
                  <div>
                    <span className="text-gray-500">신청인: </span>
                    {selected.applicant}
                  </div>
                )}
                {selected.respondent && (
                  <div>
                    <span className="text-gray-500">피신청인: </span>
                    {selected.respondent}
                  </div>
                )}
              </div>

              {selected.order_text && (
                <section>
                  <h3 className="font-bold text-gray-800 mb-1">주문</h3>
                  <p className="text-gray-700 whitespace-pre-wrap bg-blue-50 p-3 rounded">
                    {selected.order_text}
                  </p>
                </section>
              )}

              {selected.decision_summary && (
                <section>
                  <h3 className="font-bold text-gray-800 mb-1">결정요지</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selected.decision_summary}
                  </p>
                </section>
              )}

              {selected.judgment_summary && (
                <section>
                  <h3 className="font-bold text-gray-800 mb-1">판단요지</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selected.judgment_summary}
                  </p>
                </section>
              )}

              {selected.reason && (
                <section>
                  <h3 className="font-bold text-gray-800 mb-1">이유</h3>
                  <div className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed max-h-96 overflow-y-auto bg-gray-50 p-3 rounded">
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
                  className="inline-block px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-900"
                >
                  원본 보기
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
