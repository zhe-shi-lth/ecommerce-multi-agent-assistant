package com.lth.ecommerceagent.aftersale;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.lth.ecommerceagent.audit.BusinessAuditService;
import com.lth.ecommerceagent.inventory.InventoryMovementService;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.sales.SalesRecordingService;

@Service
public class AfterSalesService {
    private final AfterSalesRepository repository;
    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryMovementService movementService;
    private final SalesRecordingService salesService;
    private final BusinessAuditService auditService;

    public AfterSalesService(AfterSalesRepository repository, OrderRepository orderRepository,
            InventoryRepository inventoryRepository, InventoryMovementService movementService,
            SalesRecordingService salesService, BusinessAuditService auditService) {
        this.repository=repository; this.orderRepository=orderRepository; this.inventoryRepository=inventoryRepository;
        this.movementService=movementService; this.salesService=salesService; this.auditService=auditService;
    }

    @Transactional
    public AfterSalesResponse create(AfterSalesRequest request) {
        if (request.orderId()==null || !Set.of("REFUND_ONLY","RETURN_REFUND").contains(request.type())) bad("售后类型仅支持 REFUND_ONLY 或 RETURN_REFUND");
        Order order=orderRepository.findByIdForUpdate(request.orderId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"订单不存在"));
        if (!Set.of("SHIPPED","CANCELLED","REJECTED","REFUNDED").contains(order.getStatus())) bad("当前订单状态不能发起售后："+order.getStatus());
        if ("RETURN_REFUND".equals(request.type()) && order.getShippedAt() == null) bad("未发货订单不能申请退货退款，请使用仅退款");
        int qty=request.quantity()==null?0:request.quantity();
        if(qty<=0 || qty+(repository.allocatedQuantity(order.getId())==null?0:repository.allocatedQuantity(order.getId()))>order.getQuantity()) bad("售后数量超过订单剩余可售后数量");
        BigDecimal amount=request.refundAmount()==null?BigDecimal.ZERO:request.refundAmount();
        BigDecimal allocated=repository.allocatedAmount(order.getId());
        if(amount.compareTo(BigDecimal.ZERO)<=0 || allocated.add(amount).compareTo(order.getPayment())>0) bad("退款金额必须大于 0，且不能超过订单剩余可退款金额");
        if(request.reason()==null||request.reason().isBlank()) bad("必须填写售后原因");
        AfterSalesOrder a=new AfterSalesOrder(); a.setAfterSaleNo("AS"+Instant.now().toEpochMilli()+UUID.randomUUID().toString().substring(0,6));
        a.setOrder(order); a.setType(request.type()); a.setQuantity(qty); a.setRefundAmount(amount.setScale(2,RoundingMode.HALF_UP)); a.setReason(request.reason().trim()); a.setStatus("PENDING");
        AfterSalesOrder saved=repository.save(a); auditService.record("AFTER_SALE","AFTER_SALE",saved.getId(),"CREATE",null,"PENDING","订单 #"+order.getId());
        return AfterSalesResponse.from(saved);
    }

    @Transactional
    public AfterSalesResponse approveRefund(Long id) {
        AfterSalesOrder a=locked(id); if(!"PENDING".equals(a.getStatus())) conflict("仅待处理售后可以确认退款");
        Order order=a.getOrder(); a.setRefundedAt(Instant.now());
        if("RETURN_REFUND".equals(a.getType())) a.setStatus("WAITING_RETURN"); else {a.setStatus("COMPLETED");a.setCompletedAt(Instant.now());}
        if (order.getShippedAt() != null) {
            salesService.reverseAfterSale(order,a.getQuantity(),a.getRefundAmount());
        }
        if (order.getShippedAt() != null) updateOrderFinancials(order,a.getRefundAmount());
        AfterSalesOrder saved=repository.saveAndFlush(a);
        if(isWholeOrderRefunded(order)) {order.setStatus("REFUNDED");order.setFulfillmentSuggestionStatus("REFUNDED");order.setRefundedAt(Instant.now());}
        orderRepository.save(order);
        auditService.record("AFTER_SALE","AFTER_SALE",id,"REFUND","PENDING",saved.getStatus(),"退款 "+a.getRefundAmount()); return AfterSalesResponse.from(saved);
    }

    @Transactional
    public AfterSalesResponse receiveReturn(Long id, ReturnReceiveRequest request) {
        AfterSalesOrder a=locked(id); if(!"WAITING_RETURN".equals(a.getStatus())) conflict("仅等待退货的售后可以确认收货");
        if(request==null || !Set.of("RESTOCK","DAMAGED").contains(request.disposition())) bad("退货去向仅支持 RESTOCK 或 DAMAGED");
        if("RESTOCK".equals(request.disposition())) {
            if(inventoryRepository.incrementStock(a.getOrder().getProduct().getId(),a.getQuantity())==0) conflict("退货入库失败：库存记录不存在");
            movementService.record(a.getOrder().getProduct().getId(),"AFTER_SALE_RETURN",a.getQuantity(),0,"AFTER_SALE",a.getId(),request.note()==null?"售后退货入库":request.note());
            restoreReturnedGoodsCost(a.getOrder(), a.getQuantity());
        }
        a.setReturnDisposition(request.disposition());a.setReceivedAt(Instant.now());a.setCompletedAt(Instant.now());a.setStatus("COMPLETED");
        AfterSalesOrder saved=repository.saveAndFlush(a); Order order=a.getOrder();
        Integer returned=repository.completedReturnQuantity(order.getId());
        if(returned!=null && returned>=order.getQuantity()){order.setStatus("RETURNED");order.setFulfillmentSuggestionStatus("RETURNED");order.setReturnedAt(Instant.now());}
        orderRepository.save(order);
        auditService.record("AFTER_SALE","AFTER_SALE",id,"RECEIVE_RETURN","WAITING_RETURN","COMPLETED","去向："+request.disposition()); return AfterSalesResponse.from(saved);
    }

    @Transactional public AfterSalesResponse reject(Long id,String reason){AfterSalesOrder a=locked(id);if(!"PENDING".equals(a.getStatus()))conflict("仅待处理售后可以驳回");if(reason==null||reason.isBlank())bad("必须填写驳回原因");a.setStatus("REJECTED");AfterSalesOrder s=repository.save(a);auditService.record("AFTER_SALE","AFTER_SALE",id,"REJECT","PENDING","REJECTED",reason.trim());return AfterSalesResponse.from(s);}
    @Transactional(readOnly=true) public List<AfterSalesResponse> list(Long orderId){List<AfterSalesOrder> rows=orderId==null?repository.findAll():repository.findByOrderIdOrderByCreatedAtDesc(orderId);return rows.stream().map(AfterSalesResponse::from).toList();}
    private AfterSalesOrder locked(Long id){return repository.findByIdForUpdate(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"售后单不存在"));}
    private boolean isWholeOrderRefunded(Order o){Integer q=repository.approvedRefundQuantity(o.getId());BigDecimal amount=repository.approvedRefundAmount(o.getId());return q!=null&&q>=o.getQuantity()&&amount!=null&&amount.compareTo(o.getPayment())>=0;}
    private void updateOrderFinancials(Order o,BigDecimal refund){BigDecimal p=o.getGrossProfit()==null?BigDecimal.ZERO:o.getGrossProfit();o.setGrossProfit(p.subtract(refund));}
    private void restoreReturnedGoodsCost(Order o,int quantity){BigDecimal unit=o.getCostPriceSnapshot()!=null?o.getCostPriceSnapshot():o.getProduct().getCostPrice();if(unit!=null){BigDecimal p=o.getGrossProfit()==null?BigDecimal.ZERO:o.getGrossProfit();o.setGrossProfit(p.add(unit.multiply(BigDecimal.valueOf(quantity))));}}
    private static void bad(String m){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,m);} private static void conflict(String m){throw new ResponseStatusException(HttpStatus.CONFLICT,m);}
}
