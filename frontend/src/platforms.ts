// 平台维度常量（与后端 export / 模拟器 / 迁移保持一致：小写 key）。
export interface PlatformMeta {
  key: string;
  label: string;
  // 徽章配色（复用 .badge 体系）
  tone: "taobao" | "douyin" | "xhs" | "neutral";
}

export const PLATFORMS: PlatformMeta[] = [
  { key: "taobao", label: "淘宝", tone: "taobao" },
  { key: "douyin", label: "抖音", tone: "douyin" },
  { key: "xiaohongshu", label: "小红书", tone: "xhs" },
];

export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.label])
);

export function platformLabel(key: string | undefined | null): string {
  if (!key) return "";
  return PLATFORM_LABEL[key] ?? key;
}

export function platformTone(key: string | undefined | null): string {
  const meta = PLATFORMS.find((p) => p.key === key);
  return meta ? meta.tone : "neutral";
}

// 按平台筛选：ALL=全部；其他=精确匹配（仅三个真实平台）。
export function platformMatches(
  itemPlatform: string | undefined | null,
  selected: string
): boolean {
  if (selected === "ALL") return true;
  return itemPlatform === selected;
}
