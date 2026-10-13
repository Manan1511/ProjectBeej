"use client";

import { useReportWebVitals } from "next/web-vitals";
import { emitCommerceEvent } from "@/lib/tracking-client";

type VitalMetric = { id: string; name: string; value: number };
const sent = new Set<string>();

function report(metric: VitalMetric) {
  if (!["CLS", "FCP", "INP", "LCP", "TTFB"].includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return;
  const key = `${metric.name}:${metric.id}`;
  if (sent.has(key)) return;
  sent.add(key);
  emitCommerceEvent({ name: "web_vital", metric_name: metric.name as "CLS" | "FCP" | "INP" | "LCP" | "TTFB", value: metric.value, metric_id: metric.id.slice(0, 120) });
}

export function WebVitalsReporter() {
  useReportWebVitals(report);
  return null;
}
