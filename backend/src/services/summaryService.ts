import { db } from "../db.ts";
import type { Order } from "../model.ts";

const commonTests = [
  "alt", "ast", "bilirubin", "calcium", "cbc", "cholesterol",
  "complete blood count", "creatinine", "fasting glucose", "glucose", "hba1c",
  "hdl", "hdl cholesterol", "haemoglobin", "hemoglobin", "ldl", "ldl cholesterol",
  "platelet", "platelet count", "potassium", "rbc count", "sodium", "tsh",
  "total cholesterol", "total leukocyte count", "triglycerides", "urea",
  "uric acid", "wbc", "vitamin d",
];

const testIsSupported = (parameter: string) => {
  const normalized = parameter.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return commonTests.some((test) => normalized.includes(test));
};

export const boundsFrom = (range: string): [number, number] | null => {
  const match = range.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (match) return [Number(match[1]), Number(match[2])];
  const upperBound = range.match(/(?:below|under|less than|<=?)\s*(-?\d+(?:\.\d+)?)/i);
  if (upperBound) return [Number.NEGATIVE_INFINITY, Number(upperBound[1])];
  const lowerBound = range.match(/(?:above|over|greater than|>=?)\s*(-?\d+(?:\.\d+)?)/i);
  if (lowerBound) return [Number(lowerBound[1]), Number.POSITIVE_INFINITY];
  return null;
};

export function isOutsideReferenceRange(result: string, range: string) {
  const value = Number.parseFloat(result);
  const bounds = boundsFrom(range);
  return Number.isFinite(value) && bounds !== null && (value < bounds[0] || value > bounds[1]);
}

export function createSummaryForOrder(order: Order, critical: boolean) {
  if (critical || order.status !== "ready" || !isOutsideReferenceRange(order.result, order.reference_range) || !testIsSupported(order.parameter)) {
    return false;
  }

  const value = `${order.result} ${order.unit}`.trim();
  const range = `${order.reference_range} ${order.unit}`.trim();
  const summaries = {
    en: `Your ${order.parameter} result is ${value}; the reference range is ${range}. It is outside that range. View the full report and discuss next steps with your doctor.`,
    te: `మీ ${order.parameter} ఫలితం ${value}; సాధారణ పరిధి ${range}. ఇది పరిధికి వెలుపల ఉంది. పూర్తి నివేదికను చూడండి; తదుపరి చర్యల కోసం మీ వైద్యుడిని సంప్రదించండి.`,
    hi: `आपका ${order.parameter} परिणाम ${value} है; संदर्भ सीमा ${range} है। यह सीमा से बाहर है। पूरी रिपोर्ट देखें और आगे के लिए अपने डॉक्टर से बात करें।`,
  };
  const generatedAt = new Date().toISOString();
  db.prepare("UPDATE orders SET summary_en = ?, summary_te = ?, summary_hi = ? WHERE id = ?")
    .run(summaries.en, summaries.te, summaries.hi, order.id);
  db.prepare(`
    INSERT INTO summary_reviews (order_id, status, generated_at)
    VALUES (?, 'pending', ?)
    ON CONFLICT (order_id) DO NOTHING
  `).run(order.id, generatedAt);
  return true;
}
