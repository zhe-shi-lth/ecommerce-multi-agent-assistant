package com.lth.ecommerceagent.orchestration;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonOperationPlanRequest;
import com.lth.ecommerceagent.python.PythonOperationPlanResult;

/**
 * 编排入口：加载 Java 侧商品/库存/订单，调用 Python 多 Agent 生成运营计划。
 * 注意：本端点只负责“Java 调 Python”得到结果；将结果落库由 Task 11（Python 调 Java Tool API）完成。
 */
@RestController
@RequestMapping("/api/orchestration")
public class OrchestrationController {

    private final PythonAgentClient pythonAgentClient;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;

    public OrchestrationController(
            PythonAgentClient pythonAgentClient,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            OrderRepository orderRepository) {
        this.pythonAgentClient = pythonAgentClient;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.orderRepository = orderRepository;
    }

    @PostMapping("/generate")
    public PythonOperationPlanResult generate(@RequestBody GeneratePlanRequest request) {
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Product not found: " + request.productId()));
        Inventory inventory = inventoryRepository.findByProductId(request.productId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Inventory not found for product: " + request.productId()));
        Order order = orderRepository.findById(request.orderId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Order not found: " + request.orderId()));

        PythonOperationPlanRequest pythonRequest =
                PythonOperationPlanRequest.from(product, inventory, order, request.triggerType());
        return pythonAgentClient.callOperationPlan(pythonRequest);
    }

    public record GeneratePlanRequest(Long productId, Long orderId, String triggerType) {
    }
}
