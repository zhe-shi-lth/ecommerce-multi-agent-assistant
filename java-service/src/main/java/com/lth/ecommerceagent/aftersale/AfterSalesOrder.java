package com.lth.ecommerceagent.aftersale;

import java.math.BigDecimal;
import java.time.Instant;
import com.lth.ecommerceagent.order.Order;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "after_sales_orders")
public class AfterSalesOrder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "after_sale_no", nullable = false, unique = true, length = 80) private String afterSaleNo;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id") private Order order;
    @Column(nullable = false, length = 30) private String type;
    @Column(nullable = false, length = 30) private String status;
    @Column(nullable = false) private Integer quantity;
    @Column(name = "refund_amount", nullable = false, precision = 14, scale = 2) private BigDecimal refundAmount;
    @Column(nullable = false, length = 500) private String reason;
    @Column(name = "return_disposition", length = 30) private String returnDisposition;
    @Column(name = "refunded_at") private Instant refundedAt;
    @Column(name = "received_at") private Instant receivedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Version @Column(nullable = false) private Long version;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;
    public Long getId(){return id;} public String getAfterSaleNo(){return afterSaleNo;} public void setAfterSaleNo(String v){afterSaleNo=v;}
    public Order getOrder(){return order;} public void setOrder(Order v){order=v;} public String getType(){return type;} public void setType(String v){type=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;} public Integer getQuantity(){return quantity;} public void setQuantity(Integer v){quantity=v;}
    public BigDecimal getRefundAmount(){return refundAmount;} public void setRefundAmount(BigDecimal v){refundAmount=v;} public String getReason(){return reason;} public void setReason(String v){reason=v;}
    public String getReturnDisposition(){return returnDisposition;} public void setReturnDisposition(String v){returnDisposition=v;}
    public Instant getRefundedAt(){return refundedAt;} public void setRefundedAt(Instant v){refundedAt=v;} public Instant getReceivedAt(){return receivedAt;} public void setReceivedAt(Instant v){receivedAt=v;}
    public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;} public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
}
