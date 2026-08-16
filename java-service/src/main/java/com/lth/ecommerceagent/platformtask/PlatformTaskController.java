package com.lth.ecommerceagent.platformtask;
import java.util.List; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/platform-tasks") @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PERM_CONTENT_PUBLISH')")
public class PlatformTaskController{private final PlatformTaskService service;public PlatformTaskController(PlatformTaskService service){this.service=service;}
 @GetMapping List<PlatformTaskResponse> list(@RequestParam(required=false)String entityType,@RequestParam(required=false)Long entityId,@RequestParam(required=false)String status){return service.list(entityType,entityId,status);}
 @PostMapping("/{id}/retry") PlatformTaskResponse retry(@PathVariable Long id){return PlatformTaskResponse.from(service.retry(id));}
}
