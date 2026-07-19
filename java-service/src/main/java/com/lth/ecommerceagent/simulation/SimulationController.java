package com.lth.ecommerceagent.simulation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final SimulationService service;

    public SimulationController(SimulationService service) {
        this.service = service;
    }

    @PostMapping("/pull-orders")
    public ResponseEntity<SimulationResult> pullOrders(@RequestBody SimulationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.pullOrders(request));
    }
}
