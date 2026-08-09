package com.lth.ecommerceagent.python;

import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 调用 Python 多 Agent 服务，触发运营计划生成。
 * 对应 Python 侧 POST /agent/ecommerce/operation-plan。
 * 携带 X-Service-Key 服务间密钥（Python 侧据此放行内部调用）。
 */
@Component
public class PythonAgentClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String serviceKey;

    public PythonAgentClient(
            @Value("${python.agent.base-url}") String baseUrl,
            @Value("${service.api-key}") String serviceKey,
            @Value("${python.agent.connect-timeout-ms:3000}") int connectTimeoutMs,
            @Value("${python.agent.read-timeout-ms:30000}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey;
    }

    public PythonOperationPlanResult callOperationPlan(PythonOperationPlanRequest request) {
        String url = baseUrl + "/agent/ecommerce/operation-plan";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Service-Key", serviceKey);
            HttpEntity<PythonOperationPlanRequest> entity = new HttpEntity<>(request, headers);
            PythonOperationPlanResult result =
                    restTemplate.postForObject(url, entity, PythonOperationPlanResult.class);
            if (result == null) {
                throw new PythonAgentException("Python agent 返回空响应: " + url);
            }
            return result;
        } catch (ResourceAccessException e) {
            throw new PythonAgentException("无法连接 Python agent (" + url + "): " + e.getMessage(), e);
        } catch (RestClientException e) {
            throw new PythonAgentException("调用 Python agent 失败 (" + url + "): " + e.getMessage(), e);
        }
    }

    public PythonFulfillmentResult callOrderFulfillment(PythonOrderFulfillmentRequest request) {
        String url = baseUrl + "/agent/ecommerce/order-fulfillment";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Service-Key", serviceKey);
            HttpEntity<PythonOrderFulfillmentRequest> entity = new HttpEntity<>(request, headers);
            PythonFulfillmentResult result =
                    restTemplate.postForObject(url, entity, PythonFulfillmentResult.class);
            if (result == null) {
                throw new PythonAgentException("Python agent 返回空响应: " + url);
            }
            return result;
        } catch (ResourceAccessException e) {
            throw new PythonAgentException("无法连接 Python agent (" + url + "): " + e.getMessage(), e);
        } catch (RestClientException e) {
            throw new PythonAgentException("调用 Python agent 失败 (" + url + "): " + e.getMessage(), e);
        }
    }

    public PythonOrderVerifyResult verifyOrder(PythonOrderVerifyRequest request) {
        String url = baseUrl + "/agent/ecommerce/order-monitor/verify";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Service-Key", serviceKey);
            HttpEntity<PythonOrderVerifyRequest> entity = new HttpEntity<>(request, headers);
            PythonOrderVerifyResult result =
                    restTemplate.postForObject(url, entity, PythonOrderVerifyResult.class);
            if (result == null) {
                throw new PythonAgentException("Python agent 返回空响应: " + url);
            }
            return result;
        } catch (ResourceAccessException e) {
            throw new PythonAgentException("无法连接 Python agent (" + url + "): " + e.getMessage(), e);
        } catch (RestClientException e) {
            throw new PythonAgentException("调用 Python agent 失败 (" + url + "): " + e.getMessage(), e);
        }
    }

    /**
     * 从各平台开放 API 拉取真实订单（Python 只做协议翻译，落库仍在 Java）。
     *
     * <p>平台未对接 / 凭证缺失时，Python 会以中文原因返回 4xx，这里原样抛给上层，
     * 让最终用户看到"该去哪补什么"，而不是悄悄回退到模拟数据。
     */
    public PythonPullOrdersResult pullPlatformOrders(PythonPullOrdersRequest request) {
        String url = baseUrl + "/agent/ecommerce/platform/pull-orders";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Service-Key", serviceKey);
            HttpEntity<PythonPullOrdersRequest> entity = new HttpEntity<>(request, headers);
            PythonPullOrdersResult result =
                    restTemplate.postForObject(url, entity, PythonPullOrdersResult.class);
            if (result == null) {
                throw new PythonAgentException("拉取平台订单返回空响应");
            }
            return result;
        } catch (ResourceAccessException e) {
            throw new PythonAgentException("无法连接订单拉取服务：" + e.getMessage(), e);
        } catch (RestClientException e) {
            throw new PythonAgentException(detailOf(e), e);
        }
    }

    /**
     * 查询各平台对接就绪情况（GET /agent/ecommerce/platform/status）。
     * 用于「订单同步」模式下向前端展示已对接平台；拉不到不强依赖，交由上层兜底。
     */
    public PythonPlatformStatus getPlatformStatus() {
        String url = baseUrl + "/agent/ecommerce/platform/status";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Service-Key", serviceKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<PythonPlatformStatus> resp =
                    restTemplate.exchange(url, HttpMethod.GET, entity, PythonPlatformStatus.class);
            PythonPlatformStatus result = resp.getBody();
            if (result == null) {
                throw new PythonAgentException("拉取平台状态返回空响应");
            }
            return result;
        } catch (ResourceAccessException e) {
            throw new PythonAgentException("无法连接订单拉取服务：" + e.getMessage(), e);
        } catch (RestClientException e) {
            throw new PythonAgentException(detailOf(e), e);
        }
    }

    /** 优先取 Python 4xx 响应体里的 detail（中文可读原因），取不到再退回原始异常信息。 */
    private String detailOf(RestClientException e) {
        if (e instanceof HttpStatusCodeException http) {
            try {
                String detail = OBJECT_MAPPER
                        .readTree(http.getResponseBodyAsString(StandardCharsets.UTF_8))
                        .path("detail")
                        .asText("");
                if (!detail.isBlank()) {
                    return detail;
                }
            } catch (Exception ignored) {
                // 响应体不是 JSON 或没有 detail：走下面的兜底
            }
        }
        return "拉取平台订单失败：" + e.getMessage();
    }
}
