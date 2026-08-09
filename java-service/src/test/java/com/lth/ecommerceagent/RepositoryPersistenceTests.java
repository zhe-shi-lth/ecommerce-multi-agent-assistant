package com.lth.ecommerceagent;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;

import com.lth.ecommerceagent.agent.AgentRun;
import com.lth.ecommerceagent.agent.AgentRunRepository;
import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.operation.OperationPlan;
import com.lth.ecommerceagent.operation.OperationPlanRepository;
import com.lth.ecommerceagent.order.Order;
import com.lth.ecommerceagent.order.OrderRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.annotation.Transactional;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Transactional
class RepositoryPersistenceTests {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OperationPlanRepository operationPlanRepository;

    @Autowired
    private AgentRunRepository agentRunRepository;

    @Test
    void repositoriesSaveAndFindFirstPhaseData() {
        Product product = new Product();
        product.setName("便携式榨汁杯");
        product.setCategory("小家电");
        product.setDescription("适合办公室和健身房使用的小型榨汁杯");
        product.setCostPrice(new BigDecimal("39.00"));
        product.setSalePrice(new BigDecimal("89.00"));
        product.setTargetAudience("上班族、健身人群、学生");
        product.setUsageScenario("办公室、健身房、宿舍、旅行");
        product.setStatus("DRAFT");
        product = productRepository.saveAndFlush(product);

        Inventory inventory = new Inventory();
        inventory.setProduct(product);
        inventory.setCurrentStock(18);
        inventory.setReservedStock(5);
        inventory.setSafeStockThreshold(20);
        inventory.setPurchaseCycleDays(5);
        inventory.setSalesLast7Days(32);
        inventory.setInventoryStatus("LOW");
        inventory = inventoryRepository.saveAndFlush(inventory);

        Order order = new Order();
        order.setProduct(product);
        order.setPlatformOrderId("MOCKTEST000001");
        order.setQuantity(2);
        order.setStatus("PENDING_ANALYSIS");
        order.setAddressComplete(true);
        order.setPaid(true);
        order.setManualReviewRequired(false);
        order.setFulfillmentSuggestionStatus("PENDING_ANALYSIS");
        order = orderRepository.saveAndFlush(order);

        OperationPlan operationPlan = new OperationPlan();
        operationPlan.setTraceId("trace_repository_test");
        operationPlan.setProduct(product);
        operationPlan.setOrder(order);
        operationPlan.setProductPlanJson(Map.of("recommendedTitle", "便携式榨汁杯 办公健身随行"));
        operationPlan.setImagePlanJson(Map.of("mainImagePrompt", "clean product photo"));
        operationPlan.setInventoryPlanJson(Map.of("shouldRestock", true));
        operationPlan.setFulfillmentPlanJson(Map.of("canShip", true));
        operationPlan.setFinalSummary("库存偏低，订单可出货。");
        operationPlan.setManualReviewRequired(false);
        operationPlan.setStatus("SUCCESS");
        operationPlan = operationPlanRepository.saveAndFlush(operationPlan);

        AgentRun agentRun = new AgentRun();
        agentRun.setTraceId(operationPlan.getTraceId());
        agentRun.setOperationPlan(operationPlan);
        agentRun.setAgentName("SUPERVISOR_AGENT");
        agentRun.setInputJson(Map.of("triggerType", "GENERATE_OPERATION_PLAN"));
        agentRun.setOutputJson(Map.of("status", "SUCCESS"));
        agentRun.setStatus("SUCCESS");
        agentRun.setDurationMs(12);
        agentRun = agentRunRepository.saveAndFlush(agentRun);

        assertThat(productRepository.findById(product.getId())).isPresent();
        assertThat(inventoryRepository.findByProductId(product.getId())).contains(inventory);
        assertThat(orderRepository.findById(order.getId())).isPresent();
        assertThat(operationPlanRepository.findByTraceId("trace_repository_test")).contains(operationPlan);
        assertThat(agentRunRepository.findByOperationPlanId(operationPlan.getId())).containsExactly(agentRun);
    }
}
