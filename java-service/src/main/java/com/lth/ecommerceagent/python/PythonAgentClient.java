package com.lth.ecommerceagent.python;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * 调用 Python 多 Agent 服务，触发运营计划生成。
 * 对应 Python 侧 POST /agent/ecommerce/operation-plan。
 * 携带 X-Service-Key 服务间密钥（Python 侧据此放行内部调用）。
 */
@Component
public class PythonAgentClient {

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
}
