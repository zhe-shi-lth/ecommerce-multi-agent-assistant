package com.lth.ecommerceagent.media;
import java.util.List;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/media-assets") @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PERM_CONTENT_GENERATE')") class MediaAssetController{private final MediaAssetService s;MediaAssetController(MediaAssetService s){this.s=s;}@GetMapping List<MediaAssetResponse> list(@RequestParam Long operationPlanId){return s.list(operationPlanId);}}
