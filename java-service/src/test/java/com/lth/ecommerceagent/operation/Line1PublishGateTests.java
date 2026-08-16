package com.lth.ecommerceagent.operation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.lth.ecommerceagent.inventory.Inventory;
import com.lth.ecommerceagent.inventory.InventoryRepository;
import com.lth.ecommerceagent.product.Product;
import com.lth.ecommerceagent.product.ProductRepository;
import com.lth.ecommerceagent.python.PythonAgentClient;
import com.lth.ecommerceagent.python.PythonPublishListingResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;

@SpringBootTest
@WithMockUser(roles = "OWNER")
class Line1PublishGateTests {
    @MockBean
    private PythonAgentClient pythonAgentClient;

    @Autowired private OperationPlanController controller;
    @Autowired private OperationPlanRepository planRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private InventoryRepository inventoryRepository;

    @Test
    void publishRejectsLine1PlanWithoutRealMainImage() {
        OperationPlan plan = plan(false);
        var response = controller.confirm(plan.getId());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody().auditMessage()).contains("真实图片");
        assertThat(planRepository.findById(plan.getId()).orElseThrow().getConfirmationStatus()).isEqualTo("PENDING");
        verifyNoInteractions(pythonAgentClient);
    }

    @Test
    void completeLine1MaterialsPassInternalGateAndReachPublisher() {
        OperationPlan plan = plan(true);
        when(pythonAgentClient.publishListing(any())).thenReturn(new PythonPublishListingResult(
                true, "taobao", "ok", "item-1", "https://example.test/item-1", Map.of()));

        var response = controller.confirm(plan.getId());

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().confirmationStatus()).isEqualTo("CONFIRMED");
        assertThat(productRepository.findById(plan.getProduct().getId()).orElseThrow().getStatus())
                .isEqualTo("PUBLISHED");
        verify(pythonAgentClient).publishListing(any());
    }

    @Test
    void nonLine1PlanCannotUsePublishApproval() {
        OperationPlan plan = plan(true);
        plan.setLine("LINE2_RESTOCK");
        planRepository.save(plan);

        assertThatThrownBy(() -> controller.confirm(plan.getId()))
                .hasMessageContaining("不属于新品上架");
        verifyNoInteractions(pythonAgentClient);
    }

    private OperationPlan plan(boolean withImage) {
        Product product = new Product();
        product.setName("线1门控商品" + System.nanoTime());
        product.setCategory("测试");
        product.setDescription("描述");
        product.setCostPrice(new BigDecimal("10.00"));
        product.setSalePrice(new BigDecimal("20.00"));
        product.setTargetAudience("用户");
        product.setUsageScenario("场景");
        product.setStatus("DRAFT");
        product = productRepository.save(product);

        Inventory inventory = new Inventory();
        inventory.setProduct(product);
        inventory.setCurrentStock(20);
        inventory.setReservedStock(0);
        inventory.setSafeStockThreshold(5);
        inventory.setPurchaseCycleDays(3);
        inventory.setSalesLast7Days(0);
        inventory.setInventoryStatus("ENOUGH");
        inventoryRepository.save(inventory);

        OperationPlan plan = new OperationPlan();
        plan.setTraceId("line1-gate-" + System.nanoTime());
        plan.setProduct(product);
        plan.setPlatform("taobao");
        plan.setLine("LINE1_ONBOARDING");
        plan.setProductPlanJson(Map.of(
                "recommended_title", "完整标题",
                "detail_description", "完整详情",
                "selling_points", List.of("卖点"),
                "platform_copies", Map.of("taobao", "淘宝平台文案")));
        plan.setImagePlanJson(withImage
                ? Map.of("main_image_url", "https://example.test/main.png", "image_style", "白底")
                : Map.of("image_style", "白底"));
        plan.setInventoryPlanJson(Map.of());
        plan.setFulfillmentPlanJson(Map.of());
        plan.setFinalSummary("测试计划");
        plan.setManualReviewRequired(false);
        plan.setStatus("GENERATED");
        plan.setConfirmationStatus("PENDING");
        return planRepository.save(plan);
    }
}
