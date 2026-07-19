import type { Json } from "../api/types";

// 计划 JSON 字段的中文标签（snake_case → 可读）。未命中的键原样显示。
const LABELS: Record<string, string> = {
  recommended_title: "推荐标题",
  selling_points: "卖点",
  detail_description: "详情描述",
  target_user_summary: "目标人群",
  listing_suggestion: "上架建议",
  seo_keywords: "SEO 关键词",
  meta_description: "搜索摘要",
  platform_copies: "各平台文案",
  main_image_prompt: "主图创意",
  scene_image_prompt: "场景图创意",
  marketing_image_prompt: "营销图创意",
  image_style: "图片风格",
  image_risk_notes: "图片风险提示",
  image_review_result: "视觉审核",
  main_image_url: "主图",
  scene_image_url: "场景图",
  marketing_image_url: "营销图",
  inventory_status: "库存状态",
  should_restock: "是否建议补货",
  suggested_restock_quantity: "建议补货数量",
  restock_priority: "补货优先级",
  reason: "分析依据",
  daily_demand: "日均需求",
  available_stock: "可用库存",
  projected_stock: "预计库存",
  purchase_cycle_days: "补货周期（天）",
  days_to_stockout: "预计可售天数",
  required_coverage: "目标覆盖",
  overall_score: "综合评分",
  risk_level: "风险等级",
  issues: "问题点",
  suggestions: "修改建议",
  reviewer: "审核方式",
  can_ship: "能否发货",
  fulfillment_status: "履约状态",
  risk_flags: "风险标记",
  manual_review_required: "是否需人工审核",
  next_order_status: "下一订单状态",
  logistics_risk_level: "物流风险",
  anomaly_details: "异常详情",
  suggested_actions: "建议动作",
  after_sale_suggested: "是否建议售后",
  after_sale_reason: "售后原因",
};

function labelOf(key: string): string {
  return LABELS[key] ?? key;
}

function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function renderScalar(v: Json): React.ReactNode {
  if (typeof v === "boolean") return v ? "是" : "否";
  if (v === null || v === "") return <span className="muted">—</span>;
  return String(v);
}

interface FieldListProps {
  data: { [key: string]: Json } | null;
}

/** 把计划 JSON 递归渲染成中文可读的字段列表。 */
export default function PlanFields({ data }: FieldListProps) {
  if (!data) return <p className="muted">（暂无内容）</p>;
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="muted">（暂无内容）</p>;

  return (
    <div className="plan-fields">
      {entries.map(([key, value]) => {
        const label = labelOf(key);

        // 图片 URL：直接展示为图片
        if (
          (key.endsWith("_url") || key === "main_image_url" || key === "scene_image_url" || key === "marketing_image_url") &&
          typeof value === "string" &&
          value
        ) {
          return (
            <div className="pf-row pf-row-image" key={key}>
              <div className="pf-key">{label}</div>
              <div className="pf-val">
                <img src={value} alt={label} className="pf-image" />
              </div>
            </div>
          );
        }

        // 嵌套对象：再递归一层
        if (isObject(value)) {
          return (
            <div className="pf-row pf-row-nested" key={key}>
              <div className="pf-key">{label}</div>
              <div className="pf-val">
                <PlanFields data={value} />
              </div>
            </div>
          );
        }

        // 数组：字符串/数字做成标签，对象数组逐条展示
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return (
              <div className="pf-row" key={key}>
                <div className="pf-key">{label}</div>
                <div className="pf-val"><span className="muted">—</span></div>
              </div>
            );
          }
          const allScalar = value.every((x) => typeof x !== "object" || x === null);
          return (
            <div className="pf-row" key={key}>
              <div className="pf-key">{label}</div>
              <div className="pf-val">
                {allScalar ? (
                  <div className="pf-chips">
                    {value.map((x, i) => (
                      <span className="pf-chip" key={i}>{renderScalar(x)}</span>
                    ))}
                  </div>
                ) : (
                  <div className="pf-list">
                    {value.map((x, i) => (
                      <div className="pf-list-item" key={i}>
                        {isObject(x) ? <PlanFields data={x} /> : renderScalar(x)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="pf-row" key={key}>
            <div className="pf-key">{label}</div>
            <div className="pf-val">{renderScalar(value)}</div>
          </div>
        );
      })}
    </div>
  );
}
