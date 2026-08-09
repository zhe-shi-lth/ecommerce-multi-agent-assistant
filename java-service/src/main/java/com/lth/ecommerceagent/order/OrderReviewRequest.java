package com.lth.ecommerceagent.order;

/**
 * 人工审核决议：APPROVE=审核通过（放行履约）/ REJECT=驳回（不履约，线下取消或退款）。
 */
public record OrderReviewRequest(String decision) {

    public boolean isApprove() {
        return "APPROVE".equalsIgnoreCase(decision);
    }

    public boolean isReject() {
        return "REJECT".equalsIgnoreCase(decision);
    }
}
