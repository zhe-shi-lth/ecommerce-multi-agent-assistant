package com.lth.ecommerceagent.aftersale;
import java.util.List;
import org.springframework.web.bind.annotation.*;
record RejectAfterSaleRequest(String reason) {}
@RestController @RequestMapping("/api/after-sales")
class AfterSalesController {
    private final AfterSalesService service; AfterSalesController(AfterSalesService service){this.service=service;}
    @GetMapping List<AfterSalesResponse> list(@RequestParam(required=false) Long orderId){return service.list(orderId);}
    @PostMapping AfterSalesResponse create(@RequestBody AfterSalesRequest request){return service.create(request);}
    @PostMapping("/{id}/approve-refund") AfterSalesResponse refund(@PathVariable Long id){return service.approveRefund(id);}
    @PostMapping("/{id}/receive-return") AfterSalesResponse receive(@PathVariable Long id,@RequestBody ReturnReceiveRequest request){return service.receiveReturn(id,request);}
    @PostMapping("/{id}/reject") AfterSalesResponse reject(@PathVariable Long id,@RequestBody RejectAfterSaleRequest request){return service.reject(id,request.reason());}
}
