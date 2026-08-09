-- 待处理原因：仅 status=PENDING_ANALYSIS 时有意义，用于前端按原因归类与路由话术（催付 / 催补全地址）。
ALTER TABLE orders ADD COLUMN pending_reason VARCHAR(30);

-- 回填存量待分析订单：依据 付款/地址完整 推导原因枚举。
UPDATE orders
SET pending_reason =
    CASE
        WHEN NOT paid AND NOT address_complete THEN 'UNPAID_AND_ADDRESS'
        WHEN NOT paid THEN 'UNPAID'
        WHEN NOT address_complete THEN 'ADDRESS_INCOMPLETE'
        ELSE NULL
    END
WHERE status = 'PENDING_ANALYSIS';
