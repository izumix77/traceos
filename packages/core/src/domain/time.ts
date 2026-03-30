// Constitution v0.6 §5
//
// createdAt は client 申告値。カーネルは検証しない。
// append order が canonical order。createdAt は表示・参照用のメタデータ。

export type ISOTimestamp = string;

// 最小チェック: "T" を含み "Z" で終わる文字列
// 厳密な検証は ingestion layer の責務
export const isISOTimestamp = (s: string): boolean =>
  typeof s === "string" && s.includes("T") && s.endsWith("Z");
