package com.lth.ecommerceagent.python;

/**
 * Java 调用 Python Agent 服务失败时抛出。
 */
public class PythonAgentException extends RuntimeException {

    public PythonAgentException(String message) {
        super(message);
    }

    public PythonAgentException(String message, Throwable cause) {
        super(message, cause);
    }
}
